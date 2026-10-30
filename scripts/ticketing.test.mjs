import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';
const schemas=load('src/schemas/support.ts');
test('ticket inputs trim content, require a message, bound text and reject identity/role injection',()=>{
  const value={subject:' Help ',body:' Message ',orderId:null,requestKey:randomUUID()};
  assert.equal(schemas.ticketCreateSchema.parse(value).subject,'Help');
  for(const extra of [{body:''},{body:' '},{body:'x'.repeat(8001)},{subject:'x'.repeat(201)},{senderId:randomUUID()},{customerId:randomUUID()},{priority:'HIGH'},{isAdmin:true},{orderId:0}])assert.equal(schemas.ticketCreateSchema.safeParse({...value,...extra}).success,false);
});
test('closed status requires explicit reopen and management payloads are strict',()=>{
  for(const next of schemas.ticketStatuses)assert.equal(schemas.canChangeTicketStatus('CLOSED',next),false);
  assert.equal(schemas.canChangeTicketStatus('OPEN','IN_PROGRESS'),true);
  const expectedUpdatedAt=new Date().toISOString();
  assert.equal(schemas.ticketChangeSchema.safeParse({action:'reopen',expectedUpdatedAt}).success,true);
  assert.equal(schemas.ticketChangeSchema.safeParse({action:'reopen',expectedUpdatedAt,senderId:randomUUID()}).success,false);
  for(const value of [{limit:100000},{page:0},{status:'DELETED'},{priority:'URGENT'}])assert.equal(schemas.ticketListSchema.safeParse(value).success,false);
});
test('all ticket caches are cancelled and removed on logout or identity/permission changes',async()=>{
  const {clearSensitiveState}=load('src/lib/auth/client-state.ts',{'@/store/orderStore':{useOrderStore:{getState:()=>({resetForm(){}})}},'@/store/userStore':{useUserStore:{getState:()=>({setActiveRole(){}})}}});
  const seen=[];await clearSensitiveState({cancelQueries:async({predicate})=>{for(const key of ['support-tickets','support-ticket','support-orders','support-notifications'])assert.equal(predicate({queryKey:[key,'fixture','fa']}),true);seen.push('cancel');},removeQueries:()=>seen.push('remove')});assert.deepEqual(seen,['cancel','remove']);
});
const catalogs=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
function leaves(value,prefix=''){return Object.entries(value).flatMap(([key,item])=>typeof item==='string'?[prefix+key]:leaves(item,prefix+key+'.'));}
test('ticket catalogs have exact English/Persian key parity',()=>assert.deepEqual(leaves(catalogs.en.Support).sort(),leaves(catalogs.fa.Support).sort()));
for(const locale of ['en','fa'])test(locale+' ticket messages, statuses and priorities all interpolate without missing keys',()=>{
  const t=createTranslator({locale,messages:catalogs[locale],namespace:'Support',onError:error=>{throw error;}});
  for(const key of leaves(catalogs[locale].Support))assert.ok(t(key,{number:23,page:1,total:3}));
  const errors=createTranslator({locale,messages:catalogs[locale],namespace:'Errors',onError:error=>{throw error;}});
  for(const key of ['TICKET_CONFLICT','TICKET_CLOSED','TICKET_ORDER_INVALID','TICKET_TRANSITION_INVALID','TICKET_RATE_LIMIT'])assert.ok(errors(key,{seconds:60}));
});
test('ticket migration creates only new ticket objects and preserves application workflows',()=>{
  const sql=fs.readFileSync(new URL('../prisma/migrations/202610290002_support_ticketing/migration.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE FROM|ALTER TABLE|UPDATE "entity")\b/);
  assert.equal((sql.match(/CREATE TABLE/g)??[]).length,3);assert.match(sql,/support_tickets_closed_check/);assert.match(sql,/ON DELETE RESTRICT/);
  assert.match(sql,/support_ticket_messages_senderId_requestKey_key/);assert.match(sql,/support_ticket_notifications_messageId_key/);
});
