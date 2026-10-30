import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator,createFormatter} from 'use-intl/core';
import {NextRequest} from 'next/server.js';
import {load} from './test-loader.mjs';

const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
const decision={id:'10000000-0000-4000-8000-000000000001',previousStatus:'PENDING',newStatus:'NEGOTIATING',message:'Fixture admin message <script>unsafe</script>',createdAt:'2026-10-22T12:00:00.000Z'};
const order={order_id:42,client_id:'00000000-0000-4000-8000-000000000042',status:'NEGOTIATING',type:'website',budget_range:'small',page_count:3,description:'Fixture project description',cr:null,meta:null,latestDecision:{message:decision.message,createdAt:decision.createdAt}};
const list={data:[order],pagination:{page:1,limit:10,total:1,totalPages:1,hasNextPage:false,hasPrevPage:false}};

function environment(locale,{listQuery={},historyQuery={}}={}){
  let listCalls=0,historyCalls=0;
  const queries=[];
  const intl={useLocale:()=>locale,useFormatter:()=>createFormatter({locale,timeZone:'Asia/Tehran'}),useTranslations:namespace=>createTranslator({locale,messages:messages[locale],namespace,onError:error=>{throw error;}})};
  const overrides={
    'next-intl':intl,
    '@/lib/i18n/navigation':{Link:({href,children,...props})=>React.createElement('a',{...props,href:'/'+locale+href},children)},
    '@/hooks/useAuth':{useAuth:()=>({user:{id:order.client_id,permission:'CUSTOMER'}})},
    '@/hooks/useOrderForm':{useOrderFormConfig:()=>({data:{form:{steps:[{fields:[{id:'service_type',options:[{value:'website',label:locale==='en'?'Website':'وب‌سایت'}]},{id:'budget_range',options:[{value:'small',label:locale==='en'?'Small budget':'بودجه کم'}]}]}]}}})},
    '@/features/order/review-orders/hooks/use-review-orders':{useReviewOrders:()=>{listCalls++;return {data:list,isPending:false,isError:false,isFetching:false,refetch(){},...listQuery};}},
    '@tanstack/react-query':{
      useQuery:options=>{historyCalls++;queries.push(options);return {data:{success:true,order,history:[decision]},isPending:false,isError:false,isFetching:false,dataUpdatedAt:Date.parse(decision.createdAt),refetch(){},...historyQuery};},
      useMutation:()=>({isError:false,isPending:false,mutate(){}}),useQueryClient:()=>({invalidateQueries:async()=>{}}),
    },
  };
  return {overrides,queries,get listCalls(){return listCalls;},get historyCalls(){return historyCalls;},render(file,component,props={}){return renderToStaticMarkup(React.createElement(load(file,overrides)[component],props));}};
}

for(const locale of ['en','fa']){
  test('customer cards show localized status, latest decision, responsive links and no per-card history request in '+locale,()=>{
    const env=environment(locale);const html=env.render('src/features/order/workflow/CustomerOrders.tsx','CustomerOrders');
    assert.ok(html.includes(messages[locale].OrderStatus.NEGOTIATING));
    assert.ok(html.includes('Fixture admin message &lt;script&gt;unsafe&lt;/script&gt;'));
    assert.ok(!html.includes('<script>unsafe'));
    assert.ok(html.includes('href="/'+locale+'/order?orderId=42"'));
    assert.ok(html.includes('aria-labelledby="order-42-title"')&&html.includes('dateTime="'+decision.createdAt+'"'));
    assert.ok(html.includes('dir="'+(locale==='fa'?'rtl':'ltr')+'"'));
    assert.ok(html.includes('min-w-0')&&html.includes('sm:p-6')&&html.includes('bg-card')&&html.includes('w-full sm:w-auto'));
    assert.equal(env.historyCalls,0);assert.equal(env.listCalls,1);
  });
  test('direct tracking renders the selected order, complete message and expandable history in '+locale,()=>{
    const env=environment(locale);const html=env.render('src/features/order/workflow/CustomerOrders.tsx','CustomerOrders',{orderId:42});
    assert.equal(env.listCalls,0);assert.equal(env.historyCalls,1);
    assert.deepEqual(env.queries[0].queryKey,['order-history',order.client_id,'CUSTOMER',42]);
    assert.ok(html.includes('Fixture project description')&&html.includes('Fixture admin message'));
    assert.ok(html.includes('<details')&&html.includes('<summary')&&html.includes('<ol'));
    assert.ok(html.includes('href="/'+locale+'/order"'));
    assert.ok(html.includes(messages[locale].CustomerPanel.lastDecision));
    assert.ok(html.includes('rtl:rotate-180')&&html.includes('break-words'));
  });
  test('loading, empty, failure, retry and invalid tracking states are explicit in '+locale,()=>{
    const file='src/features/order/workflow/CustomerOrders.tsx';
    const pending=environment(locale,{listQuery:{data:undefined,isPending:true,isFetching:true}}).render(file,'CustomerOrders');
    assert.ok(pending.includes('role="status"')&&pending.includes('aria-busy="true"'));
    const empty=environment(locale,{listQuery:{data:{data:[],pagination:{...list.pagination,total:0,totalPages:0}}}}).render(file,'CustomerOrders');
    assert.ok(empty.includes(messages[locale].OrderWorkflow.noOrders)&&empty.includes('href="/'+locale+'/order/order-form"'));
    const error=new (load('src/lib/api/errors.ts').ApiError)('ORDER_LOAD_FAILED');
    const failed=environment(locale,{listQuery:{isError:true,error}}).render(file,'CustomerOrders');
    assert.ok(failed.includes('role="alert"')&&failed.includes(messages[locale].OrderWorkflow.retry));assert.ok(!failed.includes('Fixture admin message'));
    const invalid=environment(locale);const malformed=invalid.render(file,'CustomerOrders',{invalidOrderId:true});
    assert.ok(malformed.includes(messages[locale].CustomerPanel.invalidOrder));assert.equal(invalid.listCalls+invalid.historyCalls,0);
    const inaccessible=environment(locale,{historyQuery:{isError:true,error}}).render(file,'CustomerOrders',{orderId:42});
    assert.ok(inaccessible.includes('role="alert"'));assert.ok(!inaccessible.includes('Fixture project description'));
    const initial=environment(locale,{historyQuery:{data:{success:true,order:{...order,status:'PENDING'},history:[]}}}).render(file,'CustomerOrders',{orderId:42});
    assert.ok(initial.includes(messages[locale].OrderStatus.PENDING)&&initial.includes(messages[locale].CustomerPanel.awaitingDecision));
  });
  test('all supported badges and unknown historical statuses remain localized in '+locale,()=>{
    const env=environment(locale);
    for(const status of ['PENDING','NEGOTIATING','PROCESSING','REJECTED','COMPLETED','CANCELLED'])assert.ok(env.render('src/features/order/review-orders/components/order-status-badge.tsx','OrderStatusBadge',{status}).includes(messages[locale].OrderStatus[status]));
    assert.ok(env.render('src/features/order/review-orders/components/order-status-badge.tsx','OrderStatusBadge',{status:'LEGACY'}).includes(messages[locale].Common.unknown));
  });
}

