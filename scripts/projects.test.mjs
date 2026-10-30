import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const {projectInputSchema, canTransitionProject} = load('src/schemas/project.ts');
const {countdownAt} = load('src/lib/projects/countdown.ts');
const future = new Date(Date.now() + 86400000).toISOString();
const input = (extra = {}) => ({title:'Public English fixture', titleFa:'پروژه آزمایشی', description:'Public description', descriptionFa:null,
  orderId:null, status:'PLANNED', startAt:null, deadlineAt:future, isPublic:false, showOnHomepage:false, ...extra});
const request = (body, extra = {}) => new Request('http://localhost/api/admin/projects', {method:'POST', headers:{Origin:'http://localhost','Content-Type':'application/json',...extra}, body:JSON.stringify(body)});
const known = code => new Prisma.PrismaClientKnownRequestError('Fixture error', {code, clientVersion:'5.22.0'});

function harness() {
  const actorId = randomUUID();
  const state = {principal:{id:actorId, roles:['app-admin']}, banned:false, role:true, projects:[], orders:[{order_id:7,type:'PRIVATE ORDER TYPE',status:'PENDING'}], limits:0};
  let tail = Promise.resolve();
  const project = {
    findUnique: async ({where}) => state.projects.find(row => row.id === where.id) ?? null,
    findFirst: async ({where}) => state.projects.find(row => row.showOnHomepage && row.id !== where.id?.not) ?? null,
    create: async ({data}) => {
      if (data.orderId !== null && state.projects.some(row => row.orderId === data.orderId)) throw known('P2002');
      const row = {...data, id:randomUUID(), createdAt:new Date(), updatedAt:new Date()}; state.projects.push(row); return row;
    },
    update: async ({where,data}) => {
      if (data.orderId != null && state.projects.some(row => row.id !== where.id && row.orderId === data.orderId)) throw known('P2002');
      const row = state.projects.find(row => row.id === where.id);
      Object.assign(row, data); return row;
    },
    updateMany: async ({where,data}) => {for (const row of state.projects) if (row.showOnHomepage && row.id !== where.id?.not) Object.assign(row,data,{updatedAt:new Date(row.updatedAt.getTime()+1)});},
    findMany: async () => state.projects,
    count: async () => state.projects.length,
  };
  const tx = {project,
    user:{findUnique:async()=>({bannedAt:state.banned ? new Date() : null})},
    personProfile:{findFirst:async()=>state.role ? {pr_id:1} : null},
    order:{findUnique:async({where})=>state.orders.find(row=>row.order_id===where.order_id) ?? null},
    $queryRaw:async()=>[],
  };
  const prisma = {$transaction:async operation => {
    const previous = tail; let release; tail = new Promise(resolve=>{release=resolve;}); await previous;
    const before = structuredClone(state.projects);
    try {return await operation(tx);} catch(error){state.projects=before;throw error;} finally {release();}
  }};
  const overrides = {'@/lib/prisma':{prisma}, '@/lib/auth/session':{getCurrentUser:async()=>state.principal},
    '@/lib/security/rate-limit':{enforceLimits:async()=>{state.limits++;}}};
  const api = load('src/lib/admin/projects.ts',overrides);
  return {state,api,overrides, create:(extra={})=>api.saveProject(request(input(extra)))};
}
// Build edit inputs without response-only fields.
function edit(row, extra={}) {
  return {data:input({title:row.title,titleFa:row.titleFa,description:row.description,descriptionFa:row.descriptionFa,orderId:row.orderId,
    status:row.status,startAt:row.startAt?.toISOString()??null,deadlineAt:row.deadlineAt?.toISOString()??null,isPublic:row.isPublic,showOnHomepage:row.showOnHomepage,...extra}),expectedUpdatedAt:row.updatedAt.toISOString()};
}
const rejectsCode = (operation,code) => assert.rejects(operation,error=>error.code===code);

