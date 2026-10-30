// Opt-in only. Requires a migrated, isolated local fixture database; never reads .env.
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {load} from './test-loader.mjs';

const configured=process.env.PROJECTS_TEST_DATABASE_URL;
if(!configured)throw new Error('Explicit isolated project test database configuration is required');
let target;
try{target=new URL(configured);}catch{throw new Error('Invalid isolated database configuration');}
const database=decodeURIComponent(target.pathname.slice(1));
if(!['postgresql:','postgres:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||
   !/^dreamservice_projects_test_[a-z0-9_]+$/.test(database)||database!==process.env.PROJECTS_TEST_DATABASE_NAME)throw new Error('Refusing a database outside the acknowledged isolated fixture target');
process.env.DATABASE_URL=configured;
process.env.SECURITY_SMS_ENABLED='false';
process.env.SECURITY_OTP_KEY=randomBytes(32).toString('hex');
process.env.SECURITY_ORIGIN='http://localhost';
globalThis.fetch=async()=>{throw new Error('External HTTP disabled in project integration tests');};

const prisma=new PrismaClient();
const peer=new PrismaClient();
const context=new AsyncLocalStorage();
function application(client){return load('src/lib/admin/projects.ts',{'@/lib/prisma':{prisma:client},'next/headers':{cookies:async()=>({get:name=>name==='dream_session'&&context.getStore()?{value:context.getStore()}:undefined})}});}
const app=application(prisma);const other=application(peer);
const marker='Project integration fixture '+randomUUID();
const secret=()=>randomBytes(32).toString('hex');
const input=(extra={})=>({title:marker,titleFa:'پروژه آزمایشی',description:'Synthetic public fixture',descriptionFa:null,orderId:null,
  status:'PLANNED',startAt:null,deadlineAt:new Date(Date.now()+86400000).toISOString(),isPublic:false,showOnHomepage:false,...extra});
const request=body=>new Request('http://localhost/api/admin/projects',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(body)});
const run=(token,operation)=>context.run(token,operation);
const rejectsCode=(operation,code)=>assert.rejects(operation,error=>error.code===code);
async function identity(role,banned=false){
  const user=await prisma.user.create({data:{fname:marker,bannedAt:banned?new Date():null}});
  if(role)await prisma.personProfile.create({data:{user_id:user.id,role}});
  const token=secret();
  await prisma.session.create({data:{userId:user.id,token:'sha256:'+createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});
  return {user,token};
}
function edit(row,extra={}){return {data:input({title:row.title,titleFa:row.titleFa,description:row.description,descriptionFa:row.descriptionFa,orderId:row.orderId,
  status:row.status,startAt:row.startAt?.toISOString()??null,deadlineAt:row.deadlineAt?.toISOString()??null,isPublic:row.isPublic,showOnHomepage:row.showOnHomepage,...extra}),expectedUpdatedAt:row.updatedAt.toISOString()};}

test('project PostgreSQL integration with isolated synthetic identities and orders',async t=>{
  try{
    assert.equal(await prisma.project.count(),0,'Use an empty fixture Project table');
    const admin=await identity('app-admin');const customer=await identity('admin');const banned=await identity('app-admin',true);
    const order=await prisma.order.create({data:{client_id:customer.user.id,status:'PENDING',description:marker}});
    const create=(extra={})=>run(admin.token,()=>app.saveProject(request(input(extra))));
    await t.test('anonymous, non-contract admin role and banned sessions cannot list or create',async()=>{
      for(const [token,code]of [[undefined,'UNAUTHENTICATED'],[customer.token,'FORBIDDEN'],[banned.token,'UNAUTHENTICATED']]){
        await rejectsCode(()=>run(token,()=>app.saveProject(request(input()))),code);
        await rejectsCode(()=>run(token,()=>app.listProjects(new Request('http://localhost/api/admin/projects'))),code);
      }
    });
    let linked;
    await t.test('standalone and linked creation, missing order and duplicate order constraints',async()=>{
      const standalone=await create();assert.equal(standalone.orderId,null);
      linked=await create({orderId:order.order_id});
      await rejectsCode(()=>create({orderId:order.order_id}),'PROJECT_CONFLICT');
      await rejectsCode(()=>create({orderId:2147483647}),'PROJECT_ORDER_NOT_FOUND');
    });
    await t.test('status transitions and concurrent stale edits preserve order workflow',async()=>{
      const payload=edit(linked,{status:'ACTIVE'});
      const results=await Promise.allSettled([run(admin.token,()=>app.saveProject(request(payload),linked.id)),run(admin.token,()=>other.saveProject(request(payload),linked.id))]);
      assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
      assert.equal(results.find(row=>row.status==='rejected').reason.code,'PROJECT_CONFLICT');
      const active=await prisma.project.findUniqueOrThrow({where:{id:linked.id}});
      await rejectsCode(()=>run(admin.token,()=>app.saveProject(request(edit(active,{status:'PLANNED'})),active.id)),'PROJECT_TRANSITION_INVALID');
      assert.equal((await prisma.order.findUniqueOrThrow({where:{order_id:order.order_id}})).status,'PENDING');
    });
    let selected;
    await t.test('independent clients concurrently select projects with exactly one surviving selection',async()=>{
      await Promise.all([create({isPublic:true,showOnHomepage:true}),run(admin.token,()=>other.saveProject(request(input({isPublic:true,showOnHomepage:true}))))]);
      assert.equal(await prisma.project.count({where:{showOnHomepage:true}}),1);
      selected=await prisma.project.findFirstOrThrow({where:{showOnHomepage:true}});
      // Exercise the database constraint independently of the application lock.
      await assert.rejects(()=>prisma.project.create({data:{...input({isPublic:true,showOnHomepage:true}),deadlineAt:new Date(Date.now()+86400000)}}),error=>error.code==='P2002');
    });
    await t.test('public projection excludes order data and cancellation preserves other eligible projects',async()=>{
      const {getHomepageProject}=load('src/lib/projects/homepage.ts',{'@/lib/prisma':{prisma}});
      const publicProject=await getHomepageProject('en',new Date());
      assert.deepEqual(Object.keys(publicProject).sort(),['deadlineAt','description','title']);
      await run(admin.token,()=>app.saveProject(request(edit(selected,{status:'CANCELLED',showOnHomepage:false})),selected.id));
      assert.notEqual(await getHomepageProject('en',new Date()),null);
    });
    await t.test('ban after session issuance is enforced by actual session lookup',async()=>{
      await prisma.user.update({where:{id:admin.user.id},data:{bannedAt:new Date()}});
      await rejectsCode(()=>create(),'UNAUTHENTICATED');
    });
  }catch(error){
    // Never forward Prisma diagnostics, private fixture data or a connection URL.
    const category=error instanceof assert.AssertionError?'assertion':typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'operation';
    throw new Error('Isolated project integration failed ['+category+']');
  }finally{await Promise.all([prisma.$disconnect(),peer.$disconnect()]);}
});
