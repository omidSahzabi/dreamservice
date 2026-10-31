import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes, randomUUID, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {load} from './test-loader.mjs';

const password = randomBytes(32).toString('base64url'), salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 32, {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024});
const hash = 'scrypt-v1$' + salt.toString('hex') + '$' + key.toString('hex');
const phone = '09000000000', origin = 'https://production.example.invalid';
const {normalizePhone} = load('src/lib/auth/helper.ts');
const {verifyPreviewPassword} = load('src/lib/auth/preview-password.ts');

function fixture(t, {existing = true, banned = false, role = 'app-admin', onLock, verify = verifyPreviewPassword, failAt, failure = new Error('private-exception-marker')} = {}) {
  const start = Math.floor(Date.now() / 1000) * 1000;
  const variables = {TEMP_ADMIN_LOGIN_ENABLED: 'true', VERCEL_ENV: 'production', NODE_ENV: 'production',
    TEMP_ADMIN_LOGIN_HASH: hash, TEMP_ADMIN_LOGIN_PHONE: phone,
    TEMP_ADMIN_LOGIN_STARTED_AT: new Date(start).toISOString(), TEMP_ADMIN_LOGIN_EXPIRES_AT: new Date(start + 86400000).toISOString(),
    SECURITY_ORIGIN: origin, SECURITY_OTP_KEY: randomBytes(32).toString('hex'), SECURITY_TRUSTED_IP_HEADER: 'x-test-ip'};
  const previous = Object.fromEntries(Object.keys(variables).map(name => [name, process.env[name]]));
  Object.assign(process.env, variables);
  t.after(() => {for (const [name, value] of Object.entries(previous)) {if (value === undefined) delete process.env[name]; else process.env[name] = value;}});
  const account = existing ? {id: randomUUID(), contact: phone, bannedAt: banned ? new Date() : null, fname: 'Fixture', lname: 'Member', email: null} : null;
  let currentRole = role, locks = 0, verifications = 0;
  const sessions = [], buckets = new Map(), values = new Map(), options = new Map(), lookups = [];
  const logs = [];
  t.mock.method(console, 'warn', message => logs.push(String(message)));
  const db = {
    user: {findUnique: async args => {if(failAt==='account_lookup')throw failure;lookups.push(args.where); return account && (args.where.id === account.id || args.where.contact === account.contact) ? {...account} : null;}},
    personProfile: {findMany: async () => account ? [{user_id: account.id, role: currentRole}] : []},
    session: {
      create: async ({data}) => {if(failAt==='session_creation')throw failure;sessions.push({...data});return data;},
      deleteMany: async ({where}) => {let count=0;for(let i=sessions.length-1;i>=0;i--)if(where.token.in.includes(sessions[i].token)){sessions.splice(i,1);count++;}return {count};},
      findFirst: async ({where}) => {const row=sessions.find(row=>where.token.in.includes(row.token)&&row.expiresAt>where.expiresAt.gt);return row?{...row,user:{...account}}:null;},
    },
    securityRateLimit: {upsert: async ({where,create}) => {if(failAt==='source_rate_limit')throw failure;const row=buckets.get(where.key)??{...create,count:0};row.count++;buckets.set(where.key,row);return row;}},
    $queryRaw: async () => {locks++; onLock?.(account, value => {currentRole=value;}); return [];},
    $transaction: async run => {const before=sessions.slice();try{return await run(db);}catch(error){sessions.splice(0,sessions.length,...before);throw error;}},
  };
  const jar={get:name=>{if(failAt==='cookie_read')throw failure;return values.has(name)?{value:values.get(name)}:undefined;},set:(name,value,config)=>{if(failAt==='cookie_write')throw failure;values.set(name,value);options.set(name,config);}};
  const overrides = {'@/lib/prisma':{prisma:db}, 'next/headers':{cookies:async()=>jar}, '@/lib/account/profile':{usernameSupported:async()=>false},
    // Only fixtures replace the owner identity pin; production has no test fallback.
    '@/lib/auth/temporary-admin-phone':{isTemporaryAdminPhone:value=>{try{return normalizePhone(value)===phone;}catch{return false;}}},
    '@/lib/auth/preview-password':{verifyPreviewPassword:async(...args)=>{verifications++;return verify(...args);}},
    '@/lib/auth/sms':{sendOtpSms:()=>{throw Error('SMS must never be called');}},
  };
  const route=load('src/app/api/auth/temporary-admin-login/route.ts',overrides);
  const session=load('src/lib/auth/session.ts',overrides);
  const authorization=load('src/lib/auth/authorization.ts',overrides);
  const config=load('src/lib/auth/temporary-admin-config.ts',overrides);
  const send=(body={phone,password},headers={})=>route.POST(new Request(origin+'/api/auth/temporary-admin-login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-test-ip':'192.0.2.10',...headers},body:JSON.stringify(body),
  }));
  return {send,session,authorization,config,sessions,values,options,account,lookups,buckets,logs,route,setRole:value=>{currentRole=value;},get locks(){return locks;},get verifications(){return verifications;}};
}

