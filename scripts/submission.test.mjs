import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import * as hookForm from 'react-hook-form';
const {useForm,FormProvider}=hookForm;
import {load} from './test-loader.mjs';

const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
const {createFormSchema}=load('src/schemas/orderSchema.ts');
const steps=field=>[{id:'details',title:'Fixture',order:1,fields:[{id:'field',label:'Fixture',...field}]}];
for(const locale of ['en','fa'])test('required, optional, typed and configuration-driven validation in '+locale,()=>{
  const t=createTranslator({locale,messages:messages[locale],namespace:'OrderForm'});
  const parse=(field,value)=>createFormSchema(steps(field),{field:value},t).safeParse({field:value});
  for(const type of ['text','textarea','tel'])assert.equal(parse({type,required:true},'   ').success,false);
  assert.equal(parse({type:'email',required:false,validation:{minLength:6}},'  ').success,true);
  assert.equal(parse({type:'text',required:false,validation:{minLength:6}},'').success,true);
  assert.equal(parse({type:'text',required:false,validation:{minLength:6}},'short').success,false);
  assert.equal(parse({type:'email'},' person@example.test ').data.field,'person@example.test');
  assert.equal(parse({type:'tel',validation:{pattern:'^09[0-9]{9}$'}},'۰۹۱۲۳۴۵۶۷۸۹').data.field,'09123456789');
  assert.equal(parse({type:'number',validation:{min:2,max:4}},undefined).success,true);
  for(const value of ['3',1,5,NaN])assert.equal(parse({type:'number',validation:{min:2,max:4}},value).success,false);
  assert.equal(parse({type:'number',required:true},undefined).success,false);
  assert.equal(parse({type:'select',required:true,options:[{value:'allowed',label:'Fixture'}]},'forged').success,false);
  assert.equal(parse({type:'checkbox',required:true,options:[{value:'allowed',label:'Fixture'}]},[]).success,false);
  assert.equal(parse({type:'checkbox',options:[{value:'allowed',label:'Fixture'}]},['allowed','allowed']).success,false);
});

test('submission retries reuse their key across object ordering, omitted optional fields and ambiguous failures',async()=>{
  let state={submission:null,setSubmission(value){state.submission=value;}};
  const requests=[];const invalidations=[];let fail=true;
  const errors=load('src/lib/api/errors.ts');
  const options=load('src/hooks/useOrderForm.ts',{
    '@tanstack/react-query':{useMutation:options=>options,useQueryClient:()=>({invalidateQueries:async filter=>invalidations.push(filter)})},
    'next-intl':{},'@/store/orderStore':{useOrderStore:{getState:()=>state}},
    '@/lib/api/errors':{...errors,fetchJson:async(_url,_fallback,request)=>{requests.push(request);if(fail)throw new errors.ApiError('NETWORK_ERROR');return {success:true,order_id:42};}},
  }).useSubmitOrder();
  await assert.rejects(options.mutationFn({formKey:'order',data:{type:'web',email:undefined,budget_range:'small'}}));
  const first=state.submission.key;fail=false;
  const result=await options.mutationFn({data:{budget_range:'small',type:'web'},formKey:'order'});
  assert.equal(result.order_id,42);assert.equal(state.submission.key,first);
  assert.ok(requests.every(request=>request.headers['Idempotency-Key']===first));
  await options.onSuccess(result);assert.deepEqual(invalidations,[{queryKey:['orders']}]);
  await options.mutationFn({formKey:'order',data:{type:'app',budget_range:'small'}});
  assert.notEqual(state.submission.key,first);
});

test('malformed submission responses fail safely without replacing the retry key',async()=>{
  const state={submission:null,setSubmission(value){state.submission=value;}};
  const options=load('src/hooks/useOrderForm.ts',{
    '@tanstack/react-query':{useMutation:options=>options,useQueryClient:()=>({})},'next-intl':{},
    '@/store/orderStore':{useOrderStore:{getState:()=>state}},
    '@/lib/api/errors':{...load('src/lib/api/errors.ts'),fetchJson:async()=>({success:true,order_id:-1,secret:'never displayed'})},
  }).useSubmitOrder();
  await assert.rejects(options.mutationFn({formKey:'order',data:{}}),error=>error.code==='ORDER_SUBMIT_FAILED');
  assert.ok(state.submission.key);
});

for(const locale of ['en','fa'])test('receipt and field validation render accessible localized content in '+locale,()=>{
  const intl={'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages:messages[locale],namespace})}};
  const {OrderReceipt}=load('src/features/order/submit-forn/OrderReceipt.tsx',{
    ...intl,'@/lib/i18n/navigation':{Link:({href,children,...props})=>React.createElement('a',{...props,href:'/'+locale+href},children)},
  });
  const html=renderToStaticMarkup(React.createElement(OrderReceipt,{orderId:42}));
  assert.ok(html.includes('role="status"'));assert.ok(html.includes(`dir="${locale==='fa'?'rtl':'ltr'}"`));
  assert.ok(html.includes(`href="/${locale}/order?orderId=42"`));assert.ok(html.includes(messages[locale].OrderForm.trackOrder));
  const {FieldRenderer}=load('src/features/order/submit-forn/FieldRenderer.tsx',{...intl,'react-hook-form':hookForm});
  function Fixture(){
    const methods=useForm({defaultValues:{count:3}});
    return React.createElement(FormProvider,{...methods,formState:{...methods.formState,errors:{count:{type:'min',message:'Fixture error'}}}},React.createElement(FieldRenderer,{field:{id:'count',type:'number',label:'Fixture',description:'Fixture description',required:true,validation:{min:2,max:10}}}));
  }
  const field=renderToStaticMarkup(React.createElement(Fixture));
  assert.ok(field.includes('name="count"')&&field.includes('aria-invalid="true"')&&field.includes('aria-required="true"'));
  assert.ok(field.includes('aria-describedby="count-description count-error"')&&field.includes('id="count-error"'));
});
