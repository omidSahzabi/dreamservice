// Guarded verification launcher. No mutation mode ever targets dreamservice.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import dotenv from 'dotenv';
const root=path.resolve(import.meta.dirname,'..'),mode=process.argv[2];
const evidence=path.resolve(root,process.argv[3]??'');assert.ok(evidence.startsWith(path.join(root,'.backups','v1-phase1-')));
const state=JSON.parse(fs.readFileSync(path.join(evidence,'state.json'),'utf8'));assert.ok(state.trialVerified&&state.originalPreserved&&!state.originalApplied);assert.match(state.testDatabase,/^dreamservice_phase1_test_[a-f0-9]{32}$/);
let connection=process.env.DATABASE_URL;for(const f of ['.env.development.local','.env.local','.env.development','.env'])if(!connection&&fs.existsSync(path.join(root,f)))connection=dotenv.parse(fs.readFileSync(path.join(root,f),'utf8')).DATABASE_URL;
const url=new URL(connection);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.equal(url.pathname,'/dreamservice');url.pathname='/'+state.testDatabase;
const env={...process.env,DATABASE_URL:url.toString(),PHASE1_TEST_DATABASE_URL:url.toString(),PHASE1_TEST_DATABASE_NAME:state.testDatabase,PHASE1_EVIDENCE:evidence,SECURITY_ORIGIN:'http://localhost',SECURITY_OTP_KEY:randomBytes(32).toString('hex'),SECURITY_SMS_ENABLED:'false',ORDER_NOTIFICATIONS_SMS_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1',PUBLIC_TEAM_PROFILE_IDS:'1,2,3',NODE_OPTIONS:''};
let args,cwd=root;
if(mode==='integration')args=['--test','--test-reporter=spec',path.join(root,'scripts/v1-phase1.integration.mjs')];
else if(mode==='build'){
  const app=path.join(evidence,'app');if(fs.existsSync(app))assert.ok(fs.lstatSync(app).isDirectory()&&!fs.lstatSync(app).isSymbolicLink());else fs.mkdirSync(app);
  for(const name of ['src','messages','i18n','public','package.json','package-lock.json','next.config.ts','middleware.ts','tsconfig.json','postcss.config.mjs','next-env.d.ts'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(app,name),{recursive:true});
  if(!fs.existsSync(path.join(app,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(app,'node_modules'),'junction');cwd=app;
  env.NODE_OPTIONS='--require='+JSON.stringify(path.join(root,'scripts/no-services.cjs'));
  args=[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'];
}else if(mode==='browser')args=[path.join(root,'scripts/v1-phase1-browser.mjs')];
else if(mode==='preview-browser')args=[path.join(root,'scripts/preview-login-browser.mjs')];
else throw Error('Supported modes: integration, build, browser, preview-browser');
const result=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
fs.writeFileSync(path.join(evidence,mode+'.log'),(result.stdout??'')+(result.stderr??''));
if(result.error||result.status!==0){console.error(JSON.stringify({failed:mode,category:result.error?.code??'verification',evidence:path.relative(root,evidence)}));process.exitCode=1;}
else {console.log(result.stdout);console.log(JSON.stringify({passed:mode,evidence:path.relative(root,evidence)}));}
