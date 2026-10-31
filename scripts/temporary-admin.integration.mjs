// Separate ephemeral container only. Never reads repository environment files.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes, randomUUID, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {PrismaClient} from '@prisma/client';
import {load} from './test-loader.mjs';

const root=path.resolve(import.meta.dirname,'..');
const evidence=path.resolve(process.argv[2]??'');
assert.ok(evidence.startsWith(path.join(root,'.backups','temporary-admin-login-')));
const name='dreamservice-temp-admin-'+randomUUID().replaceAll('-','');
const database='temporary_admin_test', dbPassword=randomBytes(32).toString('hex');
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
const dockerEnv={...cleanEnv,POSTGRES_PASSWORD:dbPassword};
let db,created=false,stage='image-check';
const result={scenarios:[],originalDatabasesAccessed:false};
const docker=args=>spawnSync('docker',args,{env:dockerEnv,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
function check(condition,label){assert.ok(condition);result.scenarios.push(label);}
try{
 assert.equal(docker(['image','inspect','postgres:15','--format','{{.Id}}']).status,0);
 stage='disposable-container-start';
 const started=docker(['run','--pull=never','--rm','--detach','--name',name,'--label','dreamservice.test=temporary-admin',
   '--tmpfs','/var/lib/postgresql/data:rw','--publish','127.0.0.1::5432','--env','POSTGRES_PASSWORD','--env','POSTGRES_DB='+database,'postgres:15']);
 assert.equal(started.status,0);created=true;
 const mapping=docker(['port',name,'5432/tcp']);assert.equal(mapping.status,0);const match=/^127\.0\.0\.1:(\d+)\s*$/.exec(mapping.stdout);assert.ok(match);
 const port=Number(match[1]);assert.ok(port>1024&&port!==5432);
 const url=new URL('postgresql://postgres@127.0.0.1:'+port+'/'+database);url.password=dbPassword;
 assert.equal(url.pathname,'/temporary_admin_test');
 db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});
 stage='disposable-schema';
 let ready=false;for(let i=0;i<40;i++){try{await db.$queryRaw`SELECT 1`;ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,300));}}assert.ok(ready);
 const identity=await db.$queryRaw`SELECT current_database() AS name, (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('entity','upro')) AS objects`;
 assert.equal(identity[0].name,database);assert.equal(identity[0].objects,0);
 const pgEnv={...cleanEnv,PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:database,PGUSER:'postgres',PGPASSWORD:dbPassword,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5',PGCLIENTENCODING:'UTF8'};
 for(const migration of fs.readdirSync(path.join(root,'prisma/migrations')).sort()){
  const file=path.join(root,'prisma/migrations',migration,'migration.sql');if(!fs.existsSync(file))continue;
  const applied=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-q','-v','ON_ERROR_STOP=1'],{input:fs.readFileSync(file,'utf8'),encoding:'utf8',env:pgEnv,windowsHide:true});assert.equal(applied.status,0);
 }
 stage='real-postgresql-route-tests';
 const phone='09000000000',other='09000000001',origin='https://production.example.invalid';
 const password=randomBytes(32).toString('base64url'),salt=randomBytes(16);
 const key=await promisify(scrypt)(password,salt,32,{N:131072,r:8,p:1,maxmem:160*1024*1024});
 const hash='scrypt-v1$'+salt.toString('hex')+'$'+key.toString('hex');
 const start=Math.floor(Date.now()/1000)*1000;
 Object.assign(process.env,{NODE_ENV:'production',VERCEL_ENV:'production',TEMP_ADMIN_LOGIN_ENABLED:'true',TEMP_ADMIN_LOGIN_PHONE:phone,TEMP_ADMIN_LOGIN_HASH:hash,
  TEMP_ADMIN_LOGIN_STARTED_AT:new Date(start).toISOString(),TEMP_ADMIN_LOGIN_EXPIRES_AT:new Date(start+86400000).toISOString(),SECURITY_ORIGIN:origin,SECURITY_TRUSTED_IP_HEADER:'x-test-ip',SECURITY_OTP_KEY:randomBytes(32).toString('hex'),SECURITY_SMS_ENABLED:'false'});
 const {normalizePhone}=load('src/lib/auth/helper.ts');
 const admin=await db.user.create({data:{contact:'+989000000000',username:'integration_admin',fname:'Fixture',lname:'Admin'}});
 const customer=await db.user.create({data:{contact:other,username:'integration_customer',fname:'Fixture',lname:'Customer'}});
 const profile=await db.personProfile.create({data:{user_id:admin.id,role:'app-admin'}});
 const baseline=await db.$queryRaw`SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(u) ORDER BY id)::text,'UTF8')),'hex') AS hash FROM entity.users u`;
 let sequence=20;
 function client(){
  const values=new Map(),options=new Map();const jar={get:name=>values.has(name)?{value:values.get(name)}:undefined,set:(name,value,config)=>{values.set(name,value);options.set(name,config);}};
  const overrides={'@/lib/prisma':{prisma:db},'next/headers':{cookies:async()=>jar},'@/lib/auth/temporary-admin-phone':{isTemporaryAdminPhone:value=>{try{return normalizePhone(value)===phone;}catch{return false;}}}};
  const route=load('src/app/api/auth/temporary-admin-login/route.ts',overrides),session=load('src/lib/auth/session.ts',overrides),authorization=load('src/lib/auth/authorization.ts',overrides);
  const send=(body={phone,password})=>route.POST(new Request(origin+'/api/auth/temporary-admin-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-test-ip':'192.0.2.'+(sequence++)},body:JSON.stringify(body)}));
  return {send,session,authorization,values,options};
 }
 const a=client(),b=client();
 check((await a.send()).status===200,'canonical SQL account lookup and real session issuance');
 check((await b.send({phone:'۹۰۰۰۰۰۰۰۰۰',password})).status===200,'Persian digits and separate trusted-browser session');
 check(await db.session.count()===2,'multiple testers retain independent sessions');
 check((await a.authorization.requireAdmin()).id===admin.id,'server admin authorization from real profile');
 check(a.options.get('dream_session').secure&&a.options.get('dream_session').httpOnly,'secure HttpOnly session cookie');
 check((await a.send({phone,password:'incorrect'})).status===401,'incorrect password rejected');
 check((await a.send({phone:other,password})).status===401,'non-allowlisted customer rejected');
 await db.user.update({where:{id:admin.id},data:{bannedAt:new Date()}});
 check(await a.session.getCurrentUser()===null&&(await a.send()).status===401,'committed ban rejects sessions and login');
 await db.user.update({where:{id:admin.id},data:{bannedAt:null}});
 await db.personProfile.update({where:{pr_id:profile.pr_id},data:{role:'customer'}});
 check(await a.session.getCurrentUser()===null&&(await a.send()).status===401,'committed demotion rejects sessions and login');
 await db.personProfile.update({where:{pr_id:profile.pr_id},data:{role:'app-admin'}});
 process.env.TEMP_ADMIN_LOGIN_ENABLED='false';
 check(await a.session.getCurrentUser()===null&&(await a.send()).status===401,'disabled mode revokes all marked sessions');
 process.env.TEMP_ADMIN_LOGIN_ENABLED='true';
 await a.session.invalidateSession();check(await db.session.count()===1,'logout removes only the current browser session');
 const c=client();await c.session.createSession(customer.id);
 let denied=false;try{await c.authorization.requireAdmin();}catch(error){denied=error.status===403;}check(denied,'normal customer session remains forbidden from admin');
 const after=await db.$queryRaw`SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(u) ORDER BY id)::text,'UTF8')),'hex') AS hash FROM entity.users u`;
 check(after[0].hash===baseline[0].hash&&await db.user.count()===2&&await db.personProfile.count()===1,'login never provisions identities or changes user records');
 check(await db.otpVerification.count()===0&&await db.registrationGrant.count()===0,'no OTP or registration records created');
 let limited=false;for(let i=0;i<11;i++){const response=await a.send({phone,password:'incorrect'});if(response.status===429){limited=true;break;}}check(limited,'real PostgreSQL canonical-phone rate limiting');
 result.result='PASS';result.count=result.scenarios.length;
 fs.writeFileSync(path.join(evidence,'integration-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch{
 console.error(JSON.stringify({result:'FAIL',stage,originalDatabasesAccessed:false}));process.exitCode=1;
}finally{
 await db?.$disconnect();
 if(created){const label=docker(['inspect',name,'--format','{{index .Config.Labels "dreamservice.test"}}']);if(label.status===0&&label.stdout.trim()==='temporary-admin'){const stopped=docker(['stop','--time','5',name]);if(stopped.status!==0){console.error('Disposable container cleanup requires review.');process.exitCode=1;}}}
}