test('receipt links select the exact order independently of list pagination and reject malformed/repeated IDs',async()=>{
  const overrides={
    'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/i18n/metadata':{},
    '@/lib/i18n/navigation':{Link:({href,children})=>React.createElement('a',{href},children)},
    '@/lib/auth/authorization':{getAuthenticatedPrincipal:async()=>({id:order.client_id,permission:'CUSTOMER'})},
    '@/features/order/workflow/CustomerOrders':{CustomerOrders:props=>React.createElement('div',{'data-order-id':props.orderId,'data-invalid':props.invalidOrderId})},
    '@/components/modules/auth/AccessRequired':{AccessRequired:()=>null},
  };
  const page=load('src/app/[locale]/order/page.tsx',overrides).default;
  const selected=renderToStaticMarkup(await page({searchParams:Promise.resolve({orderId:'42'})}));
  assert.ok(selected.includes('data-order-id="42"')&&selected.includes('data-invalid="false"'));
  for(const orderId of ['0','-1','1.5','2147483648',['42','43']]){
    const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({orderId})}));assert.ok(html.includes('data-invalid="true"'));assert.ok(!html.includes('data-order-id'));
  }
});

test('history API verifies session ownership before querying messages and minimizes customer details',async()=>{
  let identity={id:order.client_id,roles:[]};let historyReads=0;
  const http=load('src/lib/security/http.ts');
  const authorization=load('src/lib/auth/authorization.ts',{'@/lib/auth/session':{getCurrentUser:async()=>identity},'@/lib/security/http':http});
  const route=load('src/app/api/order/[orderId]/history/route.ts',{
    '@/lib/auth/authorization':authorization,
    '@/lib/security/http':http,
    '@/lib/prisma':{prisma:{order:{findUnique:async({where})=>where.order_id===42?order:null},orderStatusHistory:{findMany:async({select})=>{historyReads++;assert.equal(select.adminUserId,undefined);assert.equal(select.notificationState,undefined);return [decision];}}}},
  });
  const read=()=>route.GET(new Request('http://localhost/api/order/42/history'),{params:Promise.resolve({orderId:'42'})});
  const own=await read();assert.equal(own.status,200);const body=await own.json();assert.equal(body.order.description,order.description);assert.equal(body.history[0].message,decision.message);assert.equal('client_id' in body.order,false);assert.equal('meta' in body.order,false);
  const count=historyReads;identity={id:'other-customer',roles:[]};assert.equal((await read()).status,404);assert.equal(historyReads,count);
  identity=null;assert.equal((await read()).status,401);assert.equal(historyReads,count);
});

test('list API scopes latest decisions to session-owned orders and exposes only message and timestamp',async()=>{
  const authorization=load('src/lib/auth/authorization.ts',{'@/lib/auth/session':{getCurrentUser:async()=>({id:order.client_id,roles:[]})}});
  const route=load('src/app/api/order/load-orders/route.ts',{
    '@/lib/auth/authorization':authorization,
    '@/lib/prisma':{prisma:{$transaction:operations=>Promise.all(operations),order:{count:async({where})=>{assert.equal(where.client_id,order.client_id);return 1;},findMany:async({where,select})=>{assert.equal(where.client_id,order.client_id);assert.equal(select.statusHistory.take,1);assert.deepEqual(select.statusHistory.select,{message:true,createdAt:true});return [{...order,statusHistory:[order.latestDecision]}];}}}},
  });
  const response=await route.GET(new NextRequest('http://localhost/api/order/load-orders'));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.data[0].latestDecision,order.latestDecision);assert.equal('statusHistory' in body.data[0],false);assert.equal(body.data[0].meta,null);
  assert.equal((await route.GET(new NextRequest('http://localhost/api/order/load-orders?client_id=00000000-0000-4000-8000-000000000043'))).status,403);
});
