// Actual production app + disposable PostgreSQL. Credentials exist only in memory.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes, randomInt, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {PrismaClient} from '@prisma/client';

const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(process.env.PHASE1_EVIDENCE??'');
assert.ok(evidence.startsWith(path.join(root,'.backups','v1-phase1-preview-login-')));
const url=new URL(process.env.PHASE1_TEST_DATABASE_URL??'http://invalid');
assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
assert.match(url.pathname,/^\/dreamservice_phase1_test_[a-f0-9]{32}$/);assert.equal(url.pathname.slice(1),process.env.PHASE1_TEST_DATABASE_NAME);
const app=path.join(evidence,'app');assert.ok(fs.existsSync(path.join(app,'.next','BUILD_ID')));
const directory=fs.mkdtempSync(path.join(evidence,'preview-browser-'));
const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});
const password=randomBytes(32).toString('base64url'),salt=randomBytes(16);
const key=await promisify(scrypt)(password,salt,32,{N:131072,r:8,p:1,maxmem:160*1024*1024});
const hash='scrypt-v1$'+salt.toString('hex')+'$'+key.toString('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=36000+randomInt(900),base='http://localhost:'+port,disabledBase='http://localhost:'+(port+1);
const servers=[];let chrome,page;
const result={locales:[],runtimeErrors:0,server500s:0};

async function start(enabled,origin,phones){
  const descriptor=fs.openSync(path.join(directory,enabled?'enabled-server.log':'disabled-server.log'),'w');
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',new URL(origin).port],{
    cwd:app,windowsHide:true,stdio:['ignore',descriptor,descriptor,'ipc'],env:{...process.env,DATABASE_URL:url.toString(),
      SECURITY_ORIGIN:origin,SECURITY_TRUSTED_IP_HEADER:'x-preview-test-ip',VERCEL_ENV:'preview',PREVIEW_PASSWORD_LOGIN_ENABLED:String(enabled),
      PREVIEW_PASSWORD_LOGIN_HASH:hash,PREVIEW_PASSWORD_LOGIN_PHONES:phones.join(','),
      PREVIEW_PASSWORD_LOGIN_EXPIRES_AT:new Date(Math.floor((Date.now()+86400000)/1000)*1000).toISOString(),
      SECURITY_SMS_ENABLED:'false',ORDER_NOTIFICATIONS_SMS_ENABLED:'false',OTP_DELIVERY_MODE:'disabled',
      NODE_OPTIONS:'--require='+JSON.stringify(path.join(root,'scripts/v1-phase1-provider.cjs'))},
  });fs.closeSync(descriptor);servers.push(child);
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/api/auth/me',{signal:AbortSignal.timeout(1500)})).ok)return;}catch{}if(child.exitCode!==null)break;await pause(100)}throw Error('Isolated server not ready');
}
async function connect(socketUrl){
  const socket=new WebSocket(socketUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});let id=0;const jobs=new Map(),listeners=new Map();
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(job){jobs.delete(message.id);clearTimeout(job.timer);if(message.error)job.reject(Error('CDP command failed'));else job.resolve(message.result)}}else for(const fn of listeners.get(message.method)??[])fn(message.params)};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{jobs.delete(n);reject(Error('CDP timeout: '+method))},30000);jobs.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}))});
  return {command,on:(event,fn)=>listeners.set(event,[...(listeners.get(event)??[]),fn]),evaluate:async expression=>{const value=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!value.exceptionDetails,'Browser evaluation failed');return value.result.value},close:()=>{for(const job of jobs.values())clearTimeout(job.timer);socket.close();}};
}
async function wait(expression,label){for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await pause(100)}throw Error('Browser timeout: '+label)}
async function fill(id,value){await page.evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)}
async function api(route,body,cookie,ip='192.0.2.50',origin=base){
  return fetch(origin+route,{method:body?'POST':'GET',headers:{'x-preview-test-ip':ip,...(body?{Origin:origin,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
}

try{
  const people=[];
  for(const role of ['customer','app-admin','banned']){
    let phone;do{phone='09'+String(randomInt(1e9)).padStart(9,'0')}while(await db.user.findUnique({where:{contact:phone},select:{id:true}}));
    const user=await db.user.create({data:{fname:'Preview',lname:'Fixture',contact:phone,...(role==='banned'?{bannedAt:new Date()}: {})}});
    await db.personProfile.create({data:{user_id:user.id,role:role==='app-admin'?'app-admin':'customer'}});people.push({id:user.id,phone});
  }
  await start(true,base,people.map(person=>person.phone));
  await start(false,disabledBase,people.map(person=>person.phone));
  for(const locale of ['en','fa']){
    const html=await(await fetch(base+'/'+locale)).text();
    assert.ok(!html.includes(hash)&&!html.includes(password));
    assert.ok(people.every(person=>!html.includes(person.phone)));
  }
  const wrong=await api('/api/auth/preview-login',{phone:people[0].phone,password:'incorrect'},null,'192.0.2.51');
  const banned=await api('/api/auth/preview-login',{phone:people[2].phone,password},null,'192.0.2.52');
  assert.equal(wrong.status,401);assert.equal(banned.status,401);assert.deepEqual(await wrong.json(),await banned.json());
  const profileCount=await db.personProfile.count({where:{user_id:people[0].id}});
  const adminLogin=await api('/api/auth/preview-login',{phone:people[1].phone,password},null,'192.0.2.53');assert.equal(adminLogin.status,200);
  const adminCookie=adminLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await api('/api/admin/projects',null,adminCookie)).status,200);
  const disabled=await api('/api/auth/preview-login',{phone:people[0].phone,password},null,'192.0.2.54',disabledBase);assert.equal(disabled.status,401);
  assert.equal((await(await api('/api/auth/me',null,adminCookie,'192.0.2.54',disabledBase)).json()).success,false);
  assert.equal((await fetch(base+'/api/auth/preview-login')).status,405);

  const profile=fs.mkdtempSync(path.join(directory,'chrome-'));
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let debug;for(let i=0;i<150;i++){try{const file=path.join(profile,'DevToolsActivePort');if(fs.existsSync(file)){debug=+fs.readFileSync(file,'utf8').split('\n')[0];if(debug)break}}catch(error){if(error.code!=='EBUSY')throw error}await pause(100)}assert.ok(debug);
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();page=await connect(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await page.command('Page.enable');await page.command('Runtime.enable');await page.command('Network.enable');
  await page.command('Fetch.enable',{patterns:[{urlPattern:'http*',requestStage:'Request'}]});
  page.on('Fetch.requestPaused',event=>{const allowed=[base,disabledBase].includes(new URL(event.request.url).origin);page.command(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:event.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})}).catch(()=>{})});
  page.on('Runtime.exceptionThrown',()=>result.runtimeErrors++);
  page.on('Network.responseReceived',event=>{if([base,disabledBase].includes(new URL(event.response.url).origin)&&event.response.status>=500)result.server500s++});
  for(const [index,locale]of ['en','fa'].entries()){
    const messages=JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'));
    await page.command('Network.clearBrowserCookies');await page.command('Network.setExtraHTTPHeaders',{headers:{'x-preview-test-ip':'192.0.2.'+(60+index)}});
    await page.command('Emulation.setDeviceMetricsOverride',{width:locale==='fa'?1440:390,height:1000,deviceScaleFactor:1,mobile:locale==='en'});
    await page.command('Page.navigate',{url:base+'/'+locale});await wait('document.readyState==="complete"','loaded document');
    if(locale==='en'){
      await wait(`!!document.querySelector('button[aria-label='+${JSON.stringify(JSON.stringify(messages.Navbar.openMenu))}+']')`,'mobile menu');
      await page.evaluate(`document.querySelector('button[aria-label='+${JSON.stringify(JSON.stringify(messages.Navbar.openMenu))}+']').click()`);
    }
    await wait(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===${JSON.stringify(messages.Navbar.login)}&&e.getClientRects().length)`,'visible sign-in control');
    await page.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(messages.Navbar.login)}&&e.getClientRects().length);button.click()})()`);
    await wait('!!document.getElementById("preview-phone")','preview form');
    await page.evaluate(`document.querySelector('details:has(#preview-phone)').open=true;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(${JSON.stringify(locale==='fa'?'dark':'light')});`);
    assert.ok(await page.evaluate(`document.querySelector('summary').textContent===${JSON.stringify(messages.PreviewLogin.title)}`));
    assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    assert.equal(await page.evaluate('document.getElementById("preview-password").type'),'password');
    assert.ok(await page.evaluate(`(()=>{const r=document.querySelector('[role=dialog]:has(#preview-phone)').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`),'Preview dialog fits viewport');
    await fill('preview-phone',people[0].phone);await fill('preview-password',password);
    await page.evaluate('document.getElementById("preview-password").form.requestSubmit()');
    await wait('!document.getElementById("preview-phone")','preview sign-in complete');
    const me=await page.evaluate(`fetch('/api/auth/me').then(r=>r.json()).then(v=>({success:v.success,permission:v.user?.permission}))`);assert.deepEqual(me,{success:true,permission:'CUSTOMER'});
    assert.equal(await page.evaluate(`fetch('/api/admin/projects').then(r=>r.status)`),403);
    result.locales.push({locale,width:locale==='fa'?1440:390,theme:locale==='fa'?'dark':'light',login:true,customerPermission:true});
  }
  assert.equal(await db.personProfile.count({where:{user_id:people[0].id}}),profileCount);
  assert.equal((await db.user.findUnique({where:{id:people[0].id}})).contactVerifiedAt,null);
  await page.command('Page.navigate',{url:disabledBase+'/en'});await wait('document.readyState==="complete"&&location.port==='+JSON.stringify(new URL(disabledBase).port),'disabled page');
  const disabledHtml=await(await fetch(disabledBase+'/en')).text();assert.ok(!disabledHtml.includes('previewLoginEnabled":true'));
  assert.equal(result.runtimeErrors,0);assert.equal(result.server500s,0);
  result.passed=true;result.realPostgres=true;result.disabledSessionRejected=true;result.registrationAndRolesUnchanged=true;
  fs.writeFileSync(path.join(evidence,'preview-browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){console.error(JSON.stringify({failed:true,reason:error instanceof assert.AssertionError?'Browser assertion failed':error.message}));process.exitCode=1;
}finally{page?.close();chrome?.kill();for(const server of servers)server.kill();await db.$disconnect();}
