import test from 'node:test';
import assert from 'node:assert/strict';
import {Prisma} from '@prisma/client';
import {load} from './test-loader.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('a cached constructor without Project produces a safe list diagnostic and HTTP 500',async t=>{
  const diagnostics=[];t.mock.method(console,'warn',value=>diagnostics.push(JSON.parse(value)));
  const prisma={$transaction:async operation=>operation({})};
  const route=load('src/app/api/admin/projects/route.ts',{
    '@/lib/prisma':{prisma},
    '@/lib/auth/session':{getCurrentUser:async()=>({id:'synthetic-admin',roles:['app-admin']})},
  });
  const response=await route.GET(new Request('http://localhost/api/admin/projects?search=PrivateSearchFixture'));
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{success:false,code:'UNKNOWN'});
  assert.deepEqual(diagnostics.find(item=>item.event==='project_query_failed'),{
    event:'project_query_failed',operation:'list',category:'stale_prisma_client',projectDelegateReady:false,errorType:'TypeError',
  });
  assert.ok(!JSON.stringify(diagnostics).includes('PrivateSearchFixture'));
});
test('stale homepage delegate is reported as failure rather than an empty database',async t=>{
  const diagnostics=[];t.mock.method(console,'warn',value=>diagnostics.push(JSON.parse(value)));
  const {getHomepageProject}=load('src/lib/projects/homepage.ts',{'@/lib/prisma':{prisma:{}}});
  await assert.rejects(()=>getHomepageProject('en',new Date()),TypeError);
  assert.deepEqual(diagnostics[0],{event:'project_query_failed',operation:'homepage',category:'stale_prisma_client',projectDelegateReady:false,errorType:'TypeError'});
});
test('an authenticated empty list returns HTTP 200 with data and total, without diagnostics',async t=>{
  const diagnostics=[];t.mock.method(console,'warn',value=>diagnostics.push(value));
  const prisma={$transaction:async operation=>operation({project:{findMany:async()=>[],count:async()=>0}})};
  const route=load('src/app/api/admin/projects/route.ts',{'@/lib/prisma':{prisma},'@/lib/auth/session':{getCurrentUser:async()=>({id:'synthetic-admin',roles:['app-admin']})}});
  const response=await route.GET(new Request('http://localhost/api/admin/projects?page=1&limit=10'));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{data:[],total:0});assert.deepEqual(diagnostics,[]);
});
for(const [name,error,expected]of [
  ['initialization',new Prisma.PrismaClientInitializationError('Private database connection details','5.22.0','P1001'),{category:'database_initialization'}],
  ['query',new Prisma.PrismaClientKnownRequestError('Private query parameters',{clientVersion:'5.22.0',code:'P2021'}),{category:'database_query',code:'P2021'}],
  ['validation',new Prisma.PrismaClientValidationError('Private validation parameters',{clientVersion:'5.22.0'}),{category:'prisma_validation'}],
])test('project '+name+' diagnostics retain categories and exclude exception data',async t=>{
  const diagnostics=[];t.mock.method(console,'warn',value=>diagnostics.push(JSON.parse(value)));
  const {projectQuery}=load('src/lib/projects/diagnostics.ts',{'@/lib/prisma':{prisma:{project:{findFirst(){}}}}});
  await assert.rejects(()=>projectQuery('homepage',async()=>{throw error;}),candidate=>candidate===error);
  assert.deepEqual(diagnostics[0],{event:'project_query_failed',operation:'homepage',...expected,projectDelegateReady:true});
  assert.ok(!JSON.stringify(diagnostics).includes('Private'));
});
test('the streamed project view keeps a stable loading shell when auth is already cached',()=>{
  const {ProjectsView}=load('src/components/modules/admin/projects-view.tsx',{
    'next-intl':{useLocale:()=> 'en',useTranslations:()=>key=>key},
    '@tanstack/react-query':{useQuery:()=>({data:{data:[],total:0},isLoading:false,isFetching:false}),useMutation:()=>({isPending:false}),useQueryClient:()=>({})},
    '@/hooks/useAuth':{useAuth:()=>({isLoading:false,isError:false,user:{id:'fixture-admin',permission:'ADMIN'}})},
    '@/components/modules/auth/AccessRequired':{AccessRequired:()=>null},
    '@/components/modules/data-table/data-table-loading':{DataTableLoading:()=>React.createElement('div',{'data-stable-loading':'true'})},
  });
  const html=renderToStaticMarkup(React.createElement(ProjectsView,{actorId:'fixture-admin'}));
  assert.match(html,/data-stable-loading="true"/);assert.doesNotMatch(html,/<section|<table/);
});
