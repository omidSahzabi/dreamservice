import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator,createFormatter} from 'use-intl/core';
import {load} from './test-loader.mjs';

const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
function keys(value,prefix=''){return Object.entries(value).flatMap(([key,item])=>typeof item==='object'?keys(item,prefix+key+'.'):[prefix+key]).sort();}
test('workflow translations have parity and all messages interpolate in both locales',()=>{
  assert.deepEqual(keys(messages.en),keys(messages.fa));
  for(const locale of ['en','fa']){
    const t=createTranslator({locale,messages:messages[locale],namespace:'OrderWorkflow',onError:error=>{throw error;}});
    for(const key of keys(messages[locale].OrderWorkflow)){
      const text=t(key,{id:1,page:1,state:'fixture'});assert.ok(text.length>0);
      if(locale==='fa')assert.match(text,/[\u0600-\u06ff]/);
    }
    assert.ok(messages[locale].OrderStatus.NEGOTIATING);
  }
});

for(const locale of ['en','fa'])test('generic DataTable states, sorting and pagination render for '+locale,()=>{
  const {DataTable}=load('src/components/modules/data-table/data-table.tsx',{
    'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages:messages[locale],namespace}),useFormatter:()=>createFormatter({locale})},
  });
  const columns=[{accessorKey:'value',header:'Fixture'}];
  const render=props=>renderToStaticMarkup(React.createElement(DataTable,{columns,data:[],enableColumnVisibility:false,enableDensityToggle:false,...props}));
  const loading=render({isLoading:true});assert.ok(loading.includes('aria-busy="true"'));assert.ok(!loading.includes(messages[locale].DataTable.empty));
  assert.ok(render({}).includes(messages[locale].DataTable.empty));
  const error=render({errorMessage:'Fixture failure',onRetry(){}});assert.ok(error.includes('role="alert"')&&error.includes('Fixture failure'));assert.ok(!error.includes(messages[locale].DataTable.empty));
  const sorted=render({data:[{value:2},{value:1}],sorting:[{id:'value',desc:false}]});assert.ok(sorted.indexOf('>1</td>')<sorted.indexOf('>2</td>'));
  const paged=render({data:[{value:1},{value:2}],pagination:{pageIndex:1,pageSize:1}});assert.ok(paged.includes('>2</td>'));assert.ok(!paged.includes('>1</td>'));
  const server=render({data:[{value:2},{value:1}],manualPagination:true,manualSorting:true,sorting:[{id:'value',desc:false}],pageCount:4,rowCount:8,pagination:{pageIndex:2,pageSize:2}});assert.ok(server.indexOf('>2</td>')<server.indexOf('>1</td>'));
});

test('notification console delivery is development-only and contains no account or admin details',async t=>{
  const previous={NODE_ENV:process.env.NODE_ENV,OTP_DELIVERY_MODE:process.env.OTP_DELIVERY_MODE};
  t.after(()=>{for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;});
  const lines=[];t.mock.method(console,'info',(...args)=>lines.push(args));
  const {sendOrderStatusSms}=load('src/lib/auth/sms.ts',{'next-intl/server':{getTranslations:async({locale,namespace})=>createTranslator({locale,messages:messages[locale],namespace})}});
  process.env.OTP_DELIVERY_MODE='console';process.env.NODE_ENV='production';assert.equal(await sendOrderStatusSms('09000000000'),'FAILED');assert.equal(lines.length,0);
  process.env.NODE_ENV='development';assert.equal(await sendOrderStatusSms('09000000000'),'SENT');assert.equal(lines.length,1);assert.ok(!JSON.stringify(lines).includes('09000000000'));
});
