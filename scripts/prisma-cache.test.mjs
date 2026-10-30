import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './test-loader.mjs';

test('development replaces a pre-migration cached Prisma client and reuses the compatible replacement',t=>{
  const previous=globalThis.prisma;
  const nodeEnv=process.env.NODE_ENV;
  t.after(()=>{globalThis.prisma=previous;if(nodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=nodeEnv;});
  process.env.NODE_ENV='development';
  const stale={order:{updateMany(){}}};
  globalThis.prisma=stale;
  let created=0;
  class PrismaClient {
    constructor(){created++;}
    orderStatusHistory={create(){}};
    userManagementAudit={create(){}};
    project={create(){}};
    supportTicket={create(){}};
  }
  const overrides={'@prisma/client':{PrismaClient}};
  const first=load('src/lib/prisma.ts',overrides).prisma;
  assert.notEqual(first,stale);
  assert.equal(typeof first.orderStatusHistory.create,'function');
  assert.equal(globalThis.prisma,first);
  assert.equal(load('src/lib/prisma.ts',overrides).prisma,first);
  assert.equal(created,1);
});

test('stale history delegate reproduces a safe history_create diagnostic and rolls back the pending update',async t=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='development';
  t.after(()=>{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;});
  let status='PENDING';
  const diagnostics=[];t.mock.method(console,'warn',line=>diagnostics.push(JSON.parse(line)));
  const prisma={
    async $transaction(run){const before=status;try{return await run({order:{updateMany:async()=>{status='NEGOTIATING';return {count:1};}}});}catch(error){status=before;throw error;}},
  };
  const route=load('src/app/api/order/[orderId]/status/route.ts',{
    '@/lib/prisma':{prisma},
    '@/lib/auth/authorization':{requireAdmin:async()=>({id:'fixture-admin',permission:'ADMIN'})},
    '@/lib/auth/mutation':{authorizeMutation:async()=>{}},
    '@/lib/order/notifications':{deliverOrderNotification:async()=>{throw new Error('Must not run');}},
  });
  const response=await route.POST(new Request('http://localhost/api/order/1/status',{
    method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},
    body:JSON.stringify({expectedStatus:'PENDING',newStatus:'NEGOTIATING',message:'Private fixture message'}),
  }),{params:Promise.resolve({orderId:'1'})});
  assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{success:false,code:'UNKNOWN'});
  assert.equal(status,'PENDING');
  assert.deepEqual(diagnostics.find(event=>event.event==='order_workflow_failed'),{event:'order_workflow_failed',operation:'history_create',category:'stale_prisma_client'});
  assert.ok(!JSON.stringify(diagnostics).includes('Private fixture message'));
});
