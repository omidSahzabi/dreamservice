// Actual isolated production app, genuine OTP/session flow, locally mocked provider.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID,randomInt,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const root=path.resolve(import.meta.dirname,'..'),url=new URL(process.env.PHASE1_TEST_DATABASE_URL??'http://invalid');
assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.match(url.pathname,/^\/dreamservice_phase1_test_[a-f0-9]{32}$/);assert.equal(url.pathname.slice(1),process.env.PHASE1_TEST_DATABASE_NAME);
const evidence=path.resolve(process.env.PHASE1_EVIDENCE??'');assert.ok(evidence.startsWith(path.join(root,'.backups','v1-phase1-')));
const app=path.join(evidence,'app');assert.ok(fs.existsSync(path.join(app,'.next','BUILD_ID')));
const directory=fs.mkdtempSync(path.join(evidence,'browser-')),port=35000+randomInt(1000),base='http://localhost:'+port;
const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});
const log=fs.openSync(path.join(directory,'server.log'),'w'),codes=new Map();let mockDeliveries=0;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,windowsHide:true,stdio:['ignore',log,log,'ipc'],env:{...process.env,DATABASE_URL:url.toString(),SECURITY_ORIGIN:base,SECURITY_SMS_ENABLED:'true',OTP_DELIVERY_MODE:'sms',FARAZSMS_API_KEY:'phase1-local-mock',FARAZSMS_PATTERN_CODE:'phase1-local-mock',FARAZSMS_SENDER_NUMBER:'1000000000',NODE_OPTIONS:'--require='+JSON.stringify(path.join(root,'scripts/v1-phase1-provider.cjs'))}});fs.closeSync(log);
server.on('message',message=>{if(message?.type==='phase1-otp')codes.set(message.target,message.code);if(message?.type==='phase1-provider-mocked')mockDeliveries++});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),hash=value=>createHash('sha256').update(value).digest('hex');
const catalogs=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'))]));
let chrome,page;const errors=[],failures=[],diagnostics=[];
async function cdp(socketUrl){
  const socket=new WebSocket(socketUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});let next=0;const pending=new Map(),listeners=new Map();
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const job=pending.get(message.id);if(job){pending.delete(message.id);clearTimeout(job.timer);if(message.error)job.reject(Error('CDP command failed: '+job.method));else job.resolve(message.result)}}else for(const fn of listeners.get(message.method)??[])fn(message.params)};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},60000);pending.set(id,{resolve,reject,timer,method});socket.send(JSON.stringify({id,method,params}))});
  return {command,evaluate:async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,'Browser evaluation failed');return result.result.value},on:(name,fn)=>listeners.set(name,[...(listeners.get(name)??[]),fn]),close:()=>socket.close()};
}
async function wait(expression,label){for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await pause(100)}const controls=await page.evaluate(`({path:location.pathname,options:[...document.querySelectorAll('[role=option]')].map(e=>e.textContent.trim()),selects:[...document.querySelectorAll('button[role=combobox]')].map(e=>({text:e.textContent.trim(),state:e.getAttribute('data-state')}))})`);console.error(JSON.stringify({timeout:label,controls}));throw Error('Browser state timeout: '+label)}
async function navigate(route,person){const previous=await page.evaluate('performance.timeOrigin');await page.command('Network.clearBrowserCookies');if(person)await page.command('Network.setCookie',{name:'dream_session',value:person.token,url:base,httpOnly:true,sameSite:'Lax'});await page.command('Page.navigate',{url:base+route});await wait(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&location.pathname===${JSON.stringify(route.split('?')[0])}`,'new route document');await pause(250)}
async function clickSelector(selector){
  await wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&e.getClientRects().length>0&&!e.disabled})()`,'visible clickable control');
  const point=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert.ok(point,'Missing browser click target');
  await page.command('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await page.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await page.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
async function clickText(text,selector='button'){
  await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length&&!e.disabled)`,'visible text control: '+text);
  await page.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length);if(e)e.setAttribute('data-phase1-target','yes')})()`);
  await clickSelector('[data-phase1-target="yes"]');await page.evaluate(`document.querySelector('[data-phase1-target="yes"]')?.removeAttribute('data-phase1-target')`);
}
async function fill(id,value){await page.evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing form input');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`)}
async function openPageSize(){
  await wait('!!document.querySelector("button[role=combobox]")','page-size control');
  await page.evaluate('document.querySelector("button[role=combobox]").focus()');
  await page.command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
  await page.command('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
  await wait('document.querySelector("[role=option]")!==null','keyboard page-size options');
}
async function identity(role,data={}){const row=await db.user.create({data:{fname:'Browser',lname:role==='app-admin'?'Admin':'Member',...data}});await db.personProfile.create({data:{user_id:row.id,role}});const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:row.id,token:'sha256:'+hash(token),expiresAt:new Date(Date.now()+3600000)}});return {id:row.id,token}}
async function api(route,person,method='GET',body){const response=await fetch(base+route,{method,headers:{...(person?{Cookie:'dream_session='+person.token}:{}),...(body?{Origin:base,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
async function wizard(locale){
  const config=(await api('/api/order/order-form-config?locale='+locale)).data.form;
  await wait('document.querySelector("form fieldset main")!==null','order wizard');
  for(let i=0;i<config.steps.length;i++){
    for(const field of config.steps[i].fields){
      if(!await page.evaluate(`!!document.getElementById(${JSON.stringify(field.id)})`))continue;
      if(field.type==='radio'||field.type==='checkbox'){
        if(field.options?.length&&(field.type==='radio'||field.required))await clickSelector('[id='+JSON.stringify(field.id+'-'+field.options[0].value)+']');
      }else if(field.type==='select'){
        await clickSelector('[id='+JSON.stringify(field.id)+']');await wait('document.querySelector("[role=option]")!==null','form options');await clickText(field.options[0].label,'[role=option]');
      }else await fill(field.id,field.type==='number'?String(field.validation?.min??1):field.type==='tel'?'09123456789':field.type==='email'?'':'Synthetic browser project description with sufficient detail for isolated verification.');
      await pause(60);
    }
    const label=i===config.steps.length-1?(config.settings.submitButtonText||catalogs[locale].OrderForm.submit):catalogs[locale].OrderForm.next;
    await clickText(label);await pause(220);
  }
}
try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Isolated server exited');try{if((await fetch(base+'/api/auth/me',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break}}catch{}await pause(150)}assert.ok(ready);
  const executable='C:/Program Files/Google/Chrome/Application/chrome.exe',profile=fs.mkdtempSync(path.join(directory,'chrome-'));
  chrome=spawn(executable,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--host-resolver-rules=MAP *.dreamservice.net ~NOTFOUND','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let debug;for(let i=0;i<100;i++){const f=path.join(profile,'DevToolsActivePort');try{if(fs.existsSync(f)){debug=+fs.readFileSync(f,'utf8').split('\n')[0];if(debug)break}}catch(error){if(error.code!=='EBUSY')throw error}await pause(100)}assert.ok(debug);
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();page=await cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await page.command('Page.enable');await page.command('Page.bringToFront');await page.command('Runtime.enable');await page.command('Network.enable');
  page.on('Runtime.exceptionThrown',event=>{errors.push('uncaught browser exception');diagnostics.push({type:'exception',text:event.exceptionDetails.exception?.description??event.exceptionDetails.text})});
  page.on('Runtime.consoleAPICalled',event=>{const text=event.args.map(a=>a.value??'').join(' ');if(/MISSING_MESSAGE|hydration[- ]mismatch|A tree hydrated/i.test(text)){errors.push('localization or hydration');diagnostics.push({type:'console',text:text.slice(0,2000)})}});
  page.on('Network.responseReceived',event=>{const u=new URL(event.response.url);if(u.origin===base&&event.response.status>=500)failures.push({path:u.pathname,status:event.response.status})});
  const admin=await identity('app-admin'),customer=await identity('customer'),outsider=await identity('customer'),banned=await identity('customer',{bannedAt:new Date()});
  for(const locale of ['en','fa'])for(const width of [1440,390])for(const theme of ['light','dark']){
    await page.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await navigate('/'+locale,customer);await wait('!!document.querySelector("#projects .swiper")?.swiper','portfolio ready');await page.evaluate(`localStorage.setItem('theme',${JSON.stringify(theme)});document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(${JSON.stringify(theme)})`);
    const layout=await page.evaluate(`(()=>{const p=document.querySelector('#projects'),u=document.querySelector('#upcoming-project');return {main:document.querySelectorAll('main').length,slides:p.querySelectorAll('.swiper-slide').length,dots:p.querySelectorAll('.swiper-pagination-bullet').length,cards:u.querySelectorAll('article').length,inside:!!u.querySelector('article [aria-label]'),gap:Math.round(u.querySelector('article').getBoundingClientRect().top-p.getBoundingClientRect().bottom),overflow:document.documentElement.scrollWidth>innerWidth,dir:document.documentElement.dir}})()`);
    assert.equal(layout.main,1);assert.equal(layout.slides,7);assert.equal(layout.dots,7);assert.equal(layout.cards,1);assert.ok(layout.inside);assert.ok(layout.gap>=24&&layout.gap<=48);assert.equal(layout.overflow,false);assert.equal(layout.dir,locale==='fa'?'rtl':'ltr');
    await page.evaluate(`void document.querySelector('#projects .swiper').swiper.slideToLoop(0,0)`);await pause(100);await clickSelector('.swiper-button-next');await pause(450);assert.equal(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),1);
    await clickSelector('.swiper-button-prev');await pause(450);assert.equal(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),0);await clickSelector('.swiper-pagination-bullet:nth-child(4)');await pause(450);assert.equal(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),3);
    assert.equal(await page.evaluate(`document.body.textContent.includes(${JSON.stringify(locale==='en'?'Package 8':'بسته ۸')})`),false);
    const before=await page.evaluate(`getComputedStyle(document.querySelector('.swiper-slide-active').firstElementChild).transform`);assert.equal(before,'none');
    await navigate('/'+locale+'/about',customer);await wait('document.querySelectorAll(\'a[href$=".dreamservice.net"]\').length===3','published team');assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);assert.equal(await page.evaluate('[...document.images].filter(i=>i.complete&&!i.naturalWidth).length'),0);
    await navigate('/'+locale+'/account',customer);await wait('document.getElementById("account-username")?.getClientRects().length>0','responsive account profile');assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);assert.equal(await page.evaluate(`document.documentElement.classList.contains(${JSON.stringify(theme)})`),true);
    console.log(JSON.stringify({public:locale,width,theme,portfolio:7,countdownCards:1,gap:layout.gap,team:3,accountResponsive:true}));
  }
  await page.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  for(const locale of ['en','fa']){
    await navigate('/'+locale+'/order',customer);await wait('document.getElementById("customer-orders-title")!==null','customer empty panel');assert.equal(await page.evaluate('[...document.querySelectorAll("main")].filter(e=>e.getClientRects().length).length'),1);
    await navigate('/'+locale+'/account',customer);await wait('document.getElementById("account-username")!==null','account profile');const chosen='browser_'+randomUUID().replaceAll('-','').slice(0,12);
    await fill('account-username',chosen.toUpperCase());await clickText(catalogs[locale].Account.checkAvailability);await wait(`document.body.textContent.includes(${JSON.stringify(catalogs[locale].Account.available)})`,'availability');await clickText(catalogs[locale].Account.save);
    await wait(`document.getElementById('account-username')?.value===${JSON.stringify(chosen)}`,'canonical username saved');assert.equal((await db.user.findUnique({where:{id:customer.id}})).username,chosen);
    await navigate('/'+locale+'/admin/projects',admin);await wait('document.querySelector("tbody")!==null','admin projects');await clickText(catalogs[locale].AdminProjects.create);await wait('document.querySelector("[role=dialog]")!==null','project editor');assert.equal(await page.evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length`),1);assert.ok(await page.evaluate(`document.body.textContent.includes(${JSON.stringify(catalogs[locale].AdminProjects.homepageHint)})`));
    await navigate('/'+locale+'/support',customer);await wait('document.querySelector("tbody")!==null','customer tickets');await openPageSize();assert.equal(await page.evaluate(`[...document.querySelectorAll('[role=option]')].some(e=>e.textContent.trim()==='100')`),false);
    await clickText('50','[role=option]');await pause(300);assert.equal((await api('/api/support/tickets?limit=50',customer)).status,200);
    await navigate('/'+locale+'/admin/tickets',admin);await wait('document.querySelector("tbody")!==null','admin tickets');await openPageSize();assert.equal(await page.evaluate(`[...document.querySelectorAll('[role=option]')].some(e=>e.textContent.trim()==='100')`),false);await clickText('30','[role=option]');
    await navigate('/'+locale+'/order',null);await wait('document.querySelector("main h1")!==null','anonymous order gate');assert.equal(await page.evaluate('[...document.querySelectorAll("main")].filter(e=>e.getClientRects().length).length'),1);
    console.log(JSON.stringify({accountAndTickets:locale,usernameCanonical:true,validPageSizes:true,landmarks:true}));
  }
  // Actual production OTP -> registration, with only the provider transport mocked.
  await navigate('/en/order',null);await clickText(catalogs.en.Security.signIn);await wait('document.getElementById("phone")!==null','sign in dialog');
  const canonical='09'+String(randomInt(0,1e9)).padStart(9,'0');await fill('phone',canonical);await clickText(catalogs.en.AuthModal.button.sendOtp);await wait('document.getElementById("code")!==null','OTP entry');assert.ok(codes.has(hash(canonical)));await fill('code',codes.get(hash(canonical)));await clickText(catalogs.en.AuthModal.button.verify);await wait('document.getElementById("registration-username")!==null','registration');
  const chosen='registered_'+randomUUID().replaceAll('-','').slice(0,10);await fill('fname','Browser');await fill('lname','Registration');await fill('registration-username',chosen.toUpperCase());await clickText(catalogs.en.Account.checkAvailability);await wait(`document.body.textContent.includes(${JSON.stringify(catalogs.en.Account.available)})`,'registration availability');await clickText(catalogs.en.AuthModal.button.register);
  await wait('document.querySelector("[role=dialog]")===null','registration complete');const registered=await db.user.findUniqueOrThrow({where:{contact:canonical}});assert.equal(registered.username,chosen);
  console.log(JSON.stringify({realOtpRegistration:true,mockedProvider:true,usernameCanonical:true}));
  await navigate('/en/order/order-form',customer);await wizard('en');await wait('document.querySelector("form fieldset main")===null','order receipt');const created=await db.order.findFirstOrThrow({where:{client_id:customer.id,status:'PENDING'},orderBy:{order_id:'desc'}});
  await navigate('/en/order/order-form',customer);await wizard('en');await wait(`!!document.querySelector('a[href="/en/order?orderId=${created.order_id}"]')`,'open-order error link');assert.equal(await db.order.count({where:{client_id:customer.id,status:'PENDING'}}),1);
  assert.equal((await api('/api/order/'+created.order_id+'/history',outsider)).status,404);assert.equal((await api('/api/admin/projects',customer)).status,403);assert.equal((await api('/api/account/profile',banned,'PATCH',{username:'not_allowed'})).status,401);
  // Real focus/pause/resume timers in the same production carousel.
  await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await navigate('/en',customer);await wait('!!document.querySelector("#projects .swiper")?.swiper','autoplay');await page.evaluate(`document.querySelector('.swiper-button-next').focus()`);const focused=await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`);await pause(6500);assert.equal(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),focused);
  await clickText(catalogs.en.Projects.pause);await page.evaluate('document.activeElement.blur()');await page.command('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});const paused=await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`);await pause(6500);assert.equal(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),paused);
  await clickText(catalogs.en.Projects.resume);await page.evaluate('document.activeElement.blur()');await page.command('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await pause(6500);assert.notEqual(await page.evaluate(`document.querySelector('#projects .swiper').swiper.realIndex`),paused);
  assert.ok(mockDeliveries>0);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log(JSON.stringify({browserPassed:true,orderCreateAndConflict:true,ownership:true,focusPauseResume:true,runtimeErrors:0,server500s:0,mockedProviderCalls:mockDeliveries}));
}catch(error){console.error(JSON.stringify({browserFailed:true,reason:error instanceof assert.AssertionError?error.message.split('\n')[0]:error.message,line:/v1-phase1-browser\.mjs:(\d+)/.exec(error.stack??'')?.[1],...(typeof error.actual==='number'||typeof error.actual==='boolean'?{actual:error.actual}:{}),...(typeof error.expected==='number'||typeof error.expected==='boolean'?{expected:error.expected}:{}),landmarks:page?await page.evaluate('[...document.querySelectorAll("main")].map(e=>({visible:!!e.getClientRects().length,className:e.className,parent:e.parentElement.tagName,hidden:!!e.closest("[hidden]")}))').catch(()=>[]):[]}));process.exitCode=1;}
finally{fs.writeFileSync(path.join(directory,'diagnostics.json'),JSON.stringify({errors,failures,diagnostics},null,2));page?.close();chrome?.kill();server.kill();await db.$disconnect();}