for(const variant of ['missing-key','short-key','source_rate_limit','password_verification','account_lookup','session_creation','cookie_read','cookie_write','prisma-query'])test('sanitized unexpected-failure diagnostic: '+variant,async t=>{
  const {Prisma}=await import('@prisma/client');
  const failure=variant==='prisma-query'?new Prisma.PrismaClientKnownRequestError('private-exception-marker',{code:'P2021',clientVersion:'test',meta:{private:'private-exception-marker'}}):new Error('private-exception-marker');
  const f=fixture(t,{failAt:variant==='prisma-query'?'source_rate_limit':variant, failure,
    ...(variant==='password_verification'?{verify:async()=>{throw failure;}}:{})});
  if(variant==='missing-key')delete process.env.SECURITY_OTP_KEY;
  if(variant==='short-key')process.env.SECURITY_OTP_KEY='short';
  const response=await f.send();
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{success:false,code:'TEMP_ADMIN_LOGIN_FAILED'});
  const diagnostics=f.logs.map(line=>JSON.parse(line)).filter(event=>event.event==='temporary_admin_login_operation_failed');
  assert.equal(diagnostics.length,1);
  assert.deepEqual(diagnostics[0],{event:'temporary_admin_login_operation_failed',
    stage:['missing-key','short-key','prisma-query'].includes(variant)?'source_rate_limit':variant,
    category:['missing-key','short-key'].includes(variant)?'security_key_configuration':variant==='prisma-query'?'database_query':'unexpected',
    ...(variant==='prisma-query'?{code:'P2021'}:{})});
  assert.ok(f.logs.some(line=>JSON.parse(line).event==='operation_failed'));
  for(const secret of ['private-exception-marker',phone,password,hash])assert.ok(f.logs.every(line=>!line.includes(secret)));
  assert.equal(f.values.size,0);
  if(variant!=='cookie_write')assert.equal(f.sessions.length,0);
});

test('temporary Production login uses existing active exact-role account, secure scoped session and sanitized audit', async t=>{
  const f=fixture(t);
  const response=await f.send({phone:'+989000000000',password});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(f.locks,1);assert.equal(f.sessions.length,1);assert.equal(f.verifications,1);
  assert.equal(f.sessions[0].userId,f.account.id);
  assert.ok(f.sessions[0].token.startsWith('temporary-admin-password:'));
  assert.ok(!f.sessions[0].token.includes(f.values.get('dream_session')));
  const cookie=f.options.get('dream_session');assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'lax');assert.equal(cookie.path,'/');assert.ok(cookie.maxAge>0&&cookie.maxAge<=3600);
  assert.equal((await f.authorization.requireAdmin()).id,f.account.id);
  assert.ok(!f.values.has('dream_registration'));
  assert.ok(f.logs.some(line=>JSON.parse(line).event==='temporary_admin_login_succeeded'));
  for(const secret of [phone,password,hash,f.values.get('dream_session')])assert.ok(f.logs.every(line=>!line.includes(secret)));
});

for(const variant of ['wrong-password','denied-number','invalid-phone','missing-account','banned','customer','wrong-role-case','role-whitespace','ban-after-lookup','demote-after-lookup','phone-changed-after-lookup'])test('generic denial: '+variant,async t=>{
  const f=fixture(t,{existing:variant!=='missing-account',banned:variant==='banned',role:variant==='customer'?'customer':variant==='wrong-role-case'?'APP-ADMIN':variant==='role-whitespace'?'app-admin ':'app-admin',
    onLock:(account,setRole)=>{if(variant==='ban-after-lookup')account.bannedAt=new Date();if(variant==='demote-after-lookup')setRole('customer');if(variant==='phone-changed-after-lookup')account.contact='09000000001';}});
  const response=await f.send({phone:variant==='denied-number'?'09000000001':variant==='invalid-phone'?'bad':phone,password:variant==='wrong-password'?'wrong':password});
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{success:false,code:'TEMP_ADMIN_LOGIN_FAILED'});
  assert.equal(f.sessions.length,0);assert.equal(f.values.size,0);
  if(['wrong-password','denied-number','invalid-phone'].includes(variant)){assert.equal(f.lookups.length,0);assert.equal(f.verifications,1);}
});