test('project validation rejects untrusted fields, invalid titles, order IDs and dates',()=>{
  for (const bad of [{title:' '},{titleFa:''},{title:'x'.repeat(201)},{description:'x'.repeat(5001)},{orderId:-1},{orderId:1.5},{deadlineAt:'invalid'},
    {startAt:'2100-01-02T00:00:00Z',deadlineAt:'2100-01-01T00:00:00Z'},{isPublic:false,showOnHomepage:true},{status:'COMPLETED',isPublic:true,showOnHomepage:true},{client_id:randomUUID()}]) assert.equal(projectInputSchema.safeParse(input(bad)).success,false);
  assert.equal(projectInputSchema.safeParse(input()).success,true);
});
test('status transitions permit lifecycle changes and keep terminal states final',()=>{
  assert.ok(canTransitionProject('PLANNED','ACTIVE'));assert.ok(canTransitionProject('ACTIVE','COMPLETED'));assert.ok(canTransitionProject('ACTIVE','CANCELLED'));
  assert.equal(canTransitionProject('PLANNED','COMPLETED'),false);assert.equal(canTransitionProject('CANCELLED','ACTIVE'),false);assert.equal(canTransitionProject('COMPLETED','ACTIVE'),false);
});
test('anonymous and customer access is denied for list and mutation using the real role guard',async()=>{
  for(const principal of [null,{id:randomUUID(),roles:['admin','customer']}]) {
    const h=harness();h.state.principal=principal;
    const code=principal?'FORBIDDEN':'UNAUTHENTICATED';
    await rejectsCode(()=>h.create(),code);await rejectsCode(()=>h.api.listProjects(new Request('http://localhost/api/admin/projects')),code);
    assert.equal(h.state.projects.length,0);assert.equal(h.state.limits,0);
  }
});
test('ban or admin revocation after initial authentication prevents mutation',async()=>{
  for(const change of [{banned:true},{role:false}]){const h=harness();Object.assign(h.state,change);await rejectsCode(()=>h.create(),'FORBIDDEN');assert.equal(h.state.projects.length,0);}
});
test('standalone creation needs no fabricated order and applies mutation rate limiting',async()=>{
  const h=harness();const before=structuredClone(h.state.orders);const row=await h.create();
  assert.equal(row.orderId,null);assert.equal(row.status,'PLANNED');assert.equal(h.state.limits,1);assert.deepEqual(h.state.orders,before);
});
test('linking requires a real order and duplicate links become safe conflicts',async()=>{
  const h=harness();await rejectsCode(()=>h.create({orderId:99}),'PROJECT_ORDER_NOT_FOUND');
  const row=await h.create({orderId:7});assert.equal(row.orderId,7);
  await rejectsCode(()=>h.create({orderId:7}),'PROJECT_CONFLICT');assert.equal(h.state.projects.length,1);
});
test('cross-site writes and invalid bodies are rejected before the transaction',async()=>{
  const h=harness();await rejectsCode(()=>h.api.saveProject(request(input(),{Origin:'http://untrusted.invalid'})),'FORBIDDEN');
  await rejectsCode(()=>h.api.saveProject(request({...input(),admin:true})),'INVALID_INPUT');assert.equal(h.state.projects.length,0);
});
test('admin listing validates pagination, duplicate parameters and unknown statuses',async()=>{
  const h=harness();for(const search of ['?page=0','?page=1&page=2','?status=LAUNCHED','?limit=1000']) await rejectsCode(()=>h.api.listProjects(new Request('http://localhost/api/admin/projects'+search)),'INVALID_INPUT');
  await h.create();const result=await h.api.listProjects(new Request('http://localhost/api/admin/projects?status=PLANNED'));assert.equal(result.total,1);
});
test('stale edits, skipped lifecycle states and expired homepage deadlines are rejected',async()=>{
  const h=harness();const row=await h.create();
  await rejectsCode(()=>h.api.saveProject(request(edit(row,{status:'COMPLETED'})),row.id),'PROJECT_TRANSITION_INVALID');
  const stale=edit(row,{status:'ACTIVE'});stale.expectedUpdatedAt='2000-01-01T00:00:00.000Z';
  await rejectsCode(()=>h.api.saveProject(request(stale),row.id),'PROJECT_CONFLICT');
  await rejectsCode(()=>h.create({isPublic:true,showOnHomepage:true,deadlineAt:'2020-01-01T00:00:00Z'}),'PROJECT_DEADLINE_INVALID');
});
test('project status edits leave order status and existing order records unchanged',async()=>{
  const h=harness();const row=await h.create({orderId:7});const before=structuredClone(h.state.orders);
  const active=await h.api.saveProject(request(edit(row,{status:'ACTIVE'})),row.id);
  await h.api.saveProject(request(edit(active,{status:'CANCELLED'})),row.id);assert.deepEqual(h.state.orders,before);
});
test('same-millisecond saves advance the version and reject the previous edit token',async()=>{
  const h=harness();const row=await h.create();const payload=edit(row,{status:'ACTIVE'});const before=row.updatedAt.getTime();
  const saved=await h.api.saveProject(request(payload),row.id);assert.ok(saved.updatedAt.getTime()>before);
  await rejectsCode(()=>h.api.saveProject(request(payload),row.id),'PROJECT_CONFLICT');
});
test('serialized simultaneous selections leave exactly one selected project',async()=>{
  const h=harness();await Promise.all([h.create({isPublic:true,showOnHomepage:true}),h.create({isPublic:true,showOnHomepage:true})]);
  assert.equal(h.state.projects.length,2);assert.equal(h.state.projects.filter(row=>row.showOnHomepage).length,1);
});
test('migration independently enforces singleton selection, one order link and safe dates',()=>{
  const sql=fs.readFileSync(new URL('../prisma/migrations/202610290001_projects/migration.sql',import.meta.url),'utf8');
  assert.match(sql,/UNIQUE INDEX "projects_single_homepage_key"[\s\S]*WHERE "showOnHomepage" = true/);
  assert.match(sql,/UNIQUE INDEX "projects_orderId_key"/);assert.match(sql,/ON DELETE RESTRICT/);assert.match(sql,/projects_dates_check/);
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE "entity"\."orders")\b/i);
});
test('public data uses the eligibility predicate and contains no linked order metadata',async()=>{
  let args;
  const {getHomepageProject}=load('src/lib/projects/homepage.ts',{'@/lib/prisma':{prisma:{project:{findFirst:async query=>{args=query;return {...input(),deadlineAt:new Date(future),orderId:7,order:{client_id:'PRIVATE'}};}}}}});
  const now=new Date();const result=await getHomepageProject('fa',now);
  assert.equal(result.title,'پروژه آزمایشی');assert.deepEqual(Object.keys(result).sort(),['deadlineAt','description','title']);
  assert.equal(args.where.isPublic,true);assert.equal(args.where.showOnHomepage,undefined);assert.deepEqual(args.where.status.in,['PLANNED','ACTIVE']);assert.equal(args.where.deadlineAt.gt,now);assert.equal(args.select.order,undefined);
  assert.deepEqual(args.orderBy,[{deadlineAt:'asc'},{id:'asc'}]);
});
test('missing, private, expired and cancelled candidates yield no public project',async()=>{
  const {getHomepageProject}=load('src/lib/projects/homepage.ts',{'@/lib/prisma':{prisma:{project:{findFirst:async()=>null}}}});
  assert.equal(await getHomepageProject('en',new Date()),null);
});
test('countdown handles multi-month durations, exact deadline, invalid and past timestamps',()=>{
  const start=Date.parse('2026-01-01T00:00:00Z');
  assert.equal(countdownAt('2026-03-02T00:00:00Z',start).days,60);
  assert.equal(countdownAt('2026-01-01T00:00:00.001Z',start).seconds,1);
  for(const target of ['2026-01-01T00:00:00Z','2025-01-01T00:00:00Z','invalid']) assert.deepEqual(countdownAt(target,start),{days:0,hours:0,minutes:0,seconds:0,expired:true});
});
for (const locale of ['en','fa']) {
  const messages=JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'));
  const translator=namespace=>createTranslator({locale,messages,namespace,onError:error=>{throw error;}});
  test(locale+' countdown renders localized upcoming and expired states without a launch claim',()=>{
    const now=Date.parse('2026-01-01T00:00:00Z');
    const {ProjectCountdown}=load('src/components/templates/launch-countdown/ProjectCountdown.tsx',{
      'next-intl':{useTranslations:translator,useFormatter:()=>({number:value=>String(value),dateTime:()=> 'UTC fixture'})},
      './useCountdown':{useCountdown:(deadline,clock)=>countdownAt(deadline,clock)},
      '@/components/modules/dream-form/dream-form':{DreamForm:()=> 'notification-form-fixture'},
    });
    const project={title:input()[locale==='fa'?'titleFa':'title'],description:null,deadlineAt:'2026-01-02T00:00:00Z'};
    const upcoming=renderToStaticMarkup(ProjectCountdown({project,serverNow:now}));
    assert.ok(upcoming.includes(project.title));assert.match(upcoming,/notification-form-fixture/);
    const expired=renderToStaticMarkup(ProjectCountdown({project,serverNow:now+86400000}));
    assert.doesNotMatch(expired,/notification-form-fixture/);assert.ok(expired.includes(translator('LaunchCountdown')('deadlineReached')));
  });
  test(locale+' empty homepage is intentional and contains no countdown or notification form',async()=>{
    const {default:HomepageCountdown}=load('src/components/templates/LaunchCountdown.tsx',{
      'next/server':{connection:async()=>{}}, 'next-intl/server':{getLocale:async()=>locale,getTranslations:async()=>translator('LaunchCountdown')},
      '@/lib/projects/homepage':{getHomepageProject:async()=>null}, './launch-countdown/ProjectCountdown':{ProjectCountdown:()=> 'unexpected-countdown'},
    });
    const html=renderToStaticMarkup(await HomepageCountdown());assert.ok(html.includes(translator('LaunchCountdown')('emptyTitle')));assert.doesNotMatch(html,/unexpected-countdown|<form/);
  });
}
test('new feature catalogs have translation parity and the countdown introduces no animation',()=>{
  const en=JSON.parse(fs.readFileSync(new URL('../messages/en.json',import.meta.url),'utf8'));
  const fa=JSON.parse(fs.readFileSync(new URL('../messages/fa.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(en.AdminProjects).sort(),Object.keys(fa.AdminProjects).sort());
  assert.deepEqual(Object.keys(en.LaunchCountdown).sort(),Object.keys(fa.LaunchCountdown).sort());
  const component=fs.readFileSync(new URL('../src/components/templates/launch-countdown/ProjectCountdown.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(component,/animate-|motion\./);assert.doesNotMatch(component,/aria-live/);
});
test('identity changes cancel and clear cached admin projects along with other private queries',async()=>{
  let cancelled=false,removed=false;
  const {clearSensitiveState}=load('src/lib/auth/client-state.ts',{
    '@/store/orderStore':{useOrderStore:{getState:()=>({resetForm(){}})}},
    '@/store/userStore':{useUserStore:{getState:()=>({setActiveRole(){}})}},
  });
  await clearSensitiveState({cancelQueries:async({predicate})=>{cancelled=predicate({queryKey:['admin-projects','fa','fixture']});},removeQueries:({predicate})=>{removed=predicate({queryKey:['admin-projects','en','fixture']});}});
  assert.ok(cancelled&&removed);
});
