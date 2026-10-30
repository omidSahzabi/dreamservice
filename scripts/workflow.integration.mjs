// Opt-in isolated PostgreSQL verification; never reads project environment files.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomInt,randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {load} from './test-loader.mjs';

const target = new URL(process.env.SECURITY_TEST_DATABASE_URL ?? 'http://unconfigured');
if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !/^\/dreamservice_security_test_workflow_\d+$/.test(target.pathname)) throw new Error('An isolated local workflow test database is required');
process.env.DATABASE_URL = target.toString();
process.env.SECURITY_ORIGIN = 'http://localhost';
process.env.SECURITY_OTP_KEY = randomBytes(32).toString('hex');
process.env.SECURITY_SMS_ENABLED = 'false';
const db = new PrismaClient({log:[]});
after(()=>db.$disconnect());
globalThis.fetch = async () => {throw new Error('Real SMS and external HTTP forbidden in integration tests');};
const {digest} = load('src/lib/security/crypto.ts');
const admin = await db.user.create({data:{}});
const owner = await db.user.create({data:{contact:'09'+String(randomInt(0,1000000000)).padStart(9,'0'),contactVerifiedAt:new Date()}});
const outsider = await db.user.create({data:{}});
await db.personProfile.create({data:{user_id:admin.id,role:'app-admin'}});
let active = admin;
let sms = 'SENT';
let deliveries = 0;
let destinations = [];
const tokens = new Map();
for(const user of [admin,owner,outsider]) {
  const token = randomBytes(32).toString('hex');tokens.set(user.id,token);
  await db.session.create({data:{userId:user.id,token:'sha256:'+digest(token),expiresAt:new Date(Date.now()+3600000)}});
}
const overrides = {
  '@/lib/prisma':{prisma:db},
  'next/headers':{cookies:async()=>({get:name=>name==='dream_session'&&active?{value:tokens.get(active.id)}:undefined})},
  '@/lib/auth/sms':{sendOrderStatusSms:async phone=>{deliveries++;destinations.push(phone);return sms;}},
};
const workflow=load('src/lib/order/workflow.ts',overrides);
const notifications=load('src/lib/order/notifications.ts',overrides);
const req = (from,to,message='Fixture decision')=>new Request('http://localhost/api/order/1/status',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({expectedStatus:from,newStatus:to,message})});
const order = status=>db.order.create({data:{client_id:owner.id,status,meta:{phone:'09000000001'}}});
function check(name,run){test(name,async()=>{try{await run();}catch(e){throw new Error('Workflow integration failed: '+name+' ['+(e instanceof assert.AssertionError?'assertion':e?.code??e?.constructor?.name)+']');}});}

for(const [from,to]of [['PENDING','NEGOTIATING'],['PENDING','REJECTED'],['NEGOTIATING','PROCESSING'],['NEGOTIATING','REJECTED']])check(from+' to '+to+' is atomic, records admin message and notifies only the verified owner',async()=>{
  active=admin;sms='SENT';const row=await order(from);
  const result=await workflow.changeOrderStatus(req(from,to,'  Fixture message  '),row.order_id);
  assert.equal((await db.order.findUnique({where:{order_id:row.order_id}})).status,to);
  const history=await db.orderStatusHistory.findUnique({where:{id:result.historyId}});
  assert.equal(history.previousStatus,from);assert.equal(history.newStatus,to);assert.equal(history.message,'Fixture message');assert.equal(history.adminUserId,admin.id);assert.equal(history.notificationState,'SENT');assert.equal(destinations.at(-1),owner.contact);
});

check('invalid, historical, duplicate and concurrent transitions cannot overwrite a decision',async()=>{
  active=admin;
  for(const status of ['COMPLETED','CANCELLED','REJECTED','PROCESSING',null,'LEGACY']){
    const row=await order(status);
    await assert.rejects(workflow.changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id),e=>e.status===409);
    assert.equal(await db.orderStatusHistory.count({where:{orderId:row.order_id}}),0);
  }
  const row=await order('PENDING');
  await assert.rejects(workflow.changeOrderStatus(req('PENDING','PROCESSING'),row.order_id),e=>e.status===422);
  for(const message of ['', '   ', 'x'.repeat(2001)])await assert.rejects(workflow.changeOrderStatus(req('PENDING','NEGOTIATING',message),row.order_id),e=>e.status===422);
  const result=await Promise.allSettled(Array.from({length:8},()=>workflow.changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id)));
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await db.orderStatusHistory.count({where:{orderId:row.order_id}}),1);
  await assert.rejects(workflow.changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id),e=>e.status===409);
});

check('history insertion failure rolls back status',async()=>{
  active=admin;const row=await order('PENDING');
  const broken=db.$extends({query:{orderStatusHistory:{create(){throw new Error('Injected failure');}}}});
  await assert.rejects(load('src/lib/order/workflow.ts',{...overrides,'@/lib/prisma':{prisma:broken}}).changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id));
  assert.equal((await db.order.findUnique({where:{order_id:row.order_id}})).status,'PENDING');
  assert.equal(await db.orderStatusHistory.count({where:{orderId:row.order_id}}),0);
});

