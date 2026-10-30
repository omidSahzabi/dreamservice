// Explicit isolated PostgreSQL target; no project env loading, SMS, resets or deletes.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextRequest} from 'next/server.js';
import {load} from './test-loader.mjs';
const url=new URL(process.env.SECURITY_TEST_DATABASE_URL??'http://unconfigured');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!/^\/dreamservice_security_test_submission_\d+$/.test(url.pathname))throw new Error('Isolated local submission database required');
process.env.DATABASE_URL=url.toString();process.env.SECURITY_ORIGIN='http://localhost';process.env.SECURITY_SMS_ENABLED='false';
globalThis.fetch=async()=>{throw new Error('External services disabled');};
const db=new PrismaClient({log:[]});after(()=>db.$disconnect());
const form=await db.orderForm.findUnique({where:{form_key:'order'},include:{steps:{orderBy:{step_order:'asc'},include:{fields:{orderBy:{field_order:'asc'},include:{options:{orderBy:{option_order:'asc'}}}}}}}});
if(!form)throw new Error('Copy of published dynamic form required');
const owner=await db.user.create({data:{}}),other=await db.user.create({data:{}}),admin=await db.user.create({data:{}});
await db.personProfile.create({data:{user_id:admin.id,role:'app-admin'}});
const tokens=new Map();for(const identity of [owner,other,admin]){const token=randomBytes(32).toString('hex');tokens.set(identity.id,token);await db.session.create({data:{userId:identity.id,token:'sha256:'+createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});}
let active=owner;
const overrides={'@/lib/prisma':{prisma:db},'next/headers':{cookies:async()=>({get:name=>name==='dream_session'&&active?{value:tokens.get(active.id)}:undefined})}};
const submit=load('src/app/api/order/submit-order/route.ts',overrides);
const listing=load('src/app/api/order/load-orders/route.ts',overrides);
const config=load('src/app/api/order/order-form-config/route.ts',overrides);
const clientSchemas=load('src/schemas/orderSchema.ts');
const fields=form.steps.flatMap(step=>step.fields);
function payload(service){return {formKey:'order',data:Object.fromEntries(fields.map(field=>{
  let value;
  if(field.field_key==='service_type')value=service;
  else if(field.field_type==='number')value=field.validation?.min??1;
  else if(field.field_type==='tel')value='۰۹۱۲۳۴۵۶۷۸۹';
  else if(field.field_type==='email')value='';
  else if(field.field_type==='checkbox')value=[field.options[0].option_value];
  else if(['select','radio'].includes(field.field_type))value=field.options[0].option_value;
  else value='Synthetic customer project description for isolated verification.';
  return [field.field_key,value];
}))};}
const request=(body,key=randomUUID())=>new Request('http://localhost/api/order/submit-order',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
function check(name,run){test(name,async()=>{try{await run();}catch(e){throw new Error('Submission integration failed: '+name+' ['+(e instanceof assert.AssertionError?'assertion':e?.code??e?.constructor?.name)+']');}});}

check('published form configuration loads both locales without changing records',async()=>{
  const before=await db.orderForm.findMany({include:{translations:true,steps:{include:{translations:true,fields:{include:{translations:true,options:{include:{translations:true}}}}}}}});
  for(const locale of ['fa','en']){const response=await config.GET(new Request('http://localhost/api/order/order-form-config?locale='+locale));assert.equal(response.status,200);const body=await response.json();assert.equal(body.form.steps.length,form.steps.length);}
  assert.deepEqual(await db.orderForm.findMany({include:{translations:true,steps:{include:{translations:true,fields:{include:{translations:true,options:{include:{translations:true}}}}}}}}),before);
});

for(const service of fields.find(field=>field.field_key==='service_type').options.map(option=>option.option_value))check('client and server accept the existing '+service+' branch; owner/admin can see one PENDING order',async()=>{
  active=owner;const response=await config.GET(new Request('http://localhost/api/order/order-form-config?locale=en'));const localized=await response.json();
  const input=payload(service);const parsed=clientSchemas.createFormSchema(localized.form.steps,input.data,key=>key).safeParse(input.data);assert.equal(parsed.success,true);
  const result=await submit.POST(request({formKey:'order',data:parsed.data}));assert.equal(result.status,201);const body=await result.json();assert.ok(body.order_id>0);
  const row=await db.order.findUnique({where:{order_id:body.order_id}});assert.equal(row.client_id,owner.id);assert.equal(row.status,'PENDING');assert.equal(row.meta.phone,'09123456789');
  if(service!=='website')assert.equal(row.page_count,null);
  const own=await (await listing.GET(new NextRequest('http://localhost/api/order/load-orders?limit=100'))).json();assert.ok(own.data.some(order=>order.order_id===row.order_id));assert.ok(own.data.every(order=>order.client_id===owner.id));
  active=other;const outside=await (await listing.GET(new NextRequest('http://localhost/api/order/load-orders?limit=100'))).json();assert.ok(!outside.data.some(order=>order.order_id===row.order_id));
  assert.equal((await listing.GET(new NextRequest('http://localhost/api/order/load-orders?client_id='+owner.id))).status,403);
  active=admin;const privileged=await (await listing.GET(new NextRequest('http://localhost/api/order/load-orders?client_id='+owner.id+'&limit=100'))).json();assert.ok(privileged.data.some(order=>order.order_id===row.order_id));
});

check('concurrent retries create one order; altered payloads conflict and keys remain scoped to the owner',async()=>{
  active=owner;const input=payload('website'),key=randomUUID();
  const results=await Promise.all(Array.from({length:8},()=>submit.POST(request(input,key))));assert.equal(results.filter(response=>response.status===201).length,1);
  assert.ok(results.every(response=>[200,201].includes(response.status)));const bodies=await Promise.all(results.map(response=>response.json()));assert.equal(new Set(bodies.map(body=>body.order_id)).size,1);
  const changed=structuredClone(input);changed.data.project_description+=' Changed';assert.equal((await submit.POST(request(changed,key))).status,409);
  assert.equal((await submit.POST(request(input,key))).status,200);assert.equal(await db.order.count({where:{client_id:owner.id,idempotency_key:key}}),1);
  active=other;assert.equal((await submit.POST(request(input,key))).status,201);
});

check('anonymous, forged ownership, missing required values and invalid configured types/rules are rejected without writes',async()=>{
  active=null;assert.equal((await submit.POST(request(payload('website')))).status,401);active=owner;
  const before=await db.order.count();
  for(const change of [data=>{data.client_id=other.id;},data=>{data.full_name='  ';},data=>{delete data.phone;},data=>{data.page_count=0;},data=>{data.page_count='3';},data=>{data.project_description='short';},data=>{data.service_type='forged';},data=>{data.email='bad';}]){
    const input=payload('website');change(input.data);assert.equal((await submit.POST(request(input))).status,422);
  }
  assert.equal(await db.order.count(),before);
});