for(const variant of ['absent','false','preview','development','missing-hash','bad-hash','bad-phone','multiple-phones','expired','future-start','too-long','invalid-date','missing-origin','http-origin','missing-ip-config'])test('configuration fails closed: '+variant,async t=>{
  const f=fixture(t);
  if(variant==='absent')delete process.env.TEMP_ADMIN_LOGIN_ENABLED;
  if(variant==='false')process.env.TEMP_ADMIN_LOGIN_ENABLED='false';
  if(variant==='preview')process.env.VERCEL_ENV='preview';
  if(variant==='development')process.env.NODE_ENV='development';
  if(variant==='missing-hash')delete process.env.TEMP_ADMIN_LOGIN_HASH;
  if(variant==='bad-hash')process.env.TEMP_ADMIN_LOGIN_HASH='invalid';
  if(variant==='bad-phone')process.env.TEMP_ADMIN_LOGIN_PHONE='09000000001';
  if(variant==='multiple-phones')process.env.TEMP_ADMIN_LOGIN_PHONE=phone+',09000000001';
  if(variant==='expired')process.env.TEMP_ADMIN_LOGIN_EXPIRES_AT='2020-01-01T00:00:00.000Z';
  if(variant==='future-start')process.env.TEMP_ADMIN_LOGIN_STARTED_AT=new Date(Math.floor((Date.now()+3600000)/1000)*1000).toISOString();
  if(variant==='too-long')process.env.TEMP_ADMIN_LOGIN_EXPIRES_AT=new Date(Date.parse(process.env.TEMP_ADMIN_LOGIN_STARTED_AT)+49*3600000).toISOString();
  if(variant==='invalid-date')process.env.TEMP_ADMIN_LOGIN_STARTED_AT='2026-02-30T00:00:00.000Z';
  if(variant==='missing-origin')delete process.env.SECURITY_ORIGIN;
  if(variant==='http-origin')process.env.SECURITY_ORIGIN='http://production.example.invalid';
  if(variant==='missing-ip-config')delete process.env.SECURITY_TRUSTED_IP_HEADER;
  // Missing origin is rejected by CSRF validation before config parsing.
  assert.equal((await f.send()).status,variant==='missing-origin'||variant==='http-origin'?403:401);
  assert.equal(f.sessions.length,0);assert.equal(f.buckets.size,0);assert.equal(f.verifications,0);
});

