import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';
import {validPhoneCases,invalidPhoneCases} from './phone-normalization-fixtures.mjs';

test('phone normalization preserves national 98 prefixes and all supported equivalent formats',()=>{
  const {normalizePhone}=load('src/lib/auth/helper.ts');
  for(const {input,canonical} of validPhoneCases){assert.equal(normalizePhone(input),canonical);assert.equal(normalizePhone(canonical),canonical)}
});

test('phone normalization rejects invalid lengths, extra zeros and malformed formatting without stripping junk',()=>{
  const {normalizePhone}=load('src/lib/auth/helper.ts');
  for(const input of invalidPhoneCases)assert.throws(()=>normalizePhone(input));
});

const identity=load('src/lib/account/identity.ts');
test('usernames canonicalize ASCII case, enforce bounds, reserved names and whole-token moderation',()=>{
  assert.equal(identity.usernameSchema.parse('  Example_123  '),'example_123');
  for(const name of ['ab','x'.repeat(31),'a-b','نام','ｅxample','admin','ADMIN','support','fuck_user'])assert.equal(identity.usernameSchema.safeParse(name).success,false,name);
  for(const name of ['scunthorpe','assistant','dickens','hussein_123'])assert.equal(identity.usernameSchema.safeParse(name).success,true,name);
  for(const name of ['حسین','دانیال','امید','سیدزاده','علي'])assert.equal(identity.personalNameSchema.safeParse(name).success,true,name);
  for(const name of ['FUCK','fucker','کِیر','كير','ک‌یر'])assert.equal(identity.personalNameSchema.safeParse(name).success,false,name);
  assert.equal(identity.optionalUsernameSchema.parse(''),null);
  assert.equal(identity.publicDisplayName({fname:'حسین',lname:'سیدزاده',username:'owner_1'},'Member'),'حسین سیدزاده');
  assert.equal(identity.publicDisplayName({username:'owner_1'},'Member'),'owner_1');
  assert.equal(identity.publicDisplayName({email:'private@example.invalid',contact:'private'},'Member'),'Member');
});

test('registration unique conflicts map safely without reflecting private database details',()=>{
  const {registrationConflict}=load('src/lib/account/profile.ts',{'@/lib/prisma':{prisma:{}}});
  assert.equal(registrationConflict({code:'P2002',meta:{target:['email']}}).code,'REGISTRATION_CONFLICT');
  assert.equal(registrationConflict({code:'P2002',meta:{target:['username']}}).code,'USERNAME_TAKEN');
  assert.equal(registrationConflict({code:'P2002',meta:{target:'users_canonical_phone_key'}}).status,409);
  assert.equal(registrationConflict({code:'P1001'}),null);
});

test('ticket table sizes and error recovery preserve shared default sizes',()=>{
  const source=fs.readFileSync('src/components/modules/support/support-view.tsx','utf8');
  assert.ok(source.includes('pageSizeOptions={[10, 20, 30, 50]}'));
  const {ticketListSchema}=load('src/schemas/support.ts');
  for(const limit of [10,20,30,50])assert.equal(ticketListSchema.safeParse({limit}).success,true);
  assert.equal(ticketListSchema.safeParse({limit:100}).success,false);
  const table=fs.readFileSync('src/components/modules/data-table/data-table.tsx','utf8');
  assert.ok(table.includes('{enablePagination && <DataTablePagination'));
  assert.ok(fs.readFileSync('src/components/modules/data-table/data-table-pagination.tsx','utf8').includes('[10, 20, 30, 50, 100]'));
});

for(const locale of ['en','fa'])test('approved navigation, automatic project copy, and published package catalog in '+locale,()=>{
  const messages=JSON.parse(fs.readFileSync('messages/'+locale+'.json','utf8'));
  for(const ns of ['Account','Errors'])for(const [key,value]of Object.entries(messages[ns]))assert.ok(!/^\?+$/.test(value.replaceAll(' ','')),ns+'.'+key);
  const t=ns=>createTranslator({locale,messages,namespace:ns,onError:e=>{throw e}});
  const overrides={'next-intl':{useTranslations:t,useLocale:()=>locale},'@/hooks/useAuth':{useAuth:()=>({user:{id:'fixture',permission:'CUSTOMER',roles:[],fname:'Fixture',lname:'Member'},isAuthenticated:true})},'@/lib/i18n/navigation':{Link:({href,children})=>React.createElement('a',{href:'/'+locale+href},children)},'@/store/authModalStore':{useAuthModalStore:()=>({})},'@/components/ui/avatar':{Avatar:({children})=>children,AvatarFallback:({children})=>children}};
  const passthrough=({children})=>children;
  overrides['@/components/ui/dropdown-menu']=Object.fromEntries(['DropdownMenu','DropdownMenuContent','DropdownMenuItem','DropdownMenuLabel','DropdownMenuSeparator','DropdownMenuTrigger'].map(k=>[k,passthrough]));
  const {AuthButton}=load('src/components/modules/navbar/AuthButton.tsx',overrides);
  const html=renderToStaticMarkup(React.createElement(AuthButton));
  assert.ok(html.includes('href="/'+locale+'/order"'));assert.ok(html.includes('href="/'+locale+'/account"'));assert.ok(!html.includes('/order/review-orders'));
  assert.equal(messages.Packages.items.placeholder,undefined);
  assert.ok(t('AdminProjects')('homepageHint'));
});

test('carousel timer clears on cleanup and never advances while paused, hovered or focused',t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
  for(const states of [[true,false,false],[false,true,false],[false,false,true],[false,false,false]]){
    let state=0,callback,cleanup,cleared=0,slides=0;
    t.mock.method(globalThis,'setTimeout',(fn,delay)=>{assert.equal(delay,6000);callback=fn;return 1;});
    t.mock.method(globalThis,'clearTimeout',()=>cleared++);
    const {useRandomAutoplay:autoplay}=load('src/hooks/useRandomAutoplay.ts',{react:{useState:()=>[states[state++],()=>{}],useRef:()=>({current:null}),useCallback:fn=>fn,useEffect:fn=>{cleanup=fn()}}});
    autoplay({slideNext(){slides++}});
    if(states.some(Boolean))assert.equal(callback,undefined);else {callback();assert.equal(slides,1);}
    cleanup();if(!states.some(Boolean))assert.ok(cleared>0);
    t.mock.restoreAll();
  }
});

test('Swiper slide-change reset cannot create duplicate autoplay timer chains',t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
  let id=0,api,cleanup;const timers=new Map();
  t.mock.method(globalThis,'setTimeout',fn=>{timers.set(++id,fn);return id});t.mock.method(globalThis,'clearTimeout',key=>timers.delete(key));
  const {useRandomAutoplay:autoplay}=load('src/hooks/useRandomAutoplay.ts',{react:{useState:()=>[false,()=>{}],useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{cleanup=fn()}}});
  api=autoplay({slideNext(){api.reset()}});
  for(let i=0;i<4;i++){assert.equal(timers.size,1);const [key,fn]=[...timers][0];timers.delete(key);fn();}
  assert.equal(timers.size,1);cleanup();assert.equal(timers.size,0);
});