check('real sessions enforce exact admin role, owner history isolation, and response minimization',async()=>{
  const row=await order('PENDING');active=admin;
  await workflow.changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id);
  active=null;await assert.rejects(workflow.orderHistory(row.order_id),e=>e.status===401);
  active=outsider;await assert.rejects(workflow.orderHistory(row.order_id),e=>e.status===404);
  active=owner;
  await assert.rejects(workflow.changeOrderStatus(req('NEGOTIATING','PROCESSING'),row.order_id),e=>e.status===403);
  const view=await workflow.orderHistory(row.order_id);assert.equal(view.history[0].message,'Fixture decision');assert.equal('adminUserId' in view.history[0],false);assert.equal('notificationState' in view.history[0],false);
  await db.personProfile.create({data:{user_id:outsider.id,role:'ADMIN'}});active=outsider;
  await assert.rejects(workflow.changeOrderStatus(req('NEGOTIATING','PROCESSING'),row.order_id),e=>e.status===403);
});

check('SMS failure does not roll back status; delay, atomic claims and three-attempt budget bound retries',async()=>{
  active=admin;sms='FAILED';const row=await order('PENDING');
  const {historyId}=await workflow.changeOrderStatus(req('PENDING','REJECTED'),row.order_id);
  assert.equal((await db.order.findUnique({where:{order_id:row.order_id}})).status,'REJECTED');
  assert.equal(await notifications.deliverOrderNotification(historyId),false);
  for(let attempt=0;attempt<2;attempt++){
    await db.orderStatusHistory.update({where:{id:historyId},data:{notificationNextAttemptAt:new Date(0)}});
    const calls=deliveries;
    const results=await Promise.all(Array.from({length:8},()=>notifications.deliverOrderNotification(historyId)));
    assert.equal(results.filter(Boolean).length,1);assert.equal(deliveries,calls+1);
  }
  assert.equal((await db.orderStatusHistory.findUnique({where:{id:historyId}})).notificationAttempts,3);
  assert.equal(await notifications.deliverOrderNotification(historyId),false);
});

check('ambiguous delivery and unverified phones are never automatically retried',async()=>{
  active=admin;sms='UNKNOWN';const row=await order('PENDING');
  const {historyId}=await workflow.changeOrderStatus(req('PENDING','REJECTED'),row.order_id);
  assert.equal(await notifications.deliverOrderNotification(historyId),false);
  await db.user.update({where:{id:owner.id},data:{contactVerifiedAt:null}});
  const other=await order('PENDING');const count=deliveries;
  const skipped=await workflow.changeOrderStatus(req('PENDING','REJECTED'),other.order_id);
  assert.equal(deliveries,count);assert.equal((await db.orderStatusHistory.findUnique({where:{id:skipped.historyId}})).notificationState,'SKIPPED');
});

check('a confirmed failed notification can succeed once; customer retry and cross-site decisions are denied',async()=>{
  active=admin;sms='FAILED';
  await db.user.update({where:{id:owner.id},data:{contactVerifiedAt:new Date()}});
  const row=await order('PENDING');
  const {historyId}=await workflow.changeOrderStatus(req('PENDING','NEGOTIATING'),row.order_id);
  const endpoint=load('src/app/api/order/notifications/[historyId]/retry/route.ts',overrides);
  active=owner;
  const response=await endpoint.POST(req('PENDING','REJECTED'),{params:Promise.resolve({historyId})});
  assert.equal(response.status,403);
  active=admin;
  const badOrigin=new Request(req('NEGOTIATING','PROCESSING'),{headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'}});
  await assert.rejects(workflow.changeOrderStatus(badOrigin,row.order_id),e=>e.status===403);
  sms='SENT';await db.orderStatusHistory.update({where:{id:historyId},data:{notificationNextAttemptAt:new Date(0)}});
  assert.equal(await notifications.deliverOrderNotification(historyId),true);
  assert.equal(await notifications.deliverOrderNotification(historyId),false);
  assert.equal((await db.orderStatusHistory.findUnique({where:{id:historyId}})).notificationState,'SENT');
});

check('notification infrastructure exception after commit still returns HTTP 200 with durable status and history',async()=>{
  active=admin;const row=await order('PENDING');
  const route=load('src/app/api/order/[orderId]/status/route.ts',{
    ...overrides,'@/lib/order/notifications':{deliverOrderNotification:async()=>{throw new Error('Injected delivery infrastructure failure');}},
  });
  const response=await route.POST(req('PENDING','NEGOTIATING'),{params:Promise.resolve({orderId:String(row.order_id)})});
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.success,true);
  assert.equal((await db.order.findUnique({where:{order_id:row.order_id}})).status,'NEGOTIATING');
  assert.equal(await db.orderStatusHistory.count({where:{id:result.historyId,orderId:row.order_id}}),1);
});
