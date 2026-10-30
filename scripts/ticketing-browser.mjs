// Actual Next.js + PostgreSQL + Chrome. No intercepted HTTP APIs or auth bypasses.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const root=path.resolve(import.meta.dirname,'..');
const target=new URL(process.env.TICKETS_TEST_DATABASE_URL??'http://invalid');
assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&['localhost','127.0.0.1','[::1]'].includes(target.hostname));
assert.match(target.pathname.slice(1),/^dreamservice_tickets_test_[a-f0-9]{32}$/);assert.equal(target.pathname.slice(1),process.env.TICKETS_TEST_DATABASE_NAME);
const evidence=path.resolve(process.env.TICKETS_EVIDENCE_DIRECTORY??'');assert.ok(evidence.startsWith(path.join(root,'.backups')+path.sep+'ticketing-activation-'));
const directory=fs.mkdtempSync(path.join(evidence,'browser-'));const app=path.join(directory,'app');fs.mkdirSync(app);
for(const name of ['src','messages','i18n','public','package.json','package-lock.json','next.config.ts','middleware.ts','tsconfig.json','postcss.config.mjs','next-env.d.ts']){
  const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(app,name),{recursive:true});
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(app,'node_modules'),'junction');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));const hash=value=>createHash('sha256').update(value).digest('hex');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}});
const port=34000+Math.floor(Math.random()*1000);const base='http://localhost:'+port;
const log=fs.openSync(path.join(directory,'server.log'),'w');
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port',String(port)],{
  cwd:app,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,DATABASE_URL:target.toString(),SECURITY_ORIGIN:base,SECURITY_SMS_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:''},
});fs.closeSync(log);
let chrome;let page;
const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'))]));
async function cdp(url){
  const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let next=0;const pending=new Map();const listeners=new Map();
  socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){pending.delete(data.id);clearTimeout(item.timer);if(data.error)item.reject(new Error('CDP command failed'));else item.resolve(data.result);}}else for(const fn of listeners.get(data.method)??[])fn(data.params);};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!result.exceptionDetails,'Browser evaluation failed');return result.result.value;};
  return {command,evaluate,on:(name,fn)=>listeners.set(name,[...(listeners.get(name)??[]),fn]),close:()=>socket.close()};
}
async function wait(expression,label){
  for(let i=0;i<200;i++){if(await page.evaluate(expression)){console.log('Browser: '+label);return;}await pause(100);}
  const shot=await page.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,'failure.png'),Buffer.from(shot.data,'base64'));
  fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({label,text:await page.evaluate('document.body.innerText')},null,2));throw new Error('Browser timed out: '+label);
}
async function click(text,selector='button'){
  const point=await page.evaluate('(()=>{const el=Array.from(document.querySelectorAll('+JSON.stringify(selector)+')).find(el=>el.textContent.trim()==='+JSON.stringify(text)+');if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');assert.ok(point,'Missing UI control');
  await page.command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await page.command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
async function fill(id,value){await page.evaluate('(()=>{const el=document.getElementById('+JSON.stringify(id)+');const type=el.tagName==="TEXTAREA"?HTMLTextAreaElement:el.tagName==="SELECT"?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(type.prototype,"value").set.call(el,'+JSON.stringify(value)+');el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()');}
async function cookie(person){if(person)await page.command('Network.setCookie',{name:'dream_session',value:person.token,url:base,httpOnly:true,sameSite:'Lax'});else await page.command('Network.deleteCookies',{name:'dream_session',url:base});}
async function navigate(url,person){await cookie(person);await page.command('Page.navigate',{url:base+url});}
async function api(pathname,person,method='GET',body){const response=await fetch(base+pathname,{method,headers:{...(person?{Cookie:'dream_session='+person.token}:{}),...(body?{Origin:base,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
async function identity(role,banned=false){
  const user=await db.user.create({data:{fname:'Browser support fixture',bannedAt:banned?new Date():null}});await db.personProfile.create({data:{user_id:user.id,role}});
  const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,token:'sha256:'+hash(token),expiresAt:new Date(Date.now()+3600000)}});return {id:user.id,token};
}
try{
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Isolated server exited');try{if((await fetch(base+'/api/auth/me',{signal:AbortSignal.timeout(5000)})).ok){ready=true;break;}}catch{}await pause(200);}assert.ok(ready);
  for(const route of ['/en/support/new','/fa/support/new','/en/admin/tickets']){const response=await fetch(base+route,{signal:AbortSignal.timeout(120000)});assert.equal(response.status,200);await response.text();}
  const customer=await identity('customer');const admin=await identity('app-admin');const stranger=await identity('customer');const banned=await identity('customer',true);
  const order=await db.order.create({data:{client_id:customer.id,status:'PENDING',description:'Browser support owned order'}});
  const otherOrder=await db.order.create({data:{client_id:stranger.id,status:'PENDING'}});
  const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));assert.ok(executable);
  const profile=fs.mkdtempSync(path.join(directory,'chrome-'));
  chrome=spawn(executable,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let debugPort;for(let i=0;i<100;i++){try{const value=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];if(/^\d+$/.test(value)){debugPort=value;break;}}catch(error){if(!['ENOENT','EBUSY'].includes(error.code))throw error;}await pause(100);}assert.ok(debugPort);
  const tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();page=await cdp(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await page.command('Page.enable');await page.command('Runtime.enable');await page.command('Network.enable');
  const errors=[];const network=[];const documents=[];const methods=new Map();
  page.on('Network.requestWillBeSent',event=>methods.set(event.requestId,event.request.method));
  page.on('Network.responseReceived',event=>{const pathname=new URL(event.response.url).pathname;if(event.type==='Document')documents.push({status:event.response.status});if(pathname.startsWith('/api/')&&pathname.includes('ticket'))network.push({method:methods.get(event.requestId),status:event.response.status,path:pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/g,':id')});});
  page.on('Runtime.exceptionThrown',()=>errors.push('uncaught_exception'));
  page.on('Runtime.consoleAPICalled',event=>{if(/MISSING_MESSAGE|hydration[- ]mismatch|A tree hydrated/i.test(event.args.map(arg=>arg.value??'').join(' ')))errors.push('localization_or_hydration');});
  const subject='Browser support '+randomUUID().slice(0,8);const body='<img src=x onerror="globalThis.__supportXss=true"> Initial support message';const t=messages.en.Support;
  const count=await db.supportTicket.count();await navigate('/en/support/new?orderId='+order.order_id,customer);
  await wait('document.getElementById("ticket-subject")!==null','customer creation form');
  await wait('document.getElementById("ticket-order")?.value==='+JSON.stringify(String(order.order_id)),'owned order safely prefilled');
  assert.equal(await db.supportTicket.count(),count);
  await fill('ticket-subject',subject);await fill('ticket-body',body);await click(t.submit);
  await wait('document.getElementById("ticket-reply")!==null && document.querySelector("h1")?.textContent==='+JSON.stringify(subject),'customer created real linked ticket');
  const id=await page.evaluate('location.pathname.split("/").at(-1)');let row=await db.supportTicket.findUniqueOrThrow({where:{id}});assert.equal(row.customerId,customer.id);assert.equal(row.orderId,order.order_id);
  assert.equal(await page.evaluate('document.querySelector("ol [id^=message-] img")===null && globalThis.__supportXss===undefined'),true);
  assert.equal(await page.evaluate('document.title.includes('+JSON.stringify(subject)+')'),false);
  await navigate('/en/support',customer);await wait('document.querySelector("tbody")?.textContent.includes('+JSON.stringify(subject)+')','customer ticket list');
  await click(messages.en.DataTable.filters);await wait('document.getElementById("filter-search")!==null','ticket search controls');await fill('filter-search',subject);
  await wait('document.querySelectorAll("tbody tr").length===1 && document.querySelector("tbody")?.textContent.includes('+JSON.stringify(subject)+')','server subject search');
  await navigate('/en/admin/tickets',admin);await wait('document.querySelector("tbody")?.textContent.includes('+JSON.stringify(subject)+')','admin sees the same ticket');
  await navigate('/en/admin/tickets/'+id,admin);await wait('document.getElementById("ticket-reply")!==null','admin conversation');
  await fill('ticket-reply','Browser admin reply');await click(t.send);
  await wait('Array.from(document.querySelectorAll("[id^=message-]")).some(el=>el.textContent.includes("Browser admin reply"))','admin reply saved');
  row=await db.supportTicket.findUniqueOrThrow({where:{id}});assert.equal(row.status,'WAITING_FOR_CUSTOMER');
  await navigate('/en/support/'+id,customer);await wait('Array.from(document.querySelectorAll("[id^=message-]")).some(el=>el.textContent.includes("Browser admin reply"))','customer sees admin reply');
  await fill('ticket-reply','Browser customer response');await click(t.send);await wait('Array.from(document.querySelectorAll("[id^=message-]")).some(el=>el.textContent.includes("Browser customer response"))','customer response saved');
  await navigate('/en/admin/tickets/'+id,admin);await wait('document.getElementById("ticket-priority")!==null','admin controls');
  await fill('ticket-priority','HIGH');await wait('document.getElementById("ticket-priority")?.value==="HIGH" && Array.from(document.querySelectorAll("[data-slot=badge]")).some(el=>el.textContent==='+JSON.stringify(t.priorities.HIGH)+')','priority changed in browser');assert.equal((await db.supportTicket.findUniqueOrThrow({where:{id}})).priority,'HIGH');
  await fill('ticket-status','CLOSED');await wait('document.getElementById("ticket-reply")===null && Array.from(document.querySelectorAll("button")).some(el=>el.textContent.trim()==='+JSON.stringify(t.reopen)+')','admin closed ticket');
  row=await db.supportTicket.findUniqueOrThrow({where:{id}});assert.equal(row.status,'CLOSED');assert.ok(row.closedAt);
  assert.equal((await api('/api/support/tickets/'+id+'/messages',customer,'POST',{body:'Closed denial',requestKey:randomUUID()})).status,409);
  await navigate('/en/support/'+id,customer);await wait('Array.from(document.querySelectorAll("button")).some(el=>el.textContent.trim()==='+JSON.stringify(t.reopen)+')','customer explicit reopen control');await click(t.reopen);
  await wait('document.getElementById("ticket-reply")!==null','customer reopened ticket');row=await db.supportTicket.findUniqueOrThrow({where:{id}});assert.equal(row.status,'OPEN');assert.equal(row.closedAt,null);
  assert.equal(await db.supportTicketMessage.count({where:{ticketId:id}}),3);
  for(const [person,adminScope]of [[customer,false],[admin,true]]){
    await navigate('/en'+(adminScope?'/admin/tickets/':'/support/')+id,person);
    await wait('document.getElementById("ticket-reply")!==null','linked order navigation ready');
    await click(t.viewOrder,'a');
    await wait('location.pathname==="/en/order" && location.search==='+JSON.stringify('?orderId='+order.order_id),'existing protected order detail link');
    await wait('document.querySelector("[id^=order-history-]")!==null','existing order detail rendered');
    assert.equal((await api('/api/order/'+order.order_id+'/history',person)).status,200);
  }
  for(const [person,status]of [[null,401],[stranger,404],[banned,401]])assert.equal((await api('/api/support/tickets/'+id,person)).status,status);
  assert.equal((await api('/api/admin/tickets',customer)).status,403);
  assert.equal((await api('/api/support/tickets/'+id+'/messages',stranger,'POST',{body:'IDOR denial',requestKey:randomUUID()})).status,404);
  assert.equal((await api('/api/support/tickets',customer,'POST',{subject:'Cross-order denial',body:'Denied',orderId:otherOrder.order_id,requestKey:randomUUID()})).status,422);
  await navigate('/fa/support/new',customer);await wait('document.getElementById("ticket-subject")!==null','Persian creation form');
  await fill('ticket-subject','درخواست پشتیبانی مرورگر');await fill('ticket-body','پیام اولیه برای بررسی پشتیبانی فارسی');await click(messages.fa.Support.submit);
  await wait('document.querySelector("h1")?.textContent==="درخواست پشتیبانی مرورگر" && document.getElementById("ticket-reply")!==null','Persian standalone ticket created');
  const combinations=[];
  for(const locale of ['en','fa'])for(const role of ['customer','admin'])for(const width of [1365,390]){
    await page.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    await navigate('/'+locale+(role==='admin'?'/admin/tickets/':'/support/')+id,role==='admin'?admin:customer);
    await wait('document.getElementById("ticket-reply")!==null && document.querySelector("h1")?.textContent==='+JSON.stringify(subject),'real '+locale+' '+role+' detail '+width+'px');
    assert.equal(await page.evaluate('document.documentElement.dir'),locale==='fa'?'rtl':'ltr');
    assert.equal(await page.evaluate('document.querySelector("main:has(#ticket-reply)").scrollWidth>document.documentElement.clientWidth'),false);
    for(const theme of ['light','dark']){
      await page.evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');await pause(500);
      await page.evaluate('document.querySelector("h1").scrollIntoView({block:"start"})');const shot=await page.command('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(directory,locale+'-'+role+'-'+width+'-'+theme+'.png'),Buffer.from(shot.data,'base64'));combinations.push({locale,role,width,theme});
    }
  }
  await navigate('/fa/admin/tickets',admin);await wait('document.querySelector("tbody")?.textContent.includes('+JSON.stringify(subject)+')','Persian admin list');
  await navigate('/fa/support',customer);await wait('document.querySelector("tbody")?.textContent.includes('+JSON.stringify(subject)+')','Persian customer list');
  assert.equal((await db.order.findUniqueOrThrow({where:{order_id:order.order_id}})).status,'PENDING');
  assert.deepEqual(errors,[]);assert.ok(network.some(item=>item.method==='POST'&&item.status===201)&&network.some(item=>item.method==='PATCH'&&item.status===200));assert.ok(documents.every(item=>item.status===200));
  const result={passed:true,httpApisMocked:false,fullLifecycle:true,orderOwnership:true,xssSafe:true,closedReopen:true,locales:['en','fa'],combinations,network,browserErrors:errors};
  fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({browserPassed:true,fullLifecycle:true,combinations:combinations.length,locales:['en','fa'],httpApisMocked:false,evidence:path.relative(root,directory)}));
}finally{
  page?.close();chrome?.kill();spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});await db.$disconnect();
  assert.equal(path.dirname(app),directory);assert.equal(path.basename(app),'app');const junction=path.join(app,'node_modules');assert.ok(fs.lstatSync(junction).isSymbolicLink());
  fs.rmSync(junction,{recursive:true,force:true});fs.rmSync(app,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
