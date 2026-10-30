// Opt-in live PostgreSQL integration. Never reads .env or targets the application DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {load} from './test-loader.mjs';
const target=new URL(process.env.TICKETS_TEST_DATABASE_URL??'http://invalid');
assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&['localhost','127.0.0.1','[::1]'].includes(target.hostname));
assert.match(target.pathname.slice(1),/^dreamservice_tickets_test_[a-f0-9]{32}$/);
assert.equal(target.pathname.slice(1),process.env.TICKETS_TEST_DATABASE_NAME);
process.env.DATABASE_URL=target.toString();process.env.SECURITY_SMS_ENABLED='false';process.env.SECURITY_ORIGIN='http://localhost';
globalThis.fetch=async()=>{throw new Error('External delivery is disabled in integration tests');};
const prisma=new PrismaClient();const peer=new PrismaClient();const context=new AsyncLocalStorage();
const hash=value=>createHash('sha256').update(value).digest('hex');
const cookies={cookies:async()=>({get:name=>name==='dream_session'&&context.getStore()?{value:context.getStore()}:undefined})};
const overrides=client=>({'@/lib/prisma':{prisma:client},'next/headers':cookies});
const app=load('src/lib/support/service.ts',overrides(prisma));const other=load('src/lib/support/service.ts',overrides(peer));
const run=(identity,fn)=>context.run(identity?.token,fn);
const request=(body,method='POST')=>new Request('http://localhost/api/support/tickets',{method,headers:{Origin:'http://localhost','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const get=(params='')=>new Request('http://localhost/api/support/tickets'+params);
const input=(extra={})=>({subject:'Isolated support fixture',body:'Initial private fixture message',orderId:null,requestKey:randomUUID(),...extra});
const reply=(body='Fixture follow-up',requestKey=randomUUID())=>request({body,requestKey});
const rejects=(fn,code)=>assert.rejects(fn,error=>error.code===code);
async function identity(role='customer',banned=false){
  const user=await prisma.user.create({data:{fname:'Ticket integration fixture',bannedAt:banned?new Date():null}});
  await prisma.personProfile.create({data:{user_id:user.id,role}});const token=randomBytes(32).toString('hex');
  await prisma.session.create({data:{userId:user.id,token:'sha256:'+hash(token),expiresAt:new Date(Date.now()+3600000)}});return {id:user.id,token};
}
function faultClient(delegate){return new Proxy(prisma,{get(target,key){
  if(key==='$transaction')return (fn,options)=>target.$transaction(tx=>fn(new Proxy(tx,{get(transaction,name){
    if(name===delegate)return {...transaction[name],create:async()=>{throw new Error('Synthetic persistence failure');}};
    return transaction[name];
  }})),options);
  const value=target[key];return typeof value==='function'?value.bind(target):value;
}});}
test('isolated PostgreSQL ticket lifecycle, authorization, concurrency and durable in-app notifications',async t=>{
  try{
    assert.equal(await prisma.supportTicket.count(),0);
    const projectFingerprint=hash(JSON.stringify(await prisma.project.findMany({orderBy:{id:'asc'}})));
    const customer=await identity();const stranger=await identity();const admin=await identity('app-admin');const wrongAdmin=await identity('admin');const banned=await identity('customer',true);
    const order=await prisma.order.create({data:{client_id:customer.id,status:'PENDING',description:'Owned support fixture'}});
    const foreignOrder=await prisma.order.create({data:{client_id:stranger.id,status:'PENDING'}});
    await t.test('anonymous, banned and non-contract admin identities are rejected',async()=>{
      await rejects(()=>run(null,()=>app.listTickets(get())),'UNAUTHENTICATED');
      await rejects(()=>run(banned,()=>app.createTicket(request(input()))),'UNAUTHENTICATED');
      for(const person of [customer,wrongAdmin])await rejects(()=>run(person,()=>app.listTickets(get(),true)),'FORBIDDEN');
    });
    await t.test('message and notification persistence failures roll back the initial ticket atomically',async()=>{
      for(const delegate of ['supportTicketMessage','supportTicketNotification']){
        const failing=load('src/lib/support/service.ts',overrides(faultClient(delegate)));
        await assert.rejects(()=>run(customer,()=>failing.createTicket(request(input()))));
        assert.equal(await prisma.supportTicket.count(),0);assert.equal(await prisma.supportTicketMessage.count(),0);assert.equal(await prisma.supportTicketNotification.count(),0);
      }
    });
    let ticket;const creation=input({orderId:order.order_id});
    await t.test('ticket, required first message and admin notification intent commit together',async()=>{
      const result=await run(customer,()=>app.createTicket(request(creation)));ticket=await prisma.supportTicket.findUniqueOrThrow({where:{id:result.id}});
      assert.equal(ticket.customerId,customer.id);assert.equal(ticket.status,'OPEN');assert.equal(ticket.priority,'NORMAL');assert.equal(ticket.orderId,order.order_id);
      assert.equal(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}}),1);
      assert.equal(await prisma.supportTicketNotification.count({where:{ticketId:ticket.id,recipientId:null}}),1);
    });
    await t.test('idempotent replay creates no duplicate messages or intents and changed payload conflicts',async()=>{
      const replay=await run(customer,()=>app.createTicket(request(creation)));assert.equal(replay.id,ticket.id);
      await rejects(()=>run(customer,()=>app.createTicket(request({...creation,body:'Changed replay'}))),'IDEMPOTENCY_CONFLICT');
      assert.equal(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}}),1);
    });
    await t.test('customer ownership is enforced on reads, replies, reopen and linked orders',async()=>{
      await rejects(()=>run(stranger,()=>app.ticketDetail(get(),ticket.id)),'NOT_FOUND');
      await rejects(()=>run(stranger,()=>app.replyToTicket(reply(),ticket.id)),'NOT_FOUND');
      await rejects(()=>run(stranger,()=>app.changeTicket(request({action:'reopen',expectedUpdatedAt:ticket.updatedAt.toISOString()},'PATCH'),ticket.id)),'NOT_FOUND');
      await rejects(()=>run(customer,()=>app.createTicket(request(input({orderId:foreignOrder.order_id})))),'TICKET_ORDER_INVALID');
      await rejects(()=>run(customer,()=>app.createTicket(request(input({orderId:2147483647})))),'TICKET_ORDER_INVALID');
      await rejects(()=>run(customer,()=>app.ownedSupportOrders(get('?selected='+foreignOrder.order_id))),'NOT_FOUND');
    });
    await t.test('standalone creation, literal search, ticket-number search, filters and summary counts work',async()=>{
      await run(customer,()=>app.createTicket(request(input({subject:'Literal 100% _ fixture'}))));
      const literal=await run(customer,()=>app.listTickets(get('?search='+encodeURIComponent('100% _'))));assert.equal(literal.total,1);
      const numbered=await run(customer,()=>app.listTickets(get('?search='+ticket.number)));assert.equal(numbered.data[0].id,ticket.id);
      const own=await run(stranger,()=>app.listTickets(get()));assert.equal(own.total,0);
      const list=await run(admin,()=>app.listTickets(get('?limit=1'),true));assert.equal(list.data.length,1);assert.ok(list.total>=2&&list.summary.OPEN>=2);
    });
    await t.test('admin replies wait for the customer and customer replies reopen the conversation',async()=>{
      await run(admin,()=>app.replyToTicket(reply('Admin response'),ticket.id,true));
      assert.equal((await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}})).status,'WAITING_FOR_CUSTOMER');
      const key=randomUUID();const saved=await run(customer,()=>app.replyToTicket(reply('Customer response',key),ticket.id));
      assert.equal((await run(customer,()=>app.replyToTicket(reply('Customer response',key),ticket.id))).id,saved.id);
      await rejects(()=>run(customer,()=>app.replyToTicket(reply('Changed response',key),ticket.id)),'IDEMPOTENCY_CONFLICT');
      assert.equal((await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}})).status,'OPEN');
    });
    async function change(actor,data,adminScope=false){const row=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});return run(actor,()=>app.changeTicket(request({...data,expectedUpdatedAt:row.updatedAt.toISOString()},'PATCH'),ticket.id,adminScope));}
    await t.test('processing, priority, closing, explicit reopen and stale versions are enforced',async()=>{
      await change(admin,{action:'status',status:'IN_PROGRESS'},true);await change(admin,{action:'priority',priority:'HIGH'},true);
      const old=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});
      await change(admin,{action:'status',status:'CLOSED'},true);const closed=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});assert.ok(closed.closedAt);
      await rejects(()=>run(customer,()=>app.replyToTicket(reply(),ticket.id)),'TICKET_CLOSED');
      await rejects(()=>change(customer,{action:'priority',priority:'LOW'}),'FORBIDDEN');
      await rejects(()=>run(admin,()=>app.changeTicket(request({action:'priority',priority:'LOW',expectedUpdatedAt:old.updatedAt.toISOString()},'PATCH'),ticket.id,true)),'TICKET_CONFLICT');
      await rejects(()=>change(admin,{action:'status',status:'OPEN'},true),'TICKET_TRANSITION_INVALID');
      await change(customer,{action:'reopen'});const reopened=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});assert.equal(reopened.status,'OPEN');assert.equal(reopened.closedAt,null);assert.equal(reopened.priority,'HIGH');
    });
    await t.test('concurrent customer/admin replies preserve both messages and the last-message lifecycle',async()=>{
      const before=await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}});
      await Promise.all([run(customer,()=>app.replyToTicket(reply('Concurrent customer'),ticket.id)),run(admin,()=>other.replyToTicket(reply('Concurrent admin'),ticket.id,true))]);
      assert.equal(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}}),before+2);
      const last=await prisma.supportTicketMessage.findFirstOrThrow({where:{ticketId:ticket.id},orderBy:[{createdAt:'desc'},{id:'desc'}]});
      const row=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});assert.equal(row.status,last.isAdmin?'WAITING_FOR_CUSTOMER':'OPEN');assert.equal(row.lastMessageAt.getTime(),last.createdAt.getTime());
    });
    await t.test('concurrent close/reply cannot save a normal reply after closure',async()=>{
      const row=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});const count=await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}});
      const results=await Promise.allSettled([run(admin,()=>app.changeTicket(request({action:'status',status:'CLOSED',expectedUpdatedAt:row.updatedAt.toISOString()},'PATCH'),ticket.id,true)),run(customer,()=>other.replyToTicket(reply('Concurrent close race'),ticket.id))]);
      assert.ok(results.some(result=>result.status==='fulfilled'));const current=await prisma.supportTicket.findUniqueOrThrow({where:{id:ticket.id}});
      if(current.status==='CLOSED'){assert.ok(current.closedAt);assert.equal(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}}),count);await change(admin,{action:'reopen'},true);}
      else assert.equal(current.closedAt,null);
    });
    await t.test('notification inbox is recipient scoped, excludes the sender and survives delivery/read failure',async()=>{
      const own=await run(customer,()=>app.ticketNotifications(get()));assert.ok(own.total>=1&&own.data.every(event=>event.ticket.id===ticket.id));
      assert.equal((await run(stranger,()=>app.ticketNotifications(get()))).total,0);
      assert.ok((await run(admin,()=>app.ticketNotifications(get(),true))).total>=1);
      const failing=load('src/lib/support/service.ts',overrides(new Proxy(prisma,{get(target,key){if(key==='supportTicketNotification')return {...target[key],findMany:async()=>{throw new Error('Synthetic inbox outage');}};const value=target[key];return typeof value==='function'?value.bind(target):value;}})));
      await assert.rejects(()=>run(customer,()=>failing.ticketNotifications(get())));
      assert.ok(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}})>1);assert.ok((await run(customer,()=>app.ticketNotifications(get()))).total>=1);
    });
    await t.test('input guards reject spoofed identities, oversized text, duplicate query parameters and unbounded pages',async()=>{
      for(const invalid of [input({body:' '}),input({subject:'x'.repeat(201)}),input({body:'x'.repeat(8001)}),input({senderId:admin.id}),input({customerId:stranger.id})])await rejects(()=>run(customer,()=>app.createTicket(request(invalid))),'INVALID_INPUT');
      for(const params of ['?limit=10000','?page=0','?page=1&page=2','?role=app-admin'])await rejects(()=>run(customer,()=>app.listTickets(get(params))),'INVALID_INPUT');
      const cross=new Request('http://localhost/api/support/tickets',{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:JSON.stringify(input())});await rejects(()=>run(customer,()=>app.createTicket(cross)),'FORBIDDEN');
    });
    await t.test('post-authentication bans and admin revocations are rechecked inside the transaction',async()=>{
      for(const revoke of ['ban','role']){
        const person=await identity('app-admin');
        const racing=load('src/lib/support/service.ts',{...overrides(prisma),'@/lib/security/rate-limit':{enforceLimits:async()=>{if(revoke==='ban')await peer.user.update({where:{id:person.id},data:{bannedAt:new Date()}});else await peer.personProfile.updateMany({where:{user_id:person.id},data:{role:'customer'}});}}});
        await rejects(()=>run(person,()=>racing.replyToTicket(reply(),ticket.id,true)),revoke==='ban'?'UNAUTHENTICATED':'FORBIDDEN');
      }
    });
    await t.test('real creation and reply rate limits apply and message pages remain bounded and complete',async()=>{
      const person=await identity();let limitedTicket;
      for(let i=0;i<10;i++){const row=await run(person,()=>app.createTicket(request(input())));limitedTicket??=row.id;}
      await rejects(()=>run(person,()=>app.createTicket(request(input()))),'TICKET_RATE_LIMIT');
      for(let i=0;i<20;i++)await run(person,()=>app.replyToTicket(reply('Page fixture '+i),limitedTicket));
      await rejects(()=>run(person,()=>app.replyToTicket(reply(),limitedTicket)),'TICKET_RATE_LIMIT');
      const ids=[];for(let page=1;page<=3;page++){const detail=await run(person,()=>app.ticketDetail(get('?limit=10&page='+page),limitedTicket));assert.equal(detail.total,21);assert.ok(detail.messages.length<=10);ids.push(...detail.messages.map(message=>message.id));}
      assert.equal(ids.length,21);assert.equal(new Set(ids).size,21);
    });
    await t.test('HTTP failures are safe, private and do not leak ticket data',async()=>{
      const route=load('src/app/api/support/tickets/[ticketId]/route.ts',overrides(prisma));
      for(const [person,status]of [[null,401],[stranger,404]]){const response=await run(person,()=>route.GET(get(),{params:Promise.resolve({ticketId:ticket.id})}));assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(Object.hasOwn(await response.json(),'ticket'),false);}
    });
    await t.test('order workflow, original project records and permanent message history are preserved',async()=>{
      assert.equal((await prisma.order.findUniqueOrThrow({where:{order_id:order.order_id}})).status,'PENDING');
      assert.equal(hash(JSON.stringify(await prisma.project.findMany({orderBy:{id:'asc'}}))),projectFingerprint);
      assert.ok(await prisma.supportTicketMessage.count({where:{ticketId:ticket.id}})>=5);
    });
  }finally{await Promise.all([prisma.$disconnect(),peer.$disconnect()]);}
});
