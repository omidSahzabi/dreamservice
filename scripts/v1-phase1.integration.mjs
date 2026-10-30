// Explicit disposable database only; real sessions/transactions, mocked delivery.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,randomBytes,randomInt,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextRequest} from 'next/server.js';
import {load} from './test-loader.mjs';
import {validPhoneCases,invalidPhoneCases} from './phone-normalization-fixtures.mjs';

const url=new URL(process.env.PHASE1_TEST_DATABASE_URL??'http://invalid');
assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
assert.match(url.pathname,/^\/dreamservice_phase1_test_[a-f0-9]{32}$/);assert.equal(url.pathname.slice(1),process.env.PHASE1_TEST_DATABASE_NAME);
process.env.DATABASE_URL=url.toString();process.env.SECURITY_ORIGIN='http://localhost';process.env.SECURITY_OTP_KEY=randomBytes(32).toString('hex');process.env.SECURITY_SMS_ENABLED='false';process.env.NODE_ENV='production';
process.env.OTP_DELIVERY_MODE='provider'; // Never allow development OTP logging.
globalThis.fetch=async()=>{throw Error('External services forbidden in integration tests');};
const db=new PrismaClient({log:[],errorFormat:'minimal'}),peer=new PrismaClient({log:[],errorFormat:'minimal'});
after(async()=>{await db.$disconnect();await peer.$disconnect()});
const context=new AsyncLocalStorage(),digest=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('hex'),phone=()=> '09'+String(randomInt(0,1e9)).padStart(9,'0');
const username=()=> 'phase_'+randomUUID().replaceAll('-','').slice(0,14);
let deliveries=0;
const request=(body,key=randomUUID())=>new Request('http://localhost/api/fixture',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
function application(client=db,sendOtpSms=async()=>{throw Error('OTP delivery not expected')}){
  const overrides={'@/lib/prisma':{prisma:client},'next/headers':{cookies:async()=>context.getStore()},'@/lib/auth/sms':{sendOrderStatusSms:async()=>{deliveries++;return 'SENT'},sendOtpSms}};
  return {module:file=>load(file,overrides),run:(jar,fn)=>context.run(jar,fn)};
}
const app=application(),other=application(peer);
function jar(entries=[]){const values=new Map(entries);return {get:name=>values.has(name)?{value:values.get(name)}:undefined,set(name,value){values.set(name,value)}}}
async function user(role='customer',data={}){
  const row=await db.user.create({data:{fname:'Integration',lname:'Member',contact:phone(),contactVerifiedAt:new Date(),...data}});
  if(role)await db.personProfile.create({data:{user_id:row.id,role}});
  const token=secret();await db.session.create({data:{userId:row.id,token:'sha256:'+digest(token),expiresAt:new Date(Date.now()+3600000)}});
  return {...row,jar:jar([['dream_session',token]])};
}
const controller=await user('app-admin');
const form=await db.orderForm.findUniqueOrThrow({where:{form_key:'order'},include:{steps:{orderBy:{step_order:'asc'},include:{fields:{orderBy:{field_order:'asc'},include:{options:{orderBy:{option_order:'asc'}}}}}}}});
const fields=form.steps.flatMap(step=>step.fields);
const payload=()=>({formKey:'order',data:Object.fromEntries(fields.map(field=>{
  let value;if(field.field_key==='service_type')value=field.options[0].option_value;
  else if(field.field_type==='number')value=field.validation?.min??1;
  else if(field.field_type==='tel')value='09123456789';
  else if(field.field_type==='email')value='';
  else if(field.field_type==='checkbox')value=[field.options[0].option_value];
  else if(['select','radio'].includes(field.field_type))value=field.options[0].option_value;
  else value='Synthetic isolated project description for phase one verification.';
  return [field.field_key,value];
}))});
const submit=(application,who,body,key)=>application.run(who.jar,()=>application.module('src/app/api/order/submit-order/route.ts').POST(request(body,key)));
const decide=(application,who,orderId)=>application.run(who.jar,()=>application.module('src/lib/order/workflow.ts').changeOrderStatus(request({expectedStatus:'PENDING',newStatus:'NEGOTIATING',message:'Isolated admin decision'}),orderId));
const register=(application,grant,body)=>application.run(grant,()=>application.module('src/app/api/auth/register/route.ts').POST(request(body)));
async function grant(contact){const proof=secret(),binding=secret();await db.registrationGrant.create({data:{tokenHash:digest(proof),phone:contact,browserBindingHash:digest(binding),expiresAt:new Date(Date.now()+600000)}});return jar([['dream_registration',proof],['dream_auth_binding',binding]])}
function check(name,fn){test(name,async()=>{try{await fn()}catch(error){throw Error(name+' ['+(error instanceof assert.AssertionError?'assertion':typeof error?.code==='string'?error.code:'operation')+']')}})}
function heldClient(){
  let signal,release;const started=new Promise(r=>signal=r),resume=new Promise(r=>release=r);
  const client=new Proxy(db,{get(target,key){if(key==='$transaction')return async(run,options)=>{signal();await resume;return target.$transaction(run,options)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
  return {client,started,release};
}
async function revoke(target,action){await other.run(controller.jar,()=>other.module('src/lib/admin/users.ts').manageUser(request({action,reason:'Isolated revocation race',expectedAdmin:target.role==='app-admin',expectedBanned:false}),target.id))}

check('two connections serialize distinct open-order submissions and preserve idempotent retries',async()=>{
  const owner=await user(),input=payload(),keys=Array.from({length:8},()=>randomUUID());
  const results=await Promise.all(keys.map((key,i)=>submit(i%2?other:app,owner,input,key)));
  assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,7);
  const bodies=await Promise.all(results.map(r=>r.json())),index=results.findIndex(r=>r.status===201),id=bodies[index].order_id;
  for(const body of bodies.filter(b=>!b.success)){assert.equal(body.code,'ORDER_OPEN_EXISTS');assert.equal(body.orderId,id)}
  assert.equal(await db.order.count({where:{client_id:owner.id,status:{in:['PENDING','NEGOTIATING','PROCESSING']}}}),1);
  await app.run(owner.jar,()=>app.module('src/lib/security/rate-limit.ts').enforceLimits([{scope:'order-submit',subject:owner.id,seconds:60,maximum:100}]));
  const replay=await submit(other,owner,input,keys[index]);assert.equal(replay.status,200);assert.equal((await replay.json()).order_id,id);
  const changed=structuredClone(input);changed.data.project_description+=' changed';assert.equal((await submit(app,owner,changed,keys[index])).status,409);
  await db.order.update({where:{order_id:id},data:{status:'COMPLETED'}});
  assert.equal((await submit(app,owner,input)).status,201);
});
check('open statuses block new keys; closed statuses permit them without changing historical orders',async()=>{
  for(const status of ['PENDING','NEGOTIATING','PROCESSING','COMPLETED','REJECTED','CANCELLED']){
    const owner=await user(),row=await db.order.create({data:{client_id:owner.id,status}}),before=await db.order.findUnique({where:{order_id:row.order_id}});
    const result=await submit(app,owner,payload());assert.equal(result.status,['PENDING','NEGOTIATING','PROCESSING'].includes(status)?409:201);
    assert.deepEqual(await db.order.findUnique({where:{order_id:row.order_id}}),before);
  }
});
check('restored historical duplicate open orders all block concurrent submissions and remain unchanged',async()=>{
  // The restored database contains the historical conflict; never write its orders.
  const groups=await db.$queryRaw`SELECT client_id,count(*)::int AS count FROM entity.orders WHERE status IN ('PENDING','NEGOTIATING','PROCESSING') AND idempotency_key IS NULL GROUP BY client_id HAVING count(*)>1 ORDER BY count(*) DESC,client_id ASC LIMIT 1`;
  assert.equal(groups.length,1);const owner=await db.user.findUniqueOrThrow({where:{id:groups[0].client_id}});assert.equal(owner.bannedAt,null);
  const before=await db.order.findMany({where:{client_id:owner.id},orderBy:{order_id:'asc'}}),open=before.filter(row=>['PENDING','NEGOTIATING','PROCESSING'].includes(row.status));
  assert.ok(open.length>1);const token=secret();await db.session.create({data:{userId:owner.id,token:'sha256:'+digest(token),expiresAt:new Date(Date.now()+3600000)}});
  const actor={id:owner.id,jar:jar([['dream_session',token]])},input=payload();
  const results=await Promise.all(Array.from({length:8},(_,i)=>submit(i%2?other:app,actor,input)));
  for(const response of results){assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'ORDER_OPEN_EXISTS');assert.equal(body.orderId,open[0].order_id)}
  assert.deepEqual(await db.order.findMany({where:{client_id:owner.id},orderBy:{order_id:'asc'}}),before);
});
check('submission budget rejects excess new requests with Retry-After; committed retries remain free',async()=>{
  const owner=await user(),input=payload(),key=randomUUID();assert.equal((await submit(app,owner,input,key)).status,201);
  const results=await Promise.all(Array.from({length:22},(_,i)=>submit(i%2?other:app,owner,input)));
  const denied=results.filter(r=>r.status===429);assert.ok(denied.length>=3);for(const r of denied){assert.ok(+r.headers.get('Retry-After')>0);assert.equal((await r.json()).code,'ORDER_RATE_LIMIT')}
  assert.equal((await submit(app,owner,input,key)).status,200);assert.equal(await db.order.count({where:{client_id:owner.id}}),1);
});
for(const action of ['ban','demote'])check('a committed '+action+' prevents an in-flight admin order decision on a second connection',async()=>{
  const actor=await user('app-admin'),owner=await user(),row=await db.order.create({data:{client_id:owner.id,status:'PENDING'}}),hold=heldClient();actor.role='app-admin';
  const pending=decide(application(hold.client),actor,row.order_id);await hold.started;
  const sent=deliveries;await revoke(actor,action);hold.release();await assert.rejects(pending,e=>e.status===(action==='ban'?401:403));
  assert.equal((await db.order.findUnique({where:{order_id:row.order_id}})).status,'PENDING');assert.equal(await db.orderStatusHistory.count({where:{orderId:row.order_id}}),0);assert.equal(deliveries,sent);
});
check('banned customer cannot finish in-flight submission or perform username mutation',async()=>{
  const actor=await user(),hold=heldClient();actor.role='customer';const pending=submit(application(hold.client),actor,payload());await hold.started;await revoke(actor,'ban');hold.release();assert.equal((await pending).status,401);
  assert.equal(await db.order.count({where:{client_id:actor.id}}),0);
  assert.equal((await app.run(actor.jar,()=>app.module('src/app/api/account/profile/route.ts').PATCH(request({username:username()})))).status,401);
});
check('revoked admin cannot claim notification retry; claim/delivery remains deduplicated',async()=>{
  const actor=await user('app-admin'),owner=await user(),row=await db.order.create({data:{client_id:owner.id,status:'PENDING'}});actor.role='app-admin';
  const h=await db.orderStatusHistory.create({data:{orderId:row.order_id,previousStatus:'PENDING',newStatus:'NEGOTIATING',adminUserId:controller.id,message:'Isolated notification',notificationNextAttemptAt:new Date(0)}});
  const hold=heldClient(),isolated=application(hold.client),sent=deliveries;
  const pending=isolated.run(actor.jar,()=>isolated.module('src/app/api/order/notifications/[historyId]/retry/route.ts').POST(request({}),{params:Promise.resolve({historyId:h.id})}));
  await hold.started;await revoke(actor,'demote');hold.release();assert.equal((await pending).status,403);assert.equal(deliveries,sent);assert.equal((await db.orderStatusHistory.findUnique({where:{id:h.id}})).notificationAttempts,0);
  const send=app.module('src/lib/order/notifications.ts');const results=await Promise.all([send.deliverOrderNotification(h.id,controller),other.module('src/lib/order/notifications.ts').deliverOrderNotification(h.id,controller)]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(deliveries,sent+1);
});
check('customer cannot decide orders; owned history and list cannot leak another customer',async()=>{
  const owner=await user(),stranger=await user(),row=await db.order.create({data:{client_id:owner.id,status:'PENDING'}});
  await assert.rejects(decide(app,owner,row.order_id),e=>e.status===403);
  await assert.rejects(app.run(stranger.jar,()=>app.module('src/lib/order/workflow.ts').orderHistory(row.order_id)),e=>e.status===404);
  const response=await app.run(owner.jar,()=>app.module('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders')));
  assert.ok((await response.json()).data.every(o=>o.client_id===owner.id));
});
check('equivalent Iranian phone forms normalize identically and the database rejects canonical duplicates',async()=>{
  const canonical='09812345678',international='+98'+canonical.slice(1),owner=await user(null,{contact:international});
  const {normalizePhone}=load('src/lib/auth/helper.ts');
  // PostgreSQL TEXT/JSON cannot represent NUL: assert its transport rejection
  // separately, rather than placing it in the normalization parity batch.
  const cases=[...validPhoneCases,...invalidPhoneCases.filter(input=>!input?.includes('\0')).map(input=>({input:input??null,canonical:null}))];
  const rows=await peer.$queryRaw`SELECT c.input,c.canonical,entity.canonical_iran_mobile(c.input) AS phone FROM jsonb_to_recordset(${JSON.stringify(cases)}::jsonb) AS c(input text,canonical text)`;
  for(const row of rows){let value=null;try{value=normalizePhone(row.input)}catch{ /* Invalid input must be NULL in SQL. */ }assert.equal(row.phone,row.canonical);assert.equal(value,row.canonical)}
  await assert.rejects(peer.$queryRaw`SELECT entity.canonical_iran_mobile(${'09812345678\0'})`,error=>error.code==='P2010'&&error.meta?.code==='22021');
  const before=await db.user.findUnique({where:{id:owner.id}});
  for(const contact of [canonical,canonical.slice(1),'98'+canonical.slice(1),'0098'+canonical.slice(1)])await assert.rejects(peer.user.create({data:{contact}}),e=>e.code==='P2002');
  const {phoneAccount}=app.module('src/lib/auth/phone-account.ts');assert.equal((await phoneAccount(db,canonical)).id,owner.id);
  const g=await grant(canonical),response=await register(app,g,{contact:canonical,fname:'Integration',lname:'Member'});assert.equal(response.status,409);
  assert.deepEqual(await db.user.findUnique({where:{id:owner.id}}),before);
});
check('concurrent equivalent-phone registrations create one account and one session',async()=>{
  const canonical='09800000002',grants=await Promise.all([grant(canonical),grant(canonical),grant(canonical)]),base={fname:'Integration',lname:'Member'};
  const results=await Promise.all([register(app,grants[0],{...base,contact:canonical.slice(1)}),register(other,grants[1],{...base,contact:'+98'+canonical.slice(1)}),register(app,grants[2],{...base,contact:'0098'+canonical.slice(1)})]);
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,2);const owner=await db.user.findUniqueOrThrow({where:{contact:canonical}});assert.equal(await db.session.count({where:{userId:owner.id}}),1);
});
check('username conflicts serialize across account updates and are canonical case insensitive',async()=>{
  const a=await user(),b=await user(),name=username();
  const patch=(application,actor,value)=>application.run(actor.jar,()=>application.module('src/app/api/account/profile/route.ts').PATCH(request({username:value})));
  const results=await Promise.all([patch(app,a,name.toUpperCase()),patch(other,b,name)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,1);assert.equal(await db.user.count({where:{username:name}}),1);
  await assert.rejects(peer.user.create({data:{username:name.toUpperCase()}}));await assert.rejects(peer.user.create({data:{username:'admin'}}));
  const who=results[0].status===200?a:b;assert.equal((await patch(app,who,'')).status,200);assert.equal((await db.user.findUnique({where:{id:who.id}})).username,null);
});
check('duplicate registration email is a safe conflict and proof consumption rolls back for retry',async()=>{
  const email=username()+'@example.invalid';await user(null,{email});const canonical=phone(),g=await grant(canonical),before=await db.user.count();
  const input={contact:canonical,fname:'Integration',lname:'Member',email};const response=await register(app,g,input);assert.equal(response.status,409);assert.equal((await response.json()).code,'REGISTRATION_CONFLICT');assert.equal(await db.user.count(),before);
  const token=g.get('dream_registration').value;assert.equal((await db.registrationGrant.findUnique({where:{tokenHash:digest(token)}})).consumedAt,null);
  assert.equal((await register(app,g,{...input,email:''})).status,200);
});
check('username registration concurrency, moderation and legacy NULL login authority remain safe',async()=>{
  const name=username(),phones=[phone(),phone()],grants=await Promise.all(phones.map(grant));
  const body=i=>({contact:phones[i],fname:'حسین',lname:'سیدزاده',username:i?name:name.toUpperCase()});
  const results=await Promise.all([register(app,grants[0],body(0)),register(other,grants[1],body(1))]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,1);
  assert.equal(await db.user.count({where:{username:name}}),1);
  const legacy=await user(null,{username:null});assert.equal((await app.run(legacy.jar,()=>app.module('src/lib/auth/session.ts').getCurrentUser())).id,legacy.id);
  const canonical=phone(),g=await grant(canonical);const response=await register(app,g,{contact:canonical,fname:'FUCK',lname:'Member'});assert.equal(response.status,422);assert.equal((await response.json()).code,'NAME_PROHIBITED');assert.equal(await db.user.count({where:{contact:canonical}}),0);
});
check('real OTP login resolves equivalent legacy identities without rewriting contacts or creating registration grants',async()=>{
  let captured=null,sent=0;
  const login=application(db,async value=>{captured=value;sent++;return {success:true}}),otp=login.module('src/lib/auth/otp.ts');
  const variants=[
    {canonical:'09800000003',stored:'09800000003',input:'9800000003',username:null},
    {canonical:'09800000004',stored:'+989800000004',input:'00989800000004',username:null},
    {canonical:'09800000005',stored:'9800000005',input:'(098)000-000-05',username:username()},
  ];
  for(const variant of variants){
    const owner=await user(null,{contact:variant.stored,username:variant.username}),cookies=jar(),before=await db.user.count(),sessions=await db.session.count({where:{userId:owner.id}}),grants=await db.registrationGrant.count({where:{phone:variant.canonical}});
    await login.run(cookies,()=>otp.requestOtp(request({target:variant.input,purpose:'LOGIN'})));
    assert.equal(captured.to,variant.canonical);
    const result=await login.run(cookies,()=>otp.verifyOtpRequest(request({target:variant.canonical,purpose:'LOGIN',code:captured.code})));
    assert.equal(result.isNewUser,false);assert.equal((await login.run(cookies,()=>login.module('src/lib/auth/session.ts').getCurrentUser())).id,owner.id);
    const after=await db.user.findUniqueOrThrow({where:{id:owner.id}});assert.equal(after.contact,variant.stored);assert.equal(after.username,variant.username);assert.equal(await db.user.count(),before);
    assert.equal(await db.registrationGrant.count({where:{phone:variant.canonical}}),grants);assert.equal(await db.session.count({where:{userId:owner.id}}),sessions+1);
    await assert.rejects(login.run(cookies,()=>otp.verifyOtpRequest(request({target:variant.input,purpose:'LOGIN',code:captured.code}))),error=>error.code==='OTP_INVALID');
    assert.equal(await db.session.count({where:{userId:owner.id}}),sessions+1);
  }
  const before=await db.otpVerification.count();
  await assert.rejects(login.run(jar(),()=>otp.requestOtp(request({target:'09812345678abc',purpose:'LOGIN'}))),error=>error.code==='INVALID_PHONE');
  assert.equal(await db.otpVerification.count(),before);assert.equal(sent,variants.length);
});
