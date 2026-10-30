// Production public-page measurements and SEO/accessibility regression checks.
// No application mutations. The server is restricted to a disposable local DB.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomInt,randomBytes} from 'node:crypto';
import dotenv from 'dotenv';

const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(process.argv[2]??''),verify=process.argv[3]==='verify';
assert.ok(evidence.startsWith(path.join(root,'.backups','v1-phase1-phase2-')));
const state=JSON.parse(fs.readFileSync(path.join(evidence,'state.json'),'utf8'));
assert.ok(state.restoreVerified&&state.restoredSchemaVerified&&state.phase===2);
assert.match(state.testDatabase,/^dreamservice_phase1_test_[a-f0-9]{32}$/);
let connection=process.env.DATABASE_URL;
for(const file of ['.env.development.local','.env.local','.env.development','.env'])if(!connection&&fs.existsSync(path.join(root,file)))connection=dotenv.parse(fs.readFileSync(path.join(root,file))).DATABASE_URL;
const url=new URL(connection);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.equal(url.pathname,'/dreamservice');url.pathname='/'+state.testDatabase;
const app=path.join(evidence,'app');assert.ok(fs.existsSync(path.join(app,'.next','BUILD_ID')));
const directory=fs.mkdtempSync(path.join(evidence,'public-browser-')),port=37000+randomInt(1000),base='http://localhost:'+port;
const descriptor=fs.openSync(path.join(directory,'server.log'),'w');
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:app,windowsHide:true,stdio:['ignore',descriptor,descriptor,'ipc'],env:{...process.env,DATABASE_URL:url.toString(),SECURITY_ORIGIN:base,SECURITY_OTP_KEY:randomBytes(32).toString('hex'),SECURITY_SMS_ENABLED:'false',ORDER_NOTIFICATIONS_SMS_ENABLED:'false',OTP_DELIVERY_MODE:'disabled',PUBLIC_TEAM_PROFILE_IDS:'1,2,3',NODE_OPTIONS:'--require='+JSON.stringify(path.join(root,'scripts/v1-phase1-provider.cjs'))},
});fs.closeSync(descriptor);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const catalogs=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(app,'messages',locale+'.json'),'utf8'))]));
const result={mode:verify?'verify':'baseline',public:[],routes:[],runtimeErrors:0,server500s:0};let chrome,page;
async function connect(socketUrl){
  const socket=new WebSocket(socketUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});let next=0;const jobs=new Map(),events=new Map();
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(job){jobs.delete(message.id);if(message.error)job.reject(Error('CDP '+job.method));else job.resolve(message.result)}}else for(const fn of events.get(message.method)??[])fn(message.params)};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;jobs.set(id,{resolve,reject,method});socket.send(JSON.stringify({id,method,params}))});
  return {command,on:(name,fn)=>events.set(name,[...(events.get(name)??[]),fn]),evaluate:async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,'Browser evaluation: '+(r.exceptionDetails?.exception?.description??r.exceptionDetails?.text??''));return r.result.value},close:()=>socket.close()};
}
async function wait(expression,label){for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await pause(100)}throw Error('Browser timeout: '+label)}
async function navigate(route){const previous=await page.evaluate('performance.timeOrigin');await page.command('Network.clearBrowserCache');await page.command('Page.navigate',{url:base+route});await wait(`performance.timeOrigin !== ${previous} && document.readyState === "complete" && location.pathname === ${JSON.stringify(route)}`,'new document complete');await pause(650)}
async function press(key,code){await page.command('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});await page.command('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code})}
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/auth/me',{signal:AbortSignal.timeout(1500)})).ok){ready=true;break}}catch{}if(server.exitCode!==null)break;await pause(100)}assert.ok(ready,'Production server ready');
  const profile=fs.mkdtempSync(path.join(directory,'chrome-'));
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let debug;for(let i=0;i<100;i++){const file=path.join(profile,'DevToolsActivePort');if(fs.existsSync(file)){debug=+fs.readFileSync(file,'utf8').split('\n')[0];break}await pause(100)}assert.ok(debug,'Chrome ready');
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();page=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await page.command('Page.enable');await page.command('Runtime.enable');await page.command('Network.enable');await page.command('Network.setCacheDisabled',{cacheDisabled:true});
  await page.command('Fetch.enable',{patterns:[{urlPattern:'http*',requestStage:'Request'}]});
  page.on('Fetch.requestPaused',event=>{const allowed=new URL(event.request.url).origin===base;page.command(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:event.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})}).catch(()=>{})});
  page.on('Runtime.exceptionThrown',()=>result.runtimeErrors++);
  page.on('Network.responseReceived',event=>{if(event.response.url.startsWith(base)&&event.response.status>=500)result.server500s++});
  await page.command('Page.addScriptToEvaluateOnNewDocument',{source:`window.__phase2={cls:0,lcp:0,shifts:[]};new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){window.__phase2.cls+=e.value;window.__phase2.shifts.push({value:e.value,nodes:e.sources.map(s=>({tag:s.node?.tagName,className:typeof s.node?.className==='string'?s.node.className:'',previous:s.previousRect,current:s.currentRect}))})}}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{window.__phase2.lcp=l.getEntries().at(-1)?.startTime||0}).observe({type:'largest-contentful-paint',buffered:true});`});
  for(const locale of ['en','fa'])for(const route of ['', '/about']){
    await page.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate('/'+locale+route);
    await wait(route?`document.querySelectorAll(${JSON.stringify('a[href$=".dreamservice.net"]')}).length===3`:'!!document.querySelector("#projects .swiper")?.swiper','settled public content');
    const sample=await page.evaluate(`(()=>{const resources=performance.getEntriesByType('resource'),scripts=resources.filter(r=>r.initiatorType==='script'),meta=s=>document.querySelector(s)?.content??null;return {title:document.title,canonical:document.querySelector('link[rel=canonical]')?.href,robots:meta('meta[name=robots]'),twitter:meta('meta[name="twitter:card"]'),ogImage:meta('meta[property="og:image"]'),alternates:[...document.querySelectorAll('link[rel=alternate][hreflang]')].map(e=>({language:e.hreflang,url:e.href})),scriptRequests:scripts.length,scriptEncodedBytes:scripts.reduce((n,r)=>n+r.encodedBodySize,0),scriptDecodedBytes:scripts.reduce((n,r)=>n+r.decodedBodySize,0),teamApiRequests:resources.filter(r=>r.name.includes('/api/team')).length,skipLink:!!document.querySelector('a[href="#main-content"]'),bulletSize:(()=>{const e=document.querySelector('.swiper-pagination-bullet');if(!e)return null;const r=e.getBoundingClientRect();return {width:r.width,height:r.height}})(),cls:window.__phase2.cls,lcpMs:Math.round(window.__phase2.lcp),main:document.querySelectorAll('main').length,dir:document.documentElement.dir};})()`);
    result.public.push({locale,route:route||'/',...sample});
    if(verify&&route)assert.ok(sample.cls<0.1,'About loading should keep its footer outside the initial viewport');
    fs.writeFileSync(path.join(evidence,'layout-shifts-'+locale+(route?'-about':'-home')+'.json'),JSON.stringify(await page.evaluate('window.__phase2.shifts'),null,2));
    if(verify){assert.equal(sample.canonical,'https://dreamservice.net/'+locale+route);assert.equal(sample.twitter,'summary_large_image');assert.ok(sample.ogImage?.startsWith('https://dreamservice.net/'));assert.ok(sample.alternates.some(a=>a.language==='en'));assert.ok(sample.alternates.some(a=>a.language==='fa'));assert.ok(sample.alternates.some(a=>a.language==='x-default'));assert.equal(sample.main,1);assert.ok(sample.skipLink);if(route)assert.equal(sample.teamApiRequests,0);else assert.ok(sample.bulletSize.width>=24&&sample.bulletSize.height>=24);}
    for(const width of [1440,390])for(const theme of ['light','dark']){
      await page.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await page.evaluate(`document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(${JSON.stringify(theme)});`);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false,'Responsive overflow');
      if(!route){const layout=await page.evaluate(`(()=>{const p=document.querySelector('#projects'),u=document.querySelector('#upcoming-project');return {slides:p.querySelectorAll('.swiper-slide').length,dots:p.querySelectorAll('.swiper-pagination-bullet').length,cards:u.querySelectorAll('article').length,inside:!!u.querySelector('article [aria-label]'),gap:Math.round(u.querySelector('article').getBoundingClientRect().top-p.getBoundingClientRect().bottom)}})()`);assert.equal(layout.slides,7);assert.equal(layout.dots,7);assert.equal(layout.cards,1);assert.ok(layout.inside);assert.ok(layout.gap>=24&&layout.gap<=48);
        if(verify&&((locale==='en'&&width===1440&&theme==='light')||(locale==='fa'&&width===390&&theme==='dark'))){
          const clip=await page.evaluate(`(()=>{const p=document.querySelector('#projects').getBoundingClientRect(),u=document.querySelector('#upcoming-project').getBoundingClientRect();return {x:0,y:p.top+scrollY,width:innerWidth,height:u.bottom-p.top,scale:1}})()`);
          const screenshot=await page.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});fs.writeFileSync(path.join(evidence,'homepage-'+locale+'-'+width+'-'+theme+'.png'),Buffer.from(screenshot.data,'base64'));
        }
      }
    }
    if(!route){
      await page.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      const login=catalogs[locale].Navbar.login;
      await page.evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(login)}&&e.getClientRects().length);if(!e)throw Error('Login control missing');e.focus();e.click()})()`);
      await wait('!!document.querySelector("[role=dialog]")','lazy sign-in dialog');await wait('document.activeElement?.id==="phone"','sign-in focus');await press('Escape',27);await wait('!document.querySelector("[role=dialog]")','dialog close');
      sample.dialogFocusReturned=await page.evaluate(`document.activeElement?.textContent.trim()===${JSON.stringify(login)}`);result.public.at(-1).dialogFocusReturned=sample.dialogFocusReturned;if(verify)assert.equal(sample.dialogFocusReturned,true,'Dialog returns focus to opener');
      if(verify){await navigate('/'+locale);await press('Tab',9);assert.equal(await page.evaluate('document.activeElement?.getAttribute("href")'), '#main-content');await press('Enter',13);assert.equal(await page.evaluate('document.activeElement?.id'),'main-content');}
    }
  }
  for(const route of ['/robots.txt','/sitemap.xml','/en/order','/fa/admin/projects','/en/account','/fa/support','/en/phase2-missing-route','/fa/phase2-missing-route']){
    const response=await fetch(base+route),body=await response.text();const item={route,status:response.status,noindex:/name="robots" content="[^"]*noindex/.test(body),robotsHeader:response.headers.get('x-robots-tag'),poweredBy:response.headers.get('x-powered-by')};result.routes.push(item);
    if(verify){if(route==='/robots.txt'){assert.equal(response.status,200);assert.ok(body.includes('Sitemap: https://dreamservice.net/sitemap.xml'));assert.ok(body.includes('Allow: /'));}else if(route==='/sitemap.xml'){assert.equal(response.status,200);assert.equal((body.match(/<loc>/g)||[]).length,4);assert.ok(!/\/(admin|order|account|support)/.test(body));assert.ok(body.includes('hreflang="fa"'));}else if(route.includes('missing-route')){assert.equal(response.status,404);assert.ok(item.noindex);}else{assert.ok(item.noindex);assert.equal(item.robotsHeader,'noindex, nofollow');}assert.equal(item.poweredBy,null);}
  }
  if(verify){const image=await fetch(base+'/opengraph-image');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');const bytes=new Uint8Array(await image.arrayBuffer());assert.ok(bytes.length>1000);result.socialImageBytes=bytes.length;
    const auth=await fetch(base+'/api/auth/me');assert.equal(auth.headers.get('x-robots-tag'),'noindex, nofollow');assert.ok(auth.headers.get('cache-control').includes('no-store'));result.apiNoindexAndNoStore=true;
  }
  assert.equal(result.runtimeErrors,0);assert.equal(result.server500s,0);result.passed=true;fs.writeFileSync(path.join(evidence,'public-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){fs.writeFileSync(path.join(evidence,'public-browser-partial.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(evidence,'public-browser-failure.log'),error.stack??String(error));console.error(JSON.stringify({failed:true,evidence,message:error.message}));process.exitCode=1;
}finally{page?.close();chrome?.kill();server.kill();}
