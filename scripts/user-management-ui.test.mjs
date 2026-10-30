import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator, createFormatter} from 'use-intl/core';
import {load} from './test-loader.mjs';

const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
const actorId='10000000-0000-4000-8000-000000000001';
const target={id:'20000000-0000-4000-8000-000000000002',fname:'Fixture',lname:'Customer',contact:'09000000001',email:null,cr:'2026-10-23T00:00:00.000Z',bannedAt:null,isAdmin:false,profiles:[]};

function render(locale,{permission='ADMIN',details=false,loading=false,error=false}={}){
  const queries=[];let states=0;
  const passthrough=({children})=>React.createElement('div',null,children);
  const {UsersView}=load('src/components/modules/admin/users-view.tsx',{
    react:{...React,useState(initial){const state=React.useState(initial);const index=states++;if(index===2&&details)return [target.id,()=>{}];if(index===3&&details)return ['ban',()=>{}];return state;}},
    'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages:messages[locale],namespace,onError:error=>{throw error;}}),useFormatter:()=>createFormatter({locale})},
    '@/hooks/useAuth':{useAuth:()=>({user:permission?{id:actorId,permission}:null,isLoading:false,isError:false})},
    '@/components/modules/auth/AccessRequired':{AccessRequired:()=>React.createElement('div',null,'Access required')},
    '@/components/ui/dialog':{Dialog:({open,children})=>open?children:null,DialogContent:passthrough,DialogTitle:passthrough,DialogDescription:passthrough},
    './data-table-filter-bar':{DataTableFilterBar:passthrough},
    '@tanstack/react-query':{
      useQueryClient:()=>({invalidateQueries:async()=>{}}),
      useQuery:options=>{queries.push(options);return options.queryKey[0]==='admin-users'?{data:{data:[target],total:11},isLoading:loading,isError:error,error:Error('Private failure'),refetch(){}}:{data:details?{user:target,orderCount:1,orders:[{order_id:42,status:'PENDING',type:'web',cr:null}]}:undefined,isLoading:false,isError:false};},
      useMutation:()=>({isPending:false,isError:false,reset(){},mutate(){}}),
    },
  });
  return {html:renderToStaticMarkup(React.createElement(UsersView,{actorId})),queries};
}

for(const locale of ['en','fa']){
  test('user management list and filters render localized states in '+locale,()=>{
    const {html,queries}=render(locale);
    assert.ok(html.includes(messages[locale].AdminUsers.title));
    assert.ok(html.includes(messages[locale].AdminUsers.searchPlaceholder));
    assert.ok(html.includes(messages[locale].AdminUsers.customer));
    assert.ok(html.includes('<bdi>'+target.contact+'</bdi>'));
    for(const query of queries){assert.equal(query.queryKey[1],locale);assert.equal(query.queryKey[2],actorId);}
    assert.ok(render(locale,{loading:true}).html.includes('aria-busy="true"'));
    const error=render(locale,{error:true}).html;
    assert.ok(error.includes('role="alert"'));assert.ok(!error.includes('Private failure'));
  });
  test('user details expose scoped orders and require confirmation reason in '+locale,()=>{
    const {html}=render(locale,{details:true});
    assert.ok(html.includes(messages[locale].AdminUsers.confirm));
    assert.ok(html.includes('id="management-reason"'));assert.ok(html.includes('required=""'));assert.ok(html.includes('maxLength="1000"'));
    assert.ok(html.includes(messages[locale].AdminUsers.recentOrders));
    assert.ok(!html.includes('>PENDING<'));
  });
}

for(const permission of [null,'CUSTOMER'])test('revoked or anonymous user cannot render cached management data: '+permission,()=>{
  const {html,queries}=render('en',{permission,details:true});
  assert.ok(html.includes('Access required'));assert.ok(!html.includes(target.contact));
  assert.ok(queries.every(query=>query.enabled===false));
});

test('additive migration preserves historical migrations and contains no destructive operations',()=>{
  const sql=fs.readFileSync(new URL('../prisma/migrations/202610230001_user_management/migration.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME)\s+(TABLE|FROM|COLUMN|"entity"|"upro")/i);
  assert.match(sql,/ADD COLUMN "bannedAt" TIMESTAMP\(3\)/);
  assert.match(sql,/CREATE TABLE "entity"\."user_management_audit"/);
  assert.match(sql,/SET LOCAL lock_timeout/);
});