test('IP limits are enforced before password verification',async t=>{
  const now=Date.now();t.mock.method(Date,'now',()=>now);
  const f=fixture(t);
  for(let i=0;i<5;i++)assert.equal((await f.send({phone,password:'wrong'})).status,401);
  const response=await f.send();assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);assert.equal((await response.json()).code,'TEMP_ADMIN_LOGIN_FAILED');assert.equal(f.verifications,5);
});
test('endpoint-wide limit bounds distributed requests across phones and source IPs',async t=>{
  const now=Date.now();t.mock.method(Date,'now',()=>now);
  const f=fixture(t,{verify:async()=>false});
  for(let i=0;i<30;i++)assert.equal((await f.send({phone:'090'+String(i).padStart(8,'0'),password:'wrong'},{'x-test-ip':'192.0.2.'+(50+i)})).status,401);
  assert.equal((await f.send({phone:'09000000100',password:'wrong'},{'x-test-ip':'192.0.2.200'})).status,429);
  assert.equal(f.verifications,30);assert.equal(f.sessions.length,0);
});
test('canonical phone limit spans source addresses and equivalent number formats',async t=>{
  const now=Date.now();t.mock.method(Date,'now',()=>now);
  const f=fixture(t);
  for(let i=0;i<10;i++)assert.equal((await f.send({phone:i%2?'+989000000000':'9000000000',password:'wrong'},{'x-test-ip':'192.0.2.'+(30+i)})).status,401);
  assert.equal((await f.send(undefined,{'x-test-ip':'192.0.2.99'})).status,429);assert.equal(f.sessions.length,0);assert.equal(f.verifications,10);
});
test('cross-origin, content type, oversized/malformed credentials and untrusted sources cannot issue sessions',async t=>{
  const f=fixture(t);
  assert.equal((await f.send(undefined,{Origin:'https://foreign.invalid'})).status,403);
  assert.equal((await f.send(undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.send(undefined,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await f.send(undefined,{'x-test-ip':'192.0.2.1, 192.0.2.2'})).status,401);
  assert.equal((await f.send({phone,password,role:'app-admin'})).status,401);
  assert.equal((await f.send({phone,password:'x'.repeat(2100)})).status,401);
  assert.equal(f.sessions.length,0);assert.equal(f.verifications,0);
  assert.equal(f.route.GET,undefined);
});
test('session disable, hash rotation and activation expiry revoke password sessions without affecting OTP sessions',async t=>{
  const f=fixture(t);assert.equal((await f.send()).status,200);
  for(const [name,value]of [['TEMP_ADMIN_LOGIN_ENABLED','false'],['TEMP_ADMIN_LOGIN_HASH',hash.replace(/^scrypt-v1\$[a-f0-9]/,'scrypt-v1$'+(hash[10]==='a'?'b':'a'))],['TEMP_ADMIN_LOGIN_EXPIRES_AT','2020-01-01T00:00:00.000Z']]){
    const old=process.env[name];process.env[name]=value;assert.equal(await f.session.getCurrentUser(),null);process.env[name]=old;assert.ok(await f.session.getCurrentUser());
  }
  process.env.TEMP_ADMIN_LOGIN_ENABLED='false';
  const normal=randomBytes(32).toString('hex');f.sessions.push({userId:f.account.id,token:f.session.storedToken(normal),expiresAt:new Date(Date.now()+60000)});f.values.set('dream_session',normal);
  assert.ok(await f.session.getCurrentUser());
});
test('ban, demotion and phone change revoke marked sessions; normal customer sessions cannot access admin services',async t=>{
  const f=fixture(t);assert.equal((await f.send()).status,200);
  f.setRole('customer');assert.equal(await f.session.getCurrentUser(),null);f.setRole('app-admin');
  f.account.bannedAt=new Date();assert.equal(await f.session.getCurrentUser(),null);f.account.bannedAt=null;
  f.account.contact='09000000001';assert.equal(await f.session.getCurrentUser(),null);f.account.contact=phone;
  const normal=randomBytes(32).toString('hex');f.sessions.push({userId:f.account.id,token:f.session.storedToken(normal),expiresAt:new Date(Date.now()+60000)});f.values.set('dream_session',normal);f.setRole('customer');
  await assert.rejects(f.authorization.requireAdmin(),error=>error.status===403);
});
test('rotation, logout and expiry preserve existing session semantics',async t=>{
  const f=fixture(t);assert.equal((await f.send()).status,200);assert.equal((await f.send()).status,200);assert.equal(f.sessions.length,1);
  f.sessions[0].expiresAt=new Date(0);assert.equal(await f.session.getCurrentUser(),null);f.sessions[0].expiresAt=new Date(Date.now()+60000);
  await f.session.invalidateSession();assert.equal(f.sessions.length,0);assert.equal(f.values.get('dream_session'),'');
});
test('configuration disabled while authentication is in flight cannot establish a session',async t=>{
  const f=fixture(t,{onLock:()=>{process.env.TEMP_ADMIN_LOGIN_ENABLED='false';}});assert.equal((await f.send()).status,401);assert.equal(f.sessions.length,0);
});
test('session and cookie lifetime cannot outlive the activation window',async t=>{
  const f=fixture(t);process.env.TEMP_ADMIN_LOGIN_EXPIRES_AT=new Date(Math.floor((Date.now()+120000)/1000)*1000).toISOString();
  assert.equal((await f.send()).status,200);assert.ok(f.options.get('dream_session').maxAge<=120);assert.ok(f.sessions[0].expiresAt.getTime()<=Date.parse(process.env.TEMP_ADMIN_LOGIN_EXPIRES_AT));
});
test('real owner pin rejects other phones; localization and client/server separation remain explicit',()=>{
  const pin=load('src/lib/auth/temporary-admin-phone.ts');for(const value of [phone,'09000000001','bad',''])assert.equal(pin.isTemporaryAdminPhone(value),false);
  const en=JSON.parse(fs.readFileSync('messages/en.json','utf8')),fa=JSON.parse(fs.readFileSync('messages/fa.json','utf8'));
  assert.deepEqual(Object.keys(en.TemporaryAdminLogin).sort(),Object.keys(fa.TemporaryAdminLogin).sort());
  assert.ok(en.Errors.TEMP_ADMIN_LOGIN_FAILED&&fa.Errors.TEMP_ADMIN_LOGIN_FAILED);
  for(const value of Object.values(fa.TemporaryAdminLogin))assert.match(value,/[\u0600-\u06ff]/);
  const client=fs.readFileSync('src/components/modules/auth/TemporaryAdminLogin.tsx','utf8');assert.ok(!client.includes('process.env'));assert.ok(!client.includes('scrypt-v1'));
});
