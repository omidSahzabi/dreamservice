// Local component browser fixtures. API requests are intercepted; no database writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
// Keep QA on the dependency drive: Next's Windows dev entry paths cannot cross
// drive letters. Sources are removed after verification, retaining only evidence.
const cacheRoot=path.join(root,'.backups');
fs.mkdirSync(cacheRoot,{recursive:true});
const artifact=fs.mkdtempSync(path.join(cacheRoot,'dreamservice-projects-browser-'));
const qaRoot=path.join(artifact,'app');
fs.mkdirSync(qaRoot);
// Copy only application sources and configuration, never .env or recovery data.
for(const entry of ['src','messages','i18n','public','package.json','package-lock.json','next.config.ts','middleware.ts','tsconfig.json','postcss.config.mjs','next-env.d.ts']){
  const source=path.join(root,entry);if(fs.existsSync(source))fs.cpSync(source,path.join(qaRoot,entry),{recursive:true});
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(qaRoot,'node_modules'),'junction');
const previewDir=path.join(qaRoot,'src/app/[locale]/projects-preview');
const preview=path.join(previewDir,'page.tsx');
assert.ok(!fs.existsSync(previewDir),'Refusing to overwrite an existing route');
const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
assert.ok(executable,'Chrome or Edge is required');
const actorId=randomUUID();
const qaPort=31000+Math.floor(Math.random()*1000);
const base='http://localhost:'+qaPort;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,socket,server;
let checks=0;
try {
  fs.mkdirSync(previewDir);
  fs.writeFileSync(preview,`"use client";
import {useState} from "react";
import {ProjectsView} from "@/components/modules/admin/projects-view";
import {ProjectCountdown} from "@/components/templates/launch-countdown/ProjectCountdown";
export default function Preview(){
 const [clock,setClock]=useState({deadline:"2099-01-01T00:00:00.000Z",now:1793275200000});
 return <main className="mx-auto max-w-6xl space-y-8 p-4">
 <button data-expire onClick={()=>setClock({deadline:new Date(Date.now()+2000).toISOString(),now:Date.now()})}>Expire fixture</button>
 <div data-countdown><ProjectCountdown key={clock.deadline} project={{title:"Public fixture",description:"Public description",deadlineAt:clock.deadline}} serverNow={clock.now}/></div>
 <ProjectsView actorId="${actorId}"/></main>;
}`);
  const log=fs.openSync(path.join(artifact,'server.log'),'w');
  server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port',String(qaPort)],{cwd:qaRoot,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,NODE_OPTIONS:'--require='+JSON.stringify(path.join(root,'scripts/no-services.cjs'))}});
  fs.closeSync(log);
  browser=spawn(executable,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+artifact,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;
  for(let i=0;i<150;i++){const file=path.join(artifact,'DevToolsActivePort');if(fs.existsSync(file)){port=fs.readFileSync(file,'utf8').split('\n')[0];break;}await pause(100);}
  assert.ok(port,'Browser did not start');
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();const errors=[];let projects=[];let mutations=0;
  function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timeout: '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
  socket.onmessage=async event=>{
    const data=JSON.parse(event.data);
    if(data.id){const item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);if(data.error)item.reject(new Error(data.error.message));else item.resolve(data.result);}return;}
    if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description??data.params.exceptionDetails.text);
    if(data.method==='Runtime.consoleAPICalled' && /MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(data.params.args.map(arg=>arg.value??'').join(' ')))errors.push('localization/hydration');
    if(data.method==='Fetch.requestPaused'){
      const {request,requestId}=data.params;const url=new URL(request.url);let body={success:false,code:'NOT_FOUND'};let status=200;
      if(url.pathname==='/api/auth/me')body={success:true,user:{id:actorId,fname:'Synthetic',lname:'Admin',contact:null,email:null,roles:['app-admin'],permission:'ADMIN'}};
      else if(url.pathname.startsWith('/api/admin/projects')){
        if(request.method==='GET')body={data:projects,total:projects.length};
        else {
          const payload=JSON.parse(request.postData);const value=request.method==='POST'?payload:payload.data;mutations++;
          const stamp=new Date().toISOString();const row={...value,id:request.method==='POST'?randomUUID():url.pathname.split('/').at(-1),createdAt:stamp,updatedAt:stamp,order:null};
          if(request.method==='POST')projects.push(row);else projects=projects.map(project=>project.id===row.id?row:project);body=row;
        }
      } else {status=404;}
      await command('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
    }
  };
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Browser expression failed: '+(result.exceptionDetails.exception?.description??result.exceptionDetails.text));return result.result.value;}
  async function wait(expression,label){for(let i=0;i<150;i++){if(await evaluate(expression)){checks++;console.log('Browser: '+label);return;}await pause(100);}
    fs.writeFileSync(path.join(artifact,'failure.json'),JSON.stringify({label,errors,text:await evaluate('document.body.innerText')},null,2));
    const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,'failure.png'),Buffer.from(shot.data,'base64'));
    throw new Error('Timeout: '+label+'; diagnostics: '+artifact);
  }
  const clickText=async text=>{
    const bounds=await evaluate('(()=>{const el=Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==='+JSON.stringify(text)+');if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    assert.ok(bounds,'Missing fixture button: '+text);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',...bounds,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',...bounds,button:'left',clickCount:1});
  };
  const fill=(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await command('Page.enable');await command('Runtime.enable');await command('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
  // Wait for our own local QA server only. No environment or real services.
  let ready=false;
  for(let i=0;i<40;i++){if(server.exitCode!==null)throw new Error('QA server exited; see private server.log');try{const response=await fetch(base+'/en/projects-preview',{signal:AbortSignal.timeout(5000)});if(response.ok){ready=true;break;}}catch{}await pause(200);}
  assert.ok(ready,'QA server did not become ready');
  for(const locale of ['en','fa']){
    const messages=JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'));
    const t=messages.AdminProjects;projects=[];
    await command('Emulation.setDeviceMetricsOverride',{width:locale==='fa'?390:1365,height:1000,deviceScaleFactor:1,mobile:locale==='fa'});
    await command('Page.navigate',{url:base+'/'+locale+'/projects-preview'});
    await wait('document.documentElement?.lang==='+JSON.stringify(locale)+' && document.querySelector("tbody")?.textContent.includes('+JSON.stringify(t.empty)+')','localized table hydration');
    assert.equal(await evaluate('document.documentElement.dir'),locale==='fa'?'rtl':'ltr');checks++;
    await pause(1500);await clickText(t.create);await wait('document.getElementById("project-title")!==null','create dialog');
    await fill('project-title','Browser project');await fill('project-titleFa','پروژه مرورگر');
    await clickText(t.review);await wait('document.querySelector("[role=dialog]")?.innerText.includes('+JSON.stringify(t.confirmSave)+')','confirmation');
    await clickText(t.confirm);await wait('document.querySelector("[role=dialog]")===null && document.querySelector("tbody")?.textContent.includes('+JSON.stringify(locale==='fa'?'پروژه مرورگر':'Browser project')+')','project created');
    await clickText(t.edit);await wait('document.getElementById("project-title")?.value==="Browser project"','edit dialog');
    await fill('project-title','Browser edited');await fill('project-titleFa','پروژه ویرایش‌شده');await clickText(t.review);await wait('document.querySelector("[role=dialog]")?.innerText.includes('+JSON.stringify(t.confirmSave)+')','edit confirmation');await clickText(t.confirm);
    await wait('document.querySelector("[role=dialog]")===null && document.querySelector("tbody")?.textContent.includes('+JSON.stringify(locale==='fa'?'پروژه ویرایش‌شده':'Browser edited')+')','project edited');
    assert.equal(projects.length,1);checks++;
    for(const theme of ['light','dark']){await evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');await pause(500);const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,locale+'-'+theme+'.png'),Buffer.from(shot.data,'base64'));checks++;}
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate('document.querySelector("[data-expire]").click()');
    await wait('document.querySelector("[data-countdown] [role=status]")!==null && document.querySelector("[data-countdown] form")===null','expired countdown hides form');
    assert.ok((await evaluate('document.querySelector("[data-countdown]").textContent')).includes(messages.LaunchCountdown.deadlineReached));checks++;
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);checks++;
    await command('Emulation.setEmulatedMedia',{features:[]});
  }
  assert.equal(mutations,4);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:checks,locales:['en','fa'],themes:['light','dark'],viewports:['desktop','mobile'],reducedMotion:true,mockedApi:true,databaseWrites:false,artifacts:artifact}));
} finally {
  socket?.close();browser?.kill();
  // Next's Windows dev launcher owns a child; stop only this script's process tree.
  if(server?.pid){const {spawnSync}=await import('node:child_process');spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}
  if(fs.existsSync(preview))fs.unlinkSync(preview);
  if(fs.existsSync(previewDir))fs.rmdirSync(previewDir);
  // Check the exact resolved target before removing only this run's source copy.
  assert.equal(path.dirname(path.resolve(qaRoot)),path.resolve(artifact));
  assert.ok(path.resolve(artifact).startsWith(path.resolve(cacheRoot)+path.sep+'dreamservice-projects-browser-'));
  const junction=path.join(qaRoot,'node_modules');
  assert.ok(fs.lstatSync(junction).isSymbolicLink());
  fs.rmSync(junction,{recursive:true,force:true});
  fs.rmSync(qaRoot,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
