// Local-only UI verification. No environment files, database calls or real SMS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const previewDir=path.join(root,'src/app/[locale]/loading-preview');
const preview=path.join(previewDir,'page.tsx');
assert.ok(!fs.existsSync(previewDir),'Refusing to overwrite an existing route');
const artifact=fs.mkdtempSync(path.join(os.tmpdir(),'dreamservice-loading-'));
const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
assert.ok(executable,'Chrome or Edge is required');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,socket;
let checks=0;
try{
  fs.mkdirSync(previewDir);
  fs.writeFileSync(preview,`"use client";
import {useEffect,useState} from "react";
import {useTranslations} from "next-intl";
import {DreamServiceLoader} from "@/components/brand/DreamServiceLoader";
import {ContentSkeleton} from "@/components/ui/content-skeleton";
import {DataTable} from "@/components/modules/data-table/data-table";
import {Button} from "@/components/ui/button";
export default function LoadingPreview(){
 const t=useTranslations("Common");
 const [state,setState]=useState({loading:false,success:false});
 useEffect(()=>{document.documentElement.dataset.loadingPreviewReady="true";return()=>{delete document.documentElement.dataset.loadingPreviewReady;};},[]);
 return <main className="mx-auto max-w-4xl space-y-5 p-5">
 <div className="flex gap-3"><button data-action="start" onClick={()=>setState({loading:true,success:false})}>Start fixture</button><button data-action="success" onClick={()=>setState({loading:false,success:true})}>Resolve fixture</button><button data-action="fail" onClick={()=>setState({loading:false,success:false})}>Reject fixture</button></div>
 <div data-brand><DreamServiceLoader loading={state.loading} success={state.success} size="lg" label={t("loading")} /></div>
 <Button pending={state.loading} completed={state.success} pendingLabel={t("loading")}>Fixture operation</Button>
 <input data-focus aria-label="Fixture focus target" />
 <DataTable columns={[{accessorKey:"value",header:"Fixture column"}]} data={state.loading?[]:[{value:"Fixture content"}]} isLoading={state.loading} enableColumnVisibility={false} enableDensityToggle={false} />
 {state.loading?<ContentSkeleton layout="form" />:<p data-ready className="ds-content-reveal">Fixture content available</p>}
 </main>;
}`);
  const base=process.argv[2] ?? 'http://localhost:3000';
  assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local server required');
  browser=spawn(executable,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+artifact,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let debugPort;for(let i=0;i<100;i++){const file=path.join(artifact,'DevToolsActivePort');if(fs.existsSync(file)){debugPort=fs.readFileSync(file,'utf8').split('\n')[0];break;}await pause(100);}assert.ok(debugPort);
  const tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();const errors=[];
  function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timeout: '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
  socket.onmessage=async event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);if(data.error)item.reject(new Error(data.error.message));else item.resolve(data.result);}}
    else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);
    else if(data.method==='Runtime.consoleAPICalled'){const text=data.params.args.map(arg=>arg.value??'').join(' ');if(/MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(text))errors.push('localization/hydration');}
    else if(data.method==='Fetch.requestPaused')await command('Fetch.fulfillRequest',{requestId:data.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,user:null})).toString('base64')});
  };
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Browser expression failed');return result.result.value;}
  async function wait(expression,label){for(let i=0;i<200;i++){if(await evaluate(expression)){checks++;return;}await pause(75);}throw new Error('Timeout: '+label);}
  const click=action=>evaluate('document.querySelector('+JSON.stringify('[data-action="'+action+'"]')+').click()');
  await command('Page.enable');await command('Runtime.enable');await command('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
  for(const locale of ['en','fa']){
    await command('Emulation.setDeviceMetricsOverride',{width:locale==='fa'?390:1365,height:1000,deviceScaleFactor:1,mobile:locale==='fa'});
    await command('Page.navigate',{url:base+'/'+locale+'/loading-preview'});
    await wait('document.documentElement?.lang==='+JSON.stringify(locale)+' && document.documentElement?.dataset.loadingPreviewReady==="true"','preview hydration');
    assert.equal(await evaluate('document.documentElement.dir'),locale==='fa'?'rtl':'ltr');checks++;
    await evaluate('window.launches=0;document.addEventListener("animationstart",e=>{if(e.animationName==="ds-arrow-release")window.launches++})');
    await click('start');await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="loading"','loading state');
    assert.ok(await evaluate('document.querySelector("tbody [data-slot=skeleton]")!==null && document.querySelector("[aria-busy=true]")!==null'));checks++;
    for(const theme of ['light','dark']){
      await evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,locale+'-'+theme+'.png'),Buffer.from(shot.data,'base64'));
    }
    await click('success');
    await wait('document.querySelector("[data-ready]")!==null','content available without animation delay');
    await evaluate('document.querySelector("[data-focus]").focus()');assert.ok(await evaluate('document.activeElement.hasAttribute("data-focus")'));checks++;
    await wait('[...document.querySelectorAll("[data-slot=dream-loader]")].every(el=>el.dataset.state==="complete")','release completes');
    assert.equal(await evaluate('window.launches'),2);checks++;
    await click('start');await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="loading"','next request');await click('fail');
    await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="complete"','failure dismissal');assert.equal(await evaluate('window.launches'),2);checks++;
    await click('start');await pause(100);await click('success');await pause(40);await click('start');await pause(300);
    assert.equal(await evaluate('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state'),'loading');checks++;
    await click('success');await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="complete"','rapid restart finishes');
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await click('start');await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="loading"','reduced loading');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-brand] .ds-loader-arrow")).animationName'),'none');checks++;
    const launches=await evaluate('window.launches');await click('success');await wait('document.querySelector("[data-brand] [data-slot=dream-loader]").dataset.state==="complete"','reduced completion');assert.equal(await evaluate('window.launches'),launches);checks++;
    await command('Emulation.setEmulatedMedia',{features:[]});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:checks,locales:['en','fa'],themes:['light','dark'],viewports:['desktop','mobile'],reducedMotion:true,databaseCalls:false,realSms:false,artifacts:artifact}));
}catch(error){
  console.error('Loading browser diagnostics: '+artifact);
  throw error;
}finally{
  socket?.close();browser?.kill();
  // Remove only the temporary fixture owned by this script, never application files.
  if(fs.existsSync(preview))fs.unlinkSync(preview);
  if(fs.existsSync(previewDir))fs.rmdirSync(previewDir);
}
