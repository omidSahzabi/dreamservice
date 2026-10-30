// Local real-runtime verification. No mocked HTTP APIs and no original-data writes.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, randomBytes, createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const mode=process.argv[2]??'diagnose';
const directory=process.argv[3]?path.resolve(root,process.argv[3]):path.join(root,'.backups','projects-runtime-'+new Date().toISOString().replace(/\D/g,''));
assert.ok(directory.startsWith(path.join(root,'.backups')+path.sep+'projects-runtime-'));
fs.mkdirSync(directory,{recursive:true});
const stateFile=path.join(directory,'state.json');
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binary='C:/Program Files/PostgreSQL/18/bin';
function execute(executable,args,env,label){
  const result=spawnSync(executable,args,{cwd:directory,env,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
  fs.writeFileSync(path.join(directory,label+'.log'),(result.stdout??'')+(result.stderr??''));
  if(result.error||result.status!==0)throw new Error(label+' failed; private evidence retained');
  return result.stdout.trim();
}
function databaseTarget(){
  const match=fs.readFileSync(path.join(root,'.env'),'utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m);
  assert.ok(match);
  const target=new URL(match[1].trim().replace(/^(["'])(.*)\1$/,'$2'));
  assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&
    decodeURIComponent(target.pathname.slice(1))==='dreamservice'&&(!target.port||target.port==='5432'));
  return target;
}
function databaseEnvironment(name,readOnly=false){
  const target=databaseTarget();target.pathname='/'+name;
  return {...process.env,DATABASE_URL:target.toString(),PGHOST:target.hostname,PGPORT:target.port||'5432',PGUSER:decodeURIComponent(target.username),
    PGPASSWORD:decodeURIComponent(target.password),PGDATABASE:name,PGCONNECT_TIMEOUT:'5',
    PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=5000'+(readOnly?' -c default_transaction_read_only=on':''),
    PRISMA_SCHEMA_ENGINE_BINARY:path.join(root,'node_modules/@prisma/engines/schema-engine-windows.exe'),
    PRISMA_QUERY_ENGINE_LIBRARY:path.join(root,'node_modules/@prisma/engines/query_engine-windows.dll.node'),
    CHECKPOINT_DISABLE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'true',SECURITY_SMS_ENABLED:'false'};
}
function query(database,sql){return JSON.parse(execute(path.join(binary,'psql.exe'),['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],databaseEnvironment(database,true),'read-only-query'));}
function originalSnapshot(){
  const tables=query('dreamservice',`SELECT json_agg(t ORDER BY schema,name) FROM (SELECT table_schema AS schema,table_name AS name FROM information_schema.tables WHERE table_schema IN ('entity','public','upro') AND table_type='BASE TABLE') t`);
  const contents={};
  const quote=value=>'"'+value.replaceAll('"','""')+'"';
  for(const table of tables)contents[table.schema+'.'+table.name]=query('dreamservice',`SELECT json_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(hash,'' ORDER BY hash),''))) FROM (SELECT md5(to_jsonb(t)::text) AS hash FROM ${quote(table.schema)}.${quote(table.name)} t) rows`);
  const indexes=query('dreamservice',`SELECT json_agg(i ORDER BY schema,name) FROM (SELECT n.nspname AS schema,c.relname AS name,c.oid,c.relfilenode,pg_get_indexdef(c.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index x ON x.indexrelid=c.oid WHERE n.nspname IN ('entity','public','upro')) i`);
  const migrations=Object.fromEntries(fs.readdirSync(path.join(root,'prisma/migrations'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>[entry.name,hash(fs.readFileSync(path.join(root,'prisma/migrations',entry.name,'migration.sql')))]));
  return {tables:contents,indexes,migrations};
}
function copyApplication(){
  const app=path.join(directory,'app');assert.ok(!fs.existsSync(app));fs.mkdirSync(app);
  for(const entry of ['src','messages','i18n','public','package.json','package-lock.json','next.config.ts','middleware.ts','tsconfig.json','postcss.config.mjs','next-env.d.ts']){
    const source=path.join(root,entry);if(fs.existsSync(source))fs.cpSync(source,path.join(app,entry),{recursive:true});
  }
  fs.symlinkSync(path.join(root,'node_modules'),path.join(app,'node_modules'),'junction');
  return app;
}
function removeApplication(app){
  assert.equal(path.dirname(path.resolve(app)),path.resolve(directory));
  assert.equal(path.basename(app),'app');
  const junction=path.join(app,'node_modules');assert.ok(fs.lstatSync(junction).isSymbolicLink());
  fs.rmSync(junction,{recursive:true,force:true});fs.rmSync(app,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
function removeGeneratedClients(){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(!entry.isDirectory()||!/^stale(?:-[A-Za-z0-9]+)?$/.test(entry.name))continue;
    const client=path.resolve(directory,entry.name,'client');
    assert.ok(client.startsWith(path.resolve(directory)+path.sep));assert.equal(path.basename(client),'client');
    if(fs.existsSync(client)){
      assert.equal(fs.realpathSync(client),client);
      fs.rmSync(client,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    }
    const preload=path.resolve(directory,entry.name,'preload.cjs');
    assert.equal(path.dirname(preload),path.join(directory,entry.name));
    if(fs.existsSync(preload)){
      assert.ok(!fs.existsSync(preload+'.txt'));fs.renameSync(preload,preload+'.txt');
    }
  }
}
async function server(app,env,label,preload){
  const port=33000+Math.floor(Math.random()*1000);const base='http://localhost:'+port;
  const log=fs.openSync(path.join(directory,label+'-server.log'),'w');
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port',String(port)],{cwd:app,windowsHide:true,stdio:['ignore',log,log],env:{...env,SECURITY_ORIGIN:base,NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:preload?'--require='+JSON.stringify(preload):''}});
  fs.closeSync(log);
  try{
    let ready=false;for(let i=0;i<60;i++){if(child.exitCode!==null)throw new Error('QA server exited');try{const response=await fetch(base+'/api/auth/me',{signal:AbortSignal.timeout(5000)});if(response.ok){ready=true;break;}}catch{}await pause(200);}
    assert.ok(ready,'QA server startup failed');
    return {base,stop:()=>spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})};
  }catch(error){spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});throw error;}
}
async function browser(label){
  const profile=fs.mkdtempSync(path.join(directory,label+'-chrome-'));
  const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));assert.ok(executable);
  const child=spawn(executable,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<100;i++){
    try{const value=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];if(/^\d+$/.test(value)){port=value;break;}}
    catch(error){if(!['ENOENT','EBUSY'].includes(error.code)){child.kill();throw error;}}
    await pause(100);
  }
  if(!port){child.kill();throw new Error('Headless browser did not publish its debugging port');}
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const connection=await cdp(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await connection.command('Page.enable');await connection.command('Runtime.enable');await connection.command('Network.enable');
  return {...connection,stop:()=>{connection.close();child.kill();}};
}
async function wait(browser,expression,label){
  for(let i=0;i<200;i++){if(await browser.evaluate(expression)){console.log('Real browser: '+label);return;}await pause(100);}
  const shot=await browser.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,'failure.png'),Buffer.from(shot.data,'base64'));
  fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({label,text:await browser.evaluate('document.body.innerText')},null,2));
  throw new Error('Browser timeout: '+label+'; diagnostics retained privately');
}
async function cookie(browser,base,value){
  if(value)await browser.command('Network.setCookie',{name:'dream_session',value,url:base,httpOnly:true,sameSite:'Lax'});
  else await browser.command('Network.deleteCookies',{name:'dream_session',url:base});
}
async function click(browser,text,selector='button'){
  const bounds=await browser.evaluate('(()=>{const el=Array.from(document.querySelectorAll('+JSON.stringify(selector)+')).find(el=>el.textContent.trim()==='+JSON.stringify(text)+');if(!el)return null;const target=el.tagName==="LABEL"?el.querySelector("input"):el;target.scrollIntoView({block:"center"});const r=target.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  assert.ok(bounds,'Missing UI control: '+text);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',...bounds,button:'left',clickCount:1});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',...bounds,button:'left',clickCount:1});
}
async function fill(browser,id,value){
  await browser.evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});const type=el.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function verifyFlow(page,base,identities,database){
  const catalogs=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'))]));
  const network=[];const errors=[];const methods=new Map();
  page.on('Network.requestWillBeSent',event=>{if(new URL(event.request.url).pathname.startsWith('/api/'))methods.set(event.requestId,event.request.method);});
  page.on('Network.responseReceived',event=>{const pathname=new URL(event.response.url).pathname;if(pathname.startsWith('/api/'))network.push({method:methods.get(event.requestId),path:pathname.replace(/\/projects\/[a-f0-9-]+$/,'/projects/:id'),status:event.response.status});});
  page.on('Runtime.exceptionThrown',()=>errors.push('uncaught_exception'));
  page.on('Runtime.consoleAPICalled',event=>{if(/MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(event.args.map(arg=>arg.value??'').join(' ')))errors.push('localization_or_hydration');});
  async function api(pathname,{token=identities.admin,method='GET',body}={}){
    const response=await fetch(base+pathname,{method,headers:{...(token?{Cookie:'dream_session='+token}:{}),...(body?{Origin:base,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  const input=(extra={})=>({title:'Private runtime fixture',titleFa:'پروژه خصوصی آزمایشی',description:null,descriptionFa:null,orderId:null,status:'PLANNED',startAt:null,deadlineAt:null,isPublic:false,showOnHomepage:false,...extra});
  const edit=(row,extra={})=>({data:input({title:row.title,titleFa:row.titleFa,description:row.description,descriptionFa:row.descriptionFa,orderId:row.orderId,status:row.status,startAt:row.startAt,deadlineAt:row.deadlineAt,isPublic:row.isPublic,showOnHomepage:row.showOnHomepage,...extra}),expectedUpdatedAt:row.updatedAt});
  for(const [token,status]of [[null,401],[identities.customer,403],[identities.banned,401]]){
    assert.equal((await api('/api/admin/projects',{token})).status,status);
    assert.equal((await api('/api/admin/projects',{token,method:'POST',body:input()})).status,status);
  }
  const empty=await api('/api/admin/projects?page=1&limit=10');assert.equal(empty.status,200);assert.deepEqual(empty.data,{data:[],total:0});
  state.emptyApi={status:200,total:0,data:[]};
  for(const locale of ['en','fa']){
    await cookie(page,base,identities.admin);await page.command('Page.navigate',{url:base+'/'+locale+'/admin/projects'});
    await wait(page,'document.documentElement?.lang==='+JSON.stringify(locale)+' && document.querySelector("tbody")?.textContent.includes('+JSON.stringify(catalogs[locale].AdminProjects.empty)+')','real '+locale+' admin empty state');
    assert.equal(await page.evaluate('document.querySelector("[role=alert]")===null'),true);
    await cookie(page,base,null);await page.command('Page.navigate',{url:base+'/'+locale});
    await wait(page,'Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(catalogs[locale].LaunchCountdown.emptyTitle)+')','real '+locale+' homepage empty state');
  }
  await cookie(page,base,identities.admin);await page.command('Page.navigate',{url:base+'/en/admin/projects'});
  const en=catalogs.en.AdminProjects;
  await wait(page,'document.querySelector("tbody")?.textContent.includes('+JSON.stringify(en.empty)+')','admin ready to create');
  await click(page,en.create);await wait(page,'document.getElementById("project-title")!==null','create dialog');
  await fill(page,'project-title','Runtime project 100% _');await fill(page,'project-titleFa','پروژه زنده آزمایشی');
  await fill(page,'project-description','Public runtime description');await fill(page,'project-descriptionFa','توضیحات عمومی آزمایشی');
  const localDeadline=await page.evaluate('(()=>{const date=new Date(Date.now()+86400000);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);})()');
  await fill(page,'project-deadlineAt',localDeadline);await click(page,en.isPublic,'label');await click(page,en.showOnHomepage,'label');
  await click(page,en.review);await wait(page,'document.querySelector("[role=dialog]")?.innerText.includes('+JSON.stringify(en.confirmHomepage)+')','public selection confirmation');
  await click(page,en.confirm);await wait(page,'document.querySelector("[role=dialog]")===null && document.querySelector("tbody")?.textContent.includes("Runtime project 100% _")','project saved through real POST');
  let listed=await api('/api/admin/projects');assert.equal(listed.status,200);assert.equal(listed.data.total,1);let project=listed.data.data[0];assert.ok(project.isPublic&&project.showOnHomepage&&project.orderId===null);
  for(const locale of ['en','fa']){
    await cookie(page,base,null);
    await page.command('Emulation.setDeviceMetricsOverride',{width:locale==='fa'?390:1365,height:1000,deviceScaleFactor:1,mobile:locale==='fa'});
    await page.command('Page.navigate',{url:base+'/'+locale});
    const title=locale==='fa'?project.titleFa:project.title;
    await wait(page,'Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(title)+')','real '+locale+' public countdown');
    assert.equal(await page.evaluate('document.querySelector("time")?.dateTime'),project.deadlineAt);
    assert.equal(await page.evaluate('document.documentElement.dir'),locale==='fa'?'rtl':'ltr');
    for(const theme of ['light','dark']){
      await page.evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');await pause(500);
      await page.evaluate('document.querySelector("time").scrollIntoView({block:"center"})');
      const shot=await page.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,locale+'-homepage-'+theme+'.png'),Buffer.from(shot.data,'base64'));
    }
  }
  await cookie(page,base,identities.admin);await page.command('Page.navigate',{url:base+'/fa/admin/projects'});
  const fa=catalogs.fa.AdminProjects;
  await wait(page,'document.querySelector("tbody")?.textContent.includes('+JSON.stringify(project.titleFa)+')','Persian admin project row');
  for(const theme of ['light','dark']){await page.evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');await pause(500);const shot=await page.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,'fa-admin-'+theme+'.png'),Buffer.from(shot.data,'base64'));}
  await click(page,fa.edit);await wait(page,'document.getElementById("project-title")!==null','real edit dialog');
  await fill(page,'project-title','Runtime project updated');await fill(page,'project-titleFa','پروژه زنده ویرایش‌شده');
  await click(page,fa.review);await wait(page,'document.querySelector("[role=dialog]")?.innerText.includes('+JSON.stringify(fa.confirmHomepage)+')','edit confirmation');await click(page,fa.confirm);
  await wait(page,'document.querySelector("[role=dialog]")===null && document.querySelector("tbody")?.textContent.includes("پروژه زنده ویرایش‌شده")','real PATCH updates table');
  project=(await api('/api/admin/projects')).data.data[0];
  for(const locale of ['en','fa']){
    await cookie(page,base,null);await page.command('Page.navigate',{url:base+'/'+locale});
    await wait(page,'Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(locale==='fa'?project.titleFa:project.title)+')','updated '+locale+' homepage');
  }
  await cookie(page,base,identities.admin);await page.command('Page.navigate',{url:base+'/en/admin/projects'});
  await wait(page,'document.querySelector("tbody")?.textContent.includes("Runtime project updated")','English edit ready');
  await click(page,en.edit);await wait(page,'document.getElementById("project-title")!==null','clear selection dialog');await click(page,en.showOnHomepage,'label');
  await click(page,en.review);await wait(page,'document.querySelector("[role=dialog]")?.innerText.includes('+JSON.stringify(en.confirmSave)+')','clear selection confirmation');await click(page,en.confirm);
  await wait(page,'document.querySelector("[role=dialog]")===null','selection cleared');
  for(const locale of ['en','fa']){
    await cookie(page,base,null);await page.command('Page.navigate',{url:base+'/'+locale});
    await wait(page,'document.querySelector("#upcoming-project h2")?.textContent==='+JSON.stringify(locale==='fa'?project.titleFa:project.title),'automatic '+locale+' project after clearing legacy selection');
  }
  // Exercise clock expiry on an actual server-selected future deadline.
  project=(await api('/api/admin/projects')).data.data[0];
  const expiring=await api('/api/admin/projects/'+project.id,{method:'PATCH',body:edit(project,{showOnHomepage:true,deadlineAt:new Date(Date.now()+12000).toISOString()})});assert.equal(expiring.status,200);project=expiring.data;
  await page.command('Page.navigate',{url:base+'/en'});
  await wait(page,'document.querySelector("time")!==null','real near-deadline countdown');
  await wait(page,'Array.from(document.querySelectorAll("[role=status]")).some(el=>el.textContent==='+JSON.stringify(catalogs.en.LaunchCountdown.deadlineReached)+')','real countdown expiry');
  assert.equal(await page.evaluate('document.querySelector("time").closest("section").querySelector("form")===null'),true);
  assert.equal((await database.project.findUniqueOrThrow({where:{id:project.id}})).status,'PLANNED');
  await page.command('Page.navigate',{url:base+'/fa'});
  await wait(page,'Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(catalogs.fa.LaunchCountdown.emptyTitle)+')','expired project excluded on a new request');
  const cleared=await api('/api/admin/projects/'+project.id,{method:'PATCH',body:edit(project,{showOnHomepage:false})});assert.equal(cleared.status,200);
  // More private fixtures verify real pagination without populating the original DB.
  for(let i=0;i<10;i++)assert.equal((await api('/api/admin/projects',{method:'POST',body:input({title:'Pagination fixture '+i})})).status,201);
  await cookie(page,base,identities.admin);await page.command('Page.navigate',{url:base+'/en/admin/projects'});
  await wait(page,'document.querySelectorAll("tbody tr").length===10 && document.querySelector("tbody")?.textContent.includes("Pagination fixture")','first real page');
  await page.evaluate('document.querySelector('+JSON.stringify('button[aria-label="'+catalogs.en.Common.nextPage+'"]')+').click()');
  await wait(page,'document.querySelectorAll("tbody tr").length===1 && document.querySelector("tbody")?.textContent.includes("Runtime project updated")','second real page');
  await click(page,catalogs.en.DataTable.filters);await wait(page,'document.getElementById("filter-search")!==null','search controls');await fill(page,'filter-search','no matching runtime title');
  await wait(page,'document.querySelector("tbody")?.textContent.includes('+JSON.stringify(en.empty)+')','search resets page and returns empty');
  await fill(page,'filter-search','Runtime project updated');await wait(page,'document.querySelector("tbody")?.textContent.includes("Runtime project updated")','real title search');
  await page.evaluate('document.getElementById("filter-status").click()');await wait(page,'document.querySelector("[role=option]")!==null','status options');
  await page.evaluate('Array.from(document.querySelectorAll("[role=option]")).find(el=>el.textContent.trim()==='+JSON.stringify(en.statuses.ACTIVE)+').focus()');
  await page.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await page.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(page,'document.querySelector("tbody")?.textContent.includes('+JSON.stringify(en.empty)+')','real status filter');
  await click(page,catalogs.en.DataTable.clear);await wait(page,'document.querySelectorAll("tbody tr").length===10 && document.querySelector("tbody")?.textContent.includes("Pagination fixture")','filters cleared');
  await wait(page,'Array.from(document.querySelectorAll("button")).some(el=>el.textContent.trim()==='+JSON.stringify(en.refresh)+')','refresh ready');await click(page,en.refresh);
  await wait(page,'document.querySelectorAll("tbody tr").length===10 && document.querySelector("tbody")?.textContent.includes("Pagination fixture") && document.querySelector("[role=alert]")===null','real refresh');
  assert.deepEqual(errors,[]);assert.ok(network.some(item=>item.method==='POST'&&item.status===201)&&network.some(item=>item.method==='PATCH'&&item.status===200));
  state.network=network;state.browserErrors=errors;state.locales=['en','fa'];state.themes=['light','dark'];state.httpApisMocked=false;save();
}

async function cdp(url){
  const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();const listeners=new Map();
  socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);if(data.error)item.reject(new Error('CDP command failed: '+item.method));else item.resolve(data.result);}}else for(const listener of listeners.get(data.method)??[])listener(data.params);};
  function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},30000);pending.set(id,{resolve,reject,timer,method});socket.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Runtime evaluation failed');return result.result.value;}
  return {command,evaluate,on:(method,listener)=>listeners.set(method,[...(listeners.get(method)??[]),listener]),close:()=>socket.close()};
}

if(mode==='diagnose'){
  const tabs=await(await fetch('http://127.0.0.1:9229/json/list')).json();
  assert.ok(tabs.length===1);
  const connection=await cdp(tabs[0].webSocketDebuggerUrl);
  try{
    const evidence=await connection.evaluate(`(async()=>{
      const p=globalThis.prisma;
      if(process.pid!==18228||!p)throw new Error('Unexpected process');
      const identity=await p.$queryRawUnsafe('SELECT current_database() AS database, inet_server_port() AS port');
      const count=await p.$queryRawUnsafe('SELECT count(*)::int AS count FROM entity.projects');
      const projectDelegateReady=typeof p.project?.findFirst==='function';
      const exceptions=[];
      if(!projectDelegateReady){
        for(const operation of ['homepage','list']){
          try{if(operation==='homepage')await p.project.findFirst({select:{id:true}});else await p.$transaction(tx=>tx.project.findMany({select:{id:true}}));}
          catch(error){exceptions.push({operation,type:error instanceof TypeError?'TypeError':'other',message:/^Cannot read properties of undefined \\(reading '(findFirst|findMany)'\\)$/.test(error.message)?error.message:'redacted'});}
        }
      }
      return {pid:process.pid,database:identity[0].database,port:identity[0].port,projectRows:count[0].count,
        projectDelegateReady,runtimeModelHasProject:Boolean(p._runtimeDataModel?.models?.Project),exceptions};
    })()`);
    state.before=evidence;save();console.log(JSON.stringify(evidence,null,2));
    console.log('Evidence: '+path.relative(root,directory));
  }finally{
    await connection.command('Runtime.evaluate',{expression:"setTimeout(()=>process.getBuiltinModule('inspector').close(),100)"}).catch(()=>{});
    connection.close();
  }
}else if(mode==='original-before'||mode==='original-after'){
  const page=await browser(mode);
  const documents=[];
  page.on('Network.responseReceived',event=>{if(event.type==='Document')documents.push({path:new URL(event.response.url).pathname,status:event.response.status});});
  try{
    const headings={};
    for(const locale of mode==='original-after'?['en','fa']:['en']){
      const messages=JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8')).LaunchCountdown;
      await page.command('Page.navigate',{url:'http://localhost:3000/'+locale});
      const text=mode==='original-before'?messages.unavailableTitle:messages.emptyTitle;
      await wait(page,'document.documentElement?.lang==='+JSON.stringify(locale)+' && Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(text)+')',mode+' '+locale+' homepage state');
      if(mode==='original-after'){
        assert.equal(await page.evaluate('document.querySelector("#upcoming-project time, #upcoming-project form")===null'),true);
        await wait(page,'document.querySelector("#projects .swiper")?.swiper?.slides.length===7','original portfolio restored');
      }
      headings[locale]=text;
      await page.evaluate('Array.from(document.querySelectorAll("section h2")).find(el=>el.textContent==='+JSON.stringify(text)+').closest("section").scrollIntoView({block:"center"})');
      const shot=await page.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,mode+'-'+locale+'.png'),Buffer.from(shot.data,'base64'));
    }
    const request=await page.evaluate(`(async()=>{const response=await fetch('/api/admin/projects?page=1&limit=10');return {status:response.status,body:await response.json()};})()`);
    assert.equal(request.status,401);assert.ok(documents.every(item=>item.status===200));state[mode]={documents,headings,anonymousProjectStatus:401};save();
    console.log(JSON.stringify(state[mode]));
  }finally{page.stop();}
}else if(mode==='flow'){
  const before=originalSnapshot();fs.writeFileSync(path.join(directory,'original-before.json'),JSON.stringify(before,null,2));
  assert.equal(before.tables['entity.projects'].count,0);
  const name='dreamservice_projects_runtime_'+randomUUID().replaceAll('-','');
  assert.ok(/^dreamservice_projects_runtime_[a-f0-9]{32}$/.test(name));
  execute(path.join(binary,'createdb.exe'),['--template=template0',name],databaseEnvironment('postgres'),'create-isolated');
  state.isolatedDatabases=[...new Set([...(state.isolatedDatabases??[]),state.testDatabase,name].filter(Boolean))];
  state.testDatabase=name;save();
  const env=databaseEnvironment(name);env.SECURITY_OTP_KEY=randomBytes(32).toString('hex');env.PUBLIC_TEAM_PROFILE_IDS='';
  const archive=path.join(directory,'runtime-original.dump');
  if(!fs.existsSync(archive))execute(path.join(binary,'pg_dump.exe'),['--format=custom','--no-owner','--no-privileges','--file',archive],databaseEnvironment('dreamservice',true),'runtime-backup');
  const listing=execute(path.join(binary,'pg_restore.exe'),['--list',archive],env,'runtime-archive-list');assert.ok(listing.includes('TABLE DATA'));
  state.backup={sha256:hash(fs.readFileSync(archive)),bytes:fs.statSync(archive).size};save();
  const extracted=path.join(directory,'runtime-restore.sql');
  execute(path.join(binary,'pg_restore.exe'),['--no-owner','--no-privileges','--file',extracted,archive],env,'runtime-extract');
  fs.writeFileSync(extracted,fs.readFileSync(extracted,'utf8').replace(/^SET transaction_timeout = 0;\r?\n/gm,''));
  execute(path.join(binary,'psql.exe'),['-X','-v','ON_ERROR_STOP=1','--single-transaction','--file',extracted],env,'runtime-restore');
  const {PrismaClient}=await import('@prisma/client');
  const database=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  async function identity(role,banned=false){
    const user=await database.user.create({data:{fname:'Runtime fixture',bannedAt:banned?new Date():null}});
    await database.personProfile.create({data:{user_id:user.id,role}});
    const token=randomBytes(32).toString('hex');
    await database.session.create({data:{userId:user.id,token:'sha256:'+hash(token),expiresAt:new Date(Date.now()+3600000)}});
    return token;
  }
  const admin=await identity('app-admin');const customer=await identity('customer');const banned=await identity('app-admin',true);
  const staleDirectory=fs.mkdtempSync(path.join(directory,'stale-'));
  let schema=fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8').replace(/\nenum ProjectStatus \{[\s\S]*?\n\}\r?\n/,'\n').replace(/\nmodel Project \{[\s\S]*?\n\}\r?\n/,'\n').replace(/^\s+project Project\?\r?\n/m,'');
  assert.ok(!schema.includes('model Project {')&&!schema.includes('ProjectStatus'));
  schema=schema.replace('provider        = "prisma-client-js"','provider        = "node '+path.join(root,'node_modules/@prisma/client/generator-build/index.js').replaceAll('\\','/')+'"\n  output = "'+path.join(staleDirectory,'client').replaceAll('\\','/')+'"');
  fs.writeFileSync(path.join(staleDirectory,'schema.prisma'),schema);
  execute(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'generate','--schema',path.join(staleDirectory,'schema.prisma')],env,'stale-client-generate');
  const preload=path.join(staleDirectory,'preload.cjs');
  // A real older generated Client, not a Prisma substitute or an HTTP mock.
  fs.writeFileSync(preload,"const Module=require('node:module');const original=Module._load;Module._load=function(name,...args){return original.call(this,name==='@prisma/client'?"+JSON.stringify(path.join(staleDirectory,'client/index.js'))+":name,...args);};\n");
  const app=copyApplication();let running;let page;
  try{
    running=await server(app,env,'stale',preload);page=await browser('stale');await cookie(page,running.base,admin);
    await page.command('Page.navigate',{url:running.base+'/en/admin/projects'});
    await wait(page,'document.querySelector("[role=alert]")?.textContent.includes("Something went wrong")','stale real-client admin error');
    const failure=await page.evaluate(`(async()=>{const me=await(await fetch('/api/auth/me')).json();const response=await fetch('/api/admin/projects?page=1&limit=10');return {permission:me.user?.permission,status:response.status,body:await response.json()};})()`);
    assert.equal(failure.permission,'ADMIN');assert.equal(failure.status,500);assert.equal(failure.body.code,'UNKNOWN');state.staleApi={authenticatedRole:'app-admin',status:failure.status,code:failure.body.code};
    await page.command('Page.navigate',{url:running.base+'/en'});
    const messages=JSON.parse(fs.readFileSync(path.join(root,'messages/en.json'),'utf8'));
    await wait(page,'Array.from(document.querySelectorAll("section h2")).some(el=>el.textContent==='+JSON.stringify(messages.LaunchCountdown.unavailableTitle)+')','stale real-client homepage error');
    save();page.stop();page=null;running.stop();running=null;
    running=await server(app,env,'fresh');page=await browser('fresh');await cookie(page,running.base,admin);
    await verifyFlow(page,running.base,{admin,customer,banned},database);
    state.flowPassed=true;save();
  }finally{page?.stop();running?.stop();await database.$disconnect();removeApplication(app);removeGeneratedClients();}
  const after=originalSnapshot();fs.writeFileSync(path.join(directory,'original-after.json'),JSON.stringify(after,null,2));assert.deepEqual(after,before);
  state.originalUnchanged=true;save();console.log(JSON.stringify({staleApi:state.staleApi,realDatabaseFlowPassed:state.flowPassed,originalUnchanged:true,testDatabase:name,evidence:path.relative(root,directory)}));
}else if(mode==='layout'){
  // Reuse only the disposable database created by a completed real-runtime run.
  assert.equal(state.flowPassed,true);
  assert.match(state.testDatabase,/^dreamservice_projects_runtime_[a-f0-9]{32}$/);
  const before=originalSnapshot();
  const env=databaseEnvironment(state.testDatabase);
  env.SECURITY_OTP_KEY=randomBytes(32).toString('hex');env.PUBLIC_TEAM_PROFILE_IDS='';
  const {PrismaClient}=await import('@prisma/client');
  const database=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  const fixtures=[];let app;let running;let page;
  const results=[];const errors=[];const knownWarnings=[];const documents=[];
  const catalogs=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(root,'messages',locale+'.json'),'utf8'))]));
  async function fixture(label,extra={}){
    const row=await database.project.create({data:{title:'Upcoming '+label,titleFa:'پروژه آینده '+label,
      description:'Independent of the original portfolio slider.',descriptionFa:'مستقل از اسلایدر نمونه‌کارهای اصلی.',
      isPublic:true,showOnHomepage:false,deadlineAt:new Date(Date.now()+86400000),...extra}});
    fixtures.push(row.id);return row;
  }
  async function navigate(locale,row){
    await page.command('Page.navigate',{url:running.base+'/'+locale});
    const title=row?(locale==='fa'?row.titleFa:row.title):catalogs[locale].LaunchCountdown.emptyTitle;
    await wait(page,'document.querySelector("#upcoming-project h2")?.textContent==='+JSON.stringify(title),'real '+locale+' '+(row?'nearest project':'empty upcoming card'));
    await wait(page,'document.querySelector("#projects .swiper")?.swiper?.slides.length===7','all original portfolio items');
  }
  async function press(selector){
    await wait(page,'document.querySelector("#projects .swiper").swiper.animating===false','portfolio transition settled');
    await page.evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');await pause(100);
    const point=await page.evaluate('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await page.command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await page.command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await pause(400);
  }
  try{
    assert.equal(await database.project.count({where:{showOnHomepage:true}}),0,'Disposable database must have no current selection');
    assert.equal(await database.project.count({where:{isPublic:true,status:{in:['PLANNED','ACTIVE']},deadlineAt:{gt:new Date()}}}),0,'Disposable database must have no eligible public projects');
    const deadline=new Date(Date.now()+3600000);
    const ids=[randomUUID(),randomUUID()].sort();
    // Insert the larger ID first to prove the result is not insertion order.
    const tied=await fixture('equal deadline',{id:ids[1],deadlineAt:deadline,status:'ACTIVE'});
    const nearest=await fixture('nearest',{id:ids[0],deadlineAt:deadline});
    const later=await fixture('later legacy selection',{showOnHomepage:true,status:'ACTIVE'});
    await fixture('private',{isPublic:false,deadlineAt:new Date(Date.now()+60000)});
    await fixture('completed',{status:'COMPLETED',deadlineAt:new Date(Date.now()+60000)});
    await fixture('cancelled',{status:'CANCELLED',deadlineAt:new Date(Date.now()+60000)});
    await fixture('past',{deadlineAt:new Date(Date.now()-60000)});
    await fixture('no deadline',{deadlineAt:null});
    app=copyApplication();running=await server(app,env,'layout');
    // Compile each real route before Chrome's navigation timeout starts.
    for(const locale of ['en','fa']){
      const response=await fetch(running.base+'/'+locale,{signal:AbortSignal.timeout(120000)});
      assert.equal(response.status,200);await response.text();console.log('Compiled real '+locale+' homepage');
    }
    page=await browser('layout');
    page.on('Runtime.exceptionThrown',()=>errors.push('uncaught_exception'));
    page.on('Runtime.consoleAPICalled',event=>{
      const message=event.args.map(arg=>arg.value??'').join(' ');
      if(/MISSING_MESSAGE|hydration failed|hydration[- ]mismatch|A tree hydrated/i.test(message)){
        if(/CallToAction|FeatureCard/.test(message))knownWarnings.push('existing_call_to_action_reduced_motion_hydration');
        else errors.push('localization_or_hydration');
      }
    });
    page.on('Network.responseReceived',event=>{if(event.type==='Document')documents.push({path:new URL(event.response.url).pathname,status:event.response.status});});
    await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    for(const locale of ['en','fa'])for(const width of [1365,390]){
      await page.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      await navigate(locale,nearest);
      await wait(page,'document.querySelector("#upcoming-project article form")!==null','hydrated countdown inside its card');
      await pause(500);
      const geometry=await page.evaluate(`(()=>{
        const section=document.getElementById('upcoming-project'),card=section.querySelector('article'),portfolio=document.getElementById('projects');
        const swiper=portfolio.querySelector('.swiper'),grid=section.querySelector('[aria-label]'),a=card.getBoundingClientRect(),b=portfolio.getBoundingClientRect();
        const dots=Array.from(portfolio.querySelectorAll('.swiper-pagination-bullet')).map(dot=>dot.getBoundingClientRect().bottom);
        return {cards:section.querySelectorAll('article').length,gap:a.top-b.bottom,dotGap:a.top-Math.max(...dots),countdownInside:card.contains(grid),units:grid.children.length,
          overflow:section.scrollWidth>section.clientWidth,dir:document.documentElement.dir,
          slides:swiper.swiper.slides.length,slidesPerView:swiper.swiper.params.slidesPerView,effect:swiper.swiper.params.effect,loop:swiper.swiper.params.loop,
          pagination:portfolio.querySelectorAll('.swiper-pagination-bullet').length,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
          animations:section.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'&&animation.effect.getTiming().duration>1).length};
      })()`);
      assert.equal(geometry.cards,1);assert.equal(geometry.gap,32);assert.ok(geometry.dotGap>=24&&geometry.dotGap<=48);
      assert.equal(geometry.countdownInside,true);assert.equal(geometry.units,4);assert.equal(geometry.overflow,false);
      assert.equal(geometry.slides,7);assert.equal(geometry.pagination,7);assert.equal(geometry.effect,'coverflow');assert.equal(geometry.loop,true);
      assert.equal(geometry.slidesPerView,width===390?1:3);
      assert.equal(geometry.dir,locale==='fa'?'rtl':'ltr');assert.equal(geometry.reducedMotion,true);assert.equal(geometry.animations,0);
      assert.equal(await page.evaluate('document.querySelector("#upcoming-project time").dateTime'),nearest.deadlineAt.toISOString());
      const keys=['store','dashboard','mobile','personal','crm','education','game'];
      assert.deepEqual((await page.evaluate('Array.from(document.querySelectorAll("#projects .swiper-slide h3")).map(el=>el.textContent).sort()')),keys.map(key=>catalogs[locale].Projects.items[key].title).sort());
      const initial=await page.evaluate('document.querySelector("#projects .swiper").swiper.realIndex');
      await press('#projects .swiper-button-next');assert.equal(await page.evaluate('document.querySelector("#projects .swiper").swiper.realIndex'),(initial+1)%7);
      await press('#projects .swiper-button-prev');assert.equal(await page.evaluate('document.querySelector("#projects .swiper").swiper.realIndex'),initial);
      await press('#projects .swiper-pagination-bullet:nth-child(4)');
      await wait(page,'document.querySelector("#projects .swiper").swiper.realIndex===3','pagination selects fourth original work');
      for(const theme of ['light','dark']){
        await page.evaluate('document.documentElement.classList.toggle("dark",'+(theme==='dark')+')');await pause(500);
        await page.evaluate('document.getElementById("projects").scrollIntoView({block:"start"})');
        const shot=await page.command('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(directory,'portfolio-'+locale+'-'+width+'-'+theme+'.png'),Buffer.from(shot.data,'base64'));
        results.push({locale,width,theme,...geometry});
      }
    }
    // The next eligible project appears automatically, with no flag changes.
    await database.project.update({where:{id:nearest.id},data:{isPublic:false}});await navigate('en',tied);
    await database.project.update({where:{id:tied.id},data:{isPublic:false}});await navigate('fa',later);
    await database.project.update({where:{id:later.id},data:{showOnHomepage:false}});await navigate('en',later);
    for(const locale of ['en','fa']){
      await database.project.update({where:{id:later.id},data:{deadlineAt:new Date(Date.now()+8000)}});
      await navigate(locale,later);
      await wait(page,'document.querySelector("#upcoming-project [role=status]")?.textContent==='+JSON.stringify(catalogs[locale].LaunchCountdown.deadlineReached),'localized '+locale+' expiry');
      assert.equal(await page.evaluate('document.querySelectorAll("#upcoming-project article").length'),1);
      assert.equal(await page.evaluate('document.querySelector("#upcoming-project form")===null'),true);
      await navigate(locale,null);
      assert.equal(await page.evaluate('document.querySelector("#upcoming-project time, #upcoming-project form")===null'),true);
    }
    for(const locale of ['en','fa'])for(const width of [1365,390]){
      await page.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      await navigate(locale,null);
      assert.equal(await page.evaluate('document.querySelector("#upcoming-project time, #upcoming-project form")===null'),true);
      const initial=await page.evaluate('document.querySelector("#projects .swiper").swiper.realIndex');
      await press('#projects .swiper-button-next');assert.equal(await page.evaluate('document.querySelector("#projects .swiper").swiper.realIndex'),(initial+1)%7);
    }
    assert.deepEqual(errors,[]);assert.ok(documents.length>=12&&documents.every(item=>item.status===200));
    state.layout={passed:true,architecture:'independent_portfolio_and_automatic_upcoming_card',results,nearestDeadline:true,deterministicTie:true,
      legacySelectionIgnored:true,ineligibleExcluded:true,expiredLocales:['en','fa'],noProjectLocales:['en','fa'],documents,browserErrors:errors,knownWarnings:[...new Set(knownWarnings)],httpApisMocked:false};save();
  }finally{
    page?.stop();running?.stop();
    if(fixtures.length)await database.project.updateMany({where:{id:{in:fixtures}},data:{showOnHomepage:false,isPublic:false}});
    await database.$disconnect();if(app)removeApplication(app);
    assert.deepEqual(originalSnapshot(),before);
  }
  console.log(JSON.stringify({layoutPassed:state.layout.passed,combinations:results.length,sectionGap:32,nearestDeadline:true,deterministicTie:true,originalUnchanged:true,knownWarnings:state.layout.knownWarnings}));
}else if(mode==='build'){
  // Keep the active development server's .next directory and environment intact.
  const app=copyApplication();
  try{
    const result=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{
      cwd:app,windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024,
      env:{...process.env,NODE_OPTIONS:'--require='+JSON.stringify(path.join(root,'scripts/no-services.cjs'))},
    });
    fs.writeFileSync(path.join(directory,'production-build.log'),(result.stdout??'')+(result.stderr??''));
    assert.ok(!result.error&&result.status===0,'Production build failed; private log retained');
    state.productionBuildPassed=true;save();console.log(result.stdout);
  }finally{removeApplication(app);}
}else if(mode==='integrity'){
  const before=JSON.parse(fs.readFileSync(path.join(directory,'original-before.json'),'utf8'));const after=originalSnapshot();
  assert.deepEqual(after,before);fs.writeFileSync(path.join(directory,'original-final.json'),JSON.stringify(after,null,2));
  state.originalUnchanged=true;save();console.log(JSON.stringify({originalUnchanged:true,tables:Object.keys(after.tables).length,indexes:after.indexes.length,projectRows:after.tables['entity.projects'].count,migrationFilesUnchanged:Object.keys(after.migrations).length}));
}else if(mode==='clean-clients'){
  assert.equal(state.flowPassed,true);removeGeneratedClients();console.log('Removed only generated stale-client modules from this completed QA run. Evidence, schemas and backups are retained.');
}else{throw new Error('Unsupported real-runtime verification mode');}
