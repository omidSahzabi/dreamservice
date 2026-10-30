import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID, createHash, createHmac} from 'node:crypto';
import {NextRequest} from 'next/server.js';
import {load} from './test-loader.mjs';

process.env.SECURITY_OTP_KEY = randomBytes(32).toString('hex');
process.env.SECURITY_ORIGIN = 'http://localhost';
const secret = () => randomBytes(32).toString('hex');
const hash = value => createHash('sha256').update(value).digest('hex');
const phone = '09000000000';
const otherPhone = '09000000001';

// In-memory transactional substitute, not a claim about real PostgreSQL locking.
function database() {
  let state = Object.fromEntries(['user','personProfile','session','otpVerification','registrationGrant','securityRateLimit','order','orderForm','image','userManagementAudit'].map(name => [name, []]));
  const calls = [];
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'client_id_idempotency_key') return matches(row, expected);
      if (key === 'OR') return expected.some(item => matches(row, item));
      const actual = row[key] ?? null;
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        return Object.entries(expected).every(([operator, operand]) => {
          if (operator === 'in') return operand.includes(actual);
          if (operator === 'gt') return actual > operand;
          if (operator === 'lt') return actual < operand;
          if (operator === 'not') return actual !== operand;
          if (operator === 'contains') return typeof actual === 'string' && actual.toLowerCase().includes(operand.toLowerCase());
          if (operator === 'mode') return true;
          throw new Error('Unsupported fixture predicate');
        });
      }
      return actual === expected;
    });
  }
  function project(row, args) {
    if (!row) return null;
    const result = args.select ? Object.fromEntries(Object.entries(args.select).filter(([,value]) => value === true).map(([key]) => [key, row[key]])) : {...row};
    if (args.include?.user) result.user = {...state.user.find(user => user.id === row.userId)};
    return structuredClone(result);
  }
  const prisma = {};
  for (const name of Object.keys(state)) {
    prisma[name] = {
      async findUnique(args) { calls.push([name,'findUnique',args]); return project(state[name].find(row => matches(row,args.where)),args); },
      async findFirst(args) {
        calls.push([name,'findFirst',args]);
        let rows = state[name].filter(row => matches(row,args.where));
        if (args.orderBy) for (const order of [...(Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy])].reverse()) {
          const [key,direction] = Object.entries(order)[0];
          rows = rows.sort((a,b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (direction === 'desc' ? -1 : 1));
        }
        return project(rows[0],args);
      },
      async findMany(args = {}) { calls.push([name,'findMany',args]); return state[name].filter(row => matches(row,args.where)).map(row => project(row,args)); },
      async count(args) { calls.push([name,'count',args]); return state[name].filter(row => matches(row,args.where)).length; },
      async create(args) {
        calls.push([name,'create',args]);
        if ((name === 'order' && state.order.some(row => row.client_id === args.data.client_id && row.idempotency_key === args.data.idempotency_key)) ||
          (name === 'user' && state.user.some(row => row.contact === args.data.contact))) throw Object.assign(new Error('Unique constraint'),{code:'P2002'});
        const row = {id:randomUUID(),createdAt:new Date(),attempts:0,consumedAt:null,...args.data};
        if (name === 'order') row.order_id = state.order.length + 1;
        state[name].push(row);
        return project(row,args);
      },
      async updateMany(args) {
        calls.push([name,'updateMany',args]);
        const rows = state[name].filter(row => matches(row,args.where));
        for (const row of rows) for (const [key,value] of Object.entries(args.data)) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
        return {count:rows.length};
      },
      async deleteMany(args) { const before = state[name].length; state[name] = state[name].filter(row => !matches(row,args.where)); return {count:before-state[name].length}; },
      async upsert(args) {
        const row = state[name].find(row => matches(row,args.where));
        if (row) { row.count += args.update.count.increment; return {...row}; }
        state[name].push({...args.create}); return {...args.create};
      }
    };
  }
  prisma.$queryRaw = async (sql) => {
    const text = Array.isArray(sql) ? sql.join('') : sql.strings.join('');
    calls.push(['raw', text]);
    if (text.includes('count(*)')) return [{total: BigInt(state.user.filter(user => !user.bannedAt && state.personProfile.some(profile => profile.user_id === user.id && profile.role === 'app-admin')).length)}];
    return [{locked:1}];
  };
  let pending = Promise.resolve();
  prisma.$transaction = operation => {
    if (Array.isArray(operation)) return Promise.all(operation);
    const result = pending.then(async () => {
      const before = structuredClone(state);
      try { return await operation(prisma); } catch (error) { state = before; throw error; }
    });
    pending = result.catch(() => {});
    return result;
  };
  return {prisma,calls,get state() {return state;}};
}

function environment(db = database()) {
  const values = new Map();
  const options = new Map();
  const jar = {get: name => values.has(name) ? {value:values.get(name)} : undefined, set(name,value,config) {values.set(name,value); options.set(name,config);}};
  const overrides = {'@/lib/prisma':{prisma:db.prisma},'next/headers':{cookies:async () => jar},'@/lib/security/rate-limit':{otpLimits:async () => {},enforceLimits:async () => {},requestSource:() => 'fixture'}};
  return {db,values,options,overrides,load:file => load(file,overrides)};
}

function request(body, headers = {}, endpoint = '/api/test') {
  return new Request('http://localhost'+endpoint,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
}
const user = (id = randomUUID(), contact = phone) => ({id,contact,fname:'Fixture',lname:'Customer',email:null});
function session(env, identity, roles = []) {
  const token = secret(); env.values.set('dream_session',token);
  env.db.state.user.push(identity);
  env.db.state.session.push({token:'sha256:'+hash(token),userId:identity.id,expiresAt:new Date(Date.now()+60000)});
  for (const role of roles) env.db.state.personProfile.push({user_id:identity.id,role});
}
function challenge(env, purpose = 'LOGIN') {
  const binding = secret(); const code = String(10000 + randomBytes(2).readUInt16BE()); const id = randomUUID();
  env.values.set('dream_auth_binding',binding); env.values.set('dream_otp_challenge',id);
  const codeHash = createHmac('sha256',process.env.SECURITY_OTP_KEY).update(JSON.stringify(['otp-v1',JSON.stringify([id,phone,purpose,code])])).digest('hex');
  const otp = {id,target:phone,channel:'PHONE',purpose,codeHash,browserBindingHash:hash(binding),deliveryState:'SENT',attempts:0,consumedAt:null,createdAt:new Date(),expiresAt:new Date(Date.now()+120000)};
  env.db.state.otpVerification.push(otp); return {code,otp,binding};
}

for (const roles of [[],['app-admin']]) test(roles.length ? 'administrator uses the same OTP login flow' : 'customer OTP login creates a protected session',async () => {
  const env = environment(); const identity = user(); env.db.state.user.push(identity);
  for (const role of roles) env.db.state.personProfile.push({user_id:identity.id,role});
  const {code} = challenge(env);
  const result = await env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code}));
  assert.equal(result.isNewUser,false); assert.equal(env.db.state.session.length,1);
  assert.ok(env.db.state.user[0].contactVerifiedAt instanceof Date);
  assert.ok(env.db.state.session[0].token.startsWith('sha256:'));
  assert.ok(env.db.state.session[0].token !== env.values.get('dream_session'));
  const principal = await env.load('src/lib/auth/authorization.ts').requireAuth();
  assert.equal(principal.permission,roles.length ? 'ADMIN' : 'CUSTOMER');
});

for (const [name,change,expected] of [
  ['invalid code',(_,body) => {body.code = '00000';},'OTP_INVALID'],
  ['expired challenge',otp => {otp.expiresAt = new Date(0);},'OTP_EXPIRED'],
  ['reused challenge',otp => {otp.consumedAt = new Date();},'OTP_USED'],
  ['superseded challenge',otp => {otp.consumedAt = new Date();},'OTP_USED'],
  ['wrong purpose',(_,body) => {body.purpose = 'REGISTER';},'OTP_INVALID'],
  ['exhausted attempts',otp => {otp.attempts = 5;},'OTP_ATTEMPTS_EXCEEDED'],
  ['legacy unbound challenge',otp => {otp.browserBindingHash = null;},'OTP_INVALID'],
  ['pending delivery',otp => {otp.deliveryState = 'PENDING';},'OTP_INVALID'],
  ['failed delivery',otp => {otp.deliveryState = 'FAILED';},'OTP_INVALID'],
  ['wrong browser',otp => {otp.browserBindingHash = hash(secret());},'OTP_INVALID']
]) test('OTP rejects '+name,async () => {
  const env = environment(); const {code,otp} = challenge(env); const body = {target:phone,code}; change(otp,body);
  await assert.rejects(env.load('src/lib/auth/otp.ts').verifyOtpRequest(request(body)),error => error.code === expected);
  assert.equal(env.db.state.session.length,0); assert.equal(env.db.state.registrationGrant.length,0);
});

test('parallel invalid verifications reserve at most five attempts',async () => {
  const env = environment(); const {otp} = challenge(env);
  const auth = env.load('src/lib/auth/otp.ts');
  const results = await Promise.allSettled(Array.from({length:12},() => auth.verifyOtpRequest(request({target:phone,code:'00000'}))));
  assert.equal(otp.attempts,5); assert.ok(results.every(result => result.status === 'rejected'));
});

test('parallel valid verification consumes one challenge and issues one session',async () => {
  const env = environment(); env.db.state.user.push(user()); const {code} = challenge(env);
  const auth = env.load('src/lib/auth/otp.ts');
  const results = await Promise.allSettled([auth.verifyOtpRequest(request({target:phone,code})),auth.verifyOtpRequest(request({target:phone,code}))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1); assert.equal(env.db.state.session.length,1);
});

test('REGISTER purpose cannot log in an existing customer',async () => {
  const env = environment(); env.db.state.user.push(user()); const {code} = challenge(env,'REGISTER');
  await assert.rejects(env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code,purpose:'REGISTER'})),error => error.code === 'OTP_INVALID');
  assert.equal(env.db.state.session.length,0);
});

async function registrationEnvironment() {
  const env = environment(); const {code} = challenge(env);
  await env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code}));
  return env;
}
const registration = contact => request({contact,fname:'Fixture',lname:'Customer'});

test('verified new phone receives browser-bound registration proof and completes once',async () => {
  const env = await registrationEnvironment();
  assert.equal(env.db.state.registrationGrant.length,1);
  const {POST} = env.load('src/app/api/auth/register/route.ts');
  assert.equal((await POST(registration(phone))).status,200);
  assert.equal((await POST(registration(phone))).status,403);
  assert.equal(env.db.state.user.length,1); assert.equal(env.db.state.session.length,1);
  assert.ok(env.db.state.user[0].contactVerifiedAt instanceof Date);
});
for (const [name,change] of [
  ['phone substitution',() => otherPhone],
  ['missing completion cookie',env => {env.values.delete('dream_registration');}],
  ['cross-browser proof theft',env => {env.values.set('dream_auth_binding',secret());}],
  ['expired proof',env => {env.db.state.registrationGrant[0].expiresAt = new Date(0);}],
  ['replayed proof',env => {env.db.state.registrationGrant[0].consumedAt = new Date();}],
  ['wrong proof purpose',env => {env.db.state.registrationGrant[0].purpose = 'LOGIN';}],
  ['existing customer claim',env => {env.db.state.user.push(user());}]
]) test('registration rejects '+name,async () => {
  const env = await registrationEnvironment(); const contact = change(env) ?? phone;
  assert.equal((await env.load('src/app/api/auth/register/route.ts').POST(registration(contact))).status,name==='existing customer claim'?409:403);
  assert.equal(env.db.state.session.length,0);
});

test('phone and consumed OTP alone never authorize registration',async () => {
  const env = environment(); const {otp} = challenge(env); otp.consumedAt = new Date();
  assert.equal((await env.load('src/app/api/auth/register/route.ts').POST(registration(phone))).status,403);
});
test('parallel registration creates one customer and one session',async () => {
  const env = await registrationEnvironment(); const route = env.load('src/app/api/auth/register/route.ts');
  const results = await Promise.all([route.POST(registration(phone)),route.POST(registration(phone))]);
  assert.deepEqual(results.map(result => result.status).sort(),[200,403]);
  assert.equal(env.db.state.user.length,1); assert.equal(env.db.state.session.length,1);
});
test('registration transaction rolls proof and user back when session insertion fails',async () => {
  const env = await registrationEnvironment(); env.db.prisma.session.create = async () => {throw new Error('Synthetic failure');};
  const route = env.load('src/app/api/auth/register/route.ts');
  assert.equal((await route.POST(registration(phone))).status,500);
  assert.equal(env.db.state.user.length,0); assert.equal(env.db.state.registrationGrant[0].consumedAt,null);
});

for (const roles of [[],['ADMIN'],['admin'],['App-Admin'],['app-admin '],['developer','CUSTOMER'],[null]]) test('noncanonical role assignment grants no administrator privilege: '+JSON.stringify(roles),async () => {
  const env = environment(); session(env,user(),roles);
  const auth = env.load('src/lib/auth/authorization.ts');
  assert.equal((await auth.requireAuth()).permission,'CUSTOMER');
  await assert.rejects(auth.requireAdmin(),error => error.status === 403);
});
test('exact admin membership among multiple own profiles is recognized and re-evaluated',async () => {
  const env = environment(); const identity = user(); session(env,identity,['developer','app-admin']);
  const auth = env.load('src/lib/auth/authorization.ts'); assert.equal((await auth.requireAdmin()).permission,'ADMIN');
  env.db.state.personProfile = env.db.state.personProfile.filter(profile => profile.role !== 'app-admin');
  await assert.rejects(auth.requireAdmin(),error => error.status === 403);
});
test('another users administrator profile does not grant privilege',async () => {
  const env = environment(); session(env,user()); env.db.state.personProfile.push({user_id:randomUUID(),role:'app-admin'});
  await assert.rejects(env.load('src/lib/auth/authorization.ts').requireAdmin(),error => error.status === 403);
});
for (const kind of ['missing','invalid','expired','deleted','digest-as-cookie']) test('session rejects '+kind,async () => {
  const env = environment();
  if (kind !== 'missing') session(env,user());
  if (kind === 'invalid') env.values.set('dream_session','invalid');
  if (kind === 'expired') env.db.state.session[0].expiresAt = new Date(0);
  if (kind === 'deleted') env.db.state.session.length = 0;
  if (kind === 'digest-as-cookie') env.values.set('dream_session',env.db.state.session[0].token);
  assert.equal(await env.load('src/lib/auth/session.ts').getCurrentUser(),null);
});
test('legacy raw session remains valid without rewriting database records',async () => {
  const env = environment(); session(env,user()); env.db.state.session[0].token = env.values.get('dream_session');
  assert.ok(await env.load('src/lib/auth/session.ts').getCurrentUser()); assert.equal(env.db.state.session.length,1);
});
test('new login rotates the presented session without revoking unrelated sessions',async () => {
  const env = environment(); const identity = user(); session(env,identity); const {code} = challenge(env);
  env.db.state.session.push({token:'sha256:'+hash(secret()),userId:identity.id,expiresAt:new Date(Date.now()+60000)});
  await env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code}));
  assert.equal(env.db.state.session.length,2);
});
test('logout revokes server session and expires authentication cookies',async () => {
  const env = environment(); session(env,user());
  assert.equal((await env.load('src/app/api/auth/logout/route.ts').POST(request({}))).status,200);
  assert.equal(env.db.state.session.length,0); assert.equal(env.options.get('dream_session').maxAge,0);
});
test('logout database failure clears local cookie but never reports successful revocation',async () => {
  const env = environment(); session(env,user()); env.db.prisma.session.deleteMany = async () => {throw new Error('Synthetic failure');};
  assert.equal((await env.load('src/app/api/auth/logout/route.ts').POST(request({}))).status,500);
  assert.equal(env.options.get('dream_session').maxAge,0); assert.equal(env.db.state.session.length,1);
});
test('production authentication cookies use secure HttpOnly SameSite and fixed path',async () => {
  const env = environment(); const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    await env.load('src/lib/auth/session.ts').setSessionCookie(secret());
    const options = env.options.get('dream_session'); assert.equal(options.secure,true); assert.equal(options.httpOnly,true); assert.equal(options.sameSite,'lax'); assert.equal(options.path,'/'); assert.ok(options.maxAge > 0);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

function orderForm() {
  return {id:1,form_key:'order',show_progress:true,allow_back:true,steps:[{id:1,step_key:'details',step_order:1,fields:[
    {field_key:'service_type',field_type:'select',required:true,options:[{option_value:'web'}]},
    {field_key:'budget_range',field_type:'radio',required:true,options:[{option_value:'small'}]},
    {field_key:'page_count',field_type:'number',required:true,validation:{min:1,max:20},options:[]},
    {field_key:'project_description',field_type:'textarea',required:true,validation:{minLength:3,maxLength:100},options:[]},
    {field_key:'details',field_type:'text',required:true,visibility:{operator:'AND',conditions:[{field:'page_count',operator:'equals',value:20}]},options:[]}
  ]}]};
}
const validOrder = () => ({formKey:'order',data:{service_type:'web',budget_range:'small',page_count:3,project_description:'Synthetic fixture'}});
const orderRequest = (body = validOrder(), key = randomUUID()) => request(body,{'Idempotency-Key':key});
function orderEnvironment(admin = false) { const env = environment(); session(env,user(),admin ? ['app-admin'] : []); env.db.state.orderForm.push({...orderForm(),status:'published'}); return env; }

for (const operation of ['read','create']) test('anonymous order '+operation+' is rejected before resource queries',async () => {
  const env = environment(); const response = operation === 'read' ? await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders')) : await env.load('src/app/api/order/submit-order/route.ts').POST(orderRequest());
  assert.equal(response.status,401); assert.equal(env.db.calls.filter(([name]) => name === 'order').length,0);
});
test('customer listing queries and counts always use trusted ownership and omit metadata',async () => {
  const env = orderEnvironment(); const identity = env.db.state.user[0];
  env.db.state.order.push({client_id:identity.id,order_id:1,meta:{private:true}},{client_id:randomUUID(),order_id:2,meta:{private:true}});
  const response = await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders'));
  assert.equal(response.status,200); const body = await response.json(); assert.equal(body.pagination.total,1); assert.equal(body.data.length,1); assert.equal(body.data[0].meta,null);
  assert.ok(env.db.calls.filter(([name,method]) => name === 'order' && ['count','findMany'].includes(method)).every(([, ,args]) => args.where.client_id === identity.id));
});
for (const query of ['client_id='+randomUUID(),'includeClient=true']) test('customer cannot select another owner or privileged client view: '+query.split('=')[0],async () => {
  const env = orderEnvironment();
  assert.equal((await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders?'+query))).status,403);
  assert.equal(env.db.calls.filter(([name]) => name === 'order').length,0);
});
test('administrator listing can read authorized records across customers',async () => {
  const env = orderEnvironment(true); env.db.state.order.push({client_id:randomUUID(),order_id:1,meta:{}},{client_id:randomUUID(),order_id:2,meta:{}});
  const response = await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders?includeClient=true'));
  assert.equal(response.status,200); assert.equal((await response.json()).pagination.total,2);
});
for (const query of ['page=10001','limit=101','sortBy=token','client_id=invalid']) test('order query validation rejects '+query.split('=')[0],async () => {
  const env = orderEnvironment(); assert.equal((await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders?'+query))).status,422);
});
for (const [name,change] of [
  ['forged owner',body => {body.data.client_id = randomUUID();}],
  ['client role',body => {body.data.role = 'app-admin';}],
  ['injected initial status',body => {body.data.status = 'COMPLETED';}],
  ['price',body => {body.data.price = 1;}],
  ['unknown field',body => {body.data.unexpected = 'value';}],
  ['unknown select value',body => {body.data.service_type = 'unknown';}],
  ['unknown radio value',body => {body.data.budget_range = 'unknown';}],
  ['missing required field',body => {delete body.data.project_description;}],
  ['conditional required field',body => {body.data.page_count = 20;}],
  ['negative page count',body => {body.data.page_count = -1;}],
  ['fractional page count',body => {body.data.page_count = 1.5;}],
  ['numeric range',body => {body.data.page_count = 21;}],
  ['oversized string',body => {body.data.project_description = 'x'.repeat(101);}],
  ['unknown form key',body => {body.formKey = 'unpublished';}],
  ['unexpected wrapper field',body => {body.status = 'COMPLETED';}]
]) test('order validation rejects '+name,async () => {
  const env = orderEnvironment(); const body = validOrder(); change(body);
  assert.equal((await env.load('src/app/api/order/submit-order/route.ts').POST(orderRequest(body))).status,422);
  assert.equal(env.db.state.order.length,0);
});
test('order ownership and initial status are server controlled; hidden fields are discarded',async () => {
  const env = orderEnvironment(); const body = validOrder(); body.data.details = 'hidden';
  const response = await env.load('src/app/api/order/submit-order/route.ts').POST(orderRequest(body));
  assert.equal(response.status,201); assert.equal(env.db.state.order[0].client_id,env.db.state.user[0].id); assert.equal(env.db.state.order[0].status,'PENDING'); assert.equal('details' in env.db.state.order[0].meta,false);
  assert.deepEqual(Object.keys(await response.json()).sort(),['order_id','success']);
});
test('order idempotency returns original result and rejects changed content',async () => {
  const env = orderEnvironment(); const route = env.load('src/app/api/order/submit-order/route.ts'); const key = randomUUID();
  assert.equal((await route.POST(orderRequest(validOrder(),key))).status,201);
  assert.equal((await route.POST(orderRequest(validOrder(),key))).status,200);
  const body = validOrder(); body.data.page_count = 4;
  assert.equal((await route.POST(orderRequest(body,key))).status,409); assert.equal(env.db.state.order.length,1);
});
test('concurrent identical order requests produce one order through unique-key recovery',async () => {
  const env = orderEnvironment(); const route = env.load('src/app/api/order/submit-order/route.ts'); const key = randomUUID();
  const responses = await Promise.all([route.POST(orderRequest(validOrder(),key)),route.POST(orderRequest(validOrder(),key))]);
  assert.deepEqual(responses.map(response => response.status).sort(),[200,201]); assert.equal(env.db.state.order.length,1);
});
test('idempotency keys are customer scoped',async () => {
  const db = database(); const first = environment(db); const second = environment(db); session(first,user()); session(second,user(randomUUID(),otherPhone)); db.state.orderForm.push({...orderForm(),status:'published'});
  const key = randomUUID(); assert.equal((await first.load('src/app/api/order/submit-order/route.ts').POST(orderRequest(validOrder(),key))).status,201); assert.equal((await second.load('src/app/api/order/submit-order/route.ts').POST(orderRequest(validOrder(),key))).status,201); assert.equal(db.state.order.length,2);
});
test('order creation requires a valid idempotency key',async () => {
  const env = orderEnvironment(); assert.equal((await env.load('src/app/api/order/submit-order/route.ts').POST(request(validOrder()))).status,400);
});

for (const [name,header,value,status] of [['untrusted origin','Origin','https://untrusted.invalid',403],['missing origin','Origin','',403],['wrong content type','Content-Type','text/plain',415],['cross-site fetch','Sec-Fetch-Site','cross-site',403]]) test('mutations reject '+name,async () => {
  const env = orderEnvironment(); assert.equal((await env.load('src/app/api/order/submit-order/route.ts').POST(request(validOrder(),{[header]:value}))).status,status);
});
test('malformed JSON is a safe input failure',async () => {
  const env = orderEnvironment(); const req = new Request('http://localhost/api/order/submit-order',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:'{'});
  assert.equal((await env.load('src/app/api/order/submit-order/route.ts').POST(req)).status,400);
});
test('streamed body size is enforced independently of Content-Length',async () => {
  const env = orderEnvironment(); assert.equal((await env.load('src/app/api/order/submit-order/route.ts').POST(request({data:'x'.repeat(70000)}))).status,413);
});
test('authenticated API responses are private and not cacheable',async () => {
  const env = orderEnvironment(); const response = await env.load('src/app/api/auth/me/route.ts').GET(); assert.ok(response.headers.get('cache-control').includes('no-store')); assert.equal(response.headers.get('vary'),'Cookie');
});
test('display-role tampering cannot create or change database role assignments',async () => {
  const env = orderEnvironment(); const route = env.load('src/app/api/auth/switch-role/route.ts');
  assert.equal((await route.POST(request({role:'app-admin'}))).status,403); assert.equal(env.db.state.personProfile.length,0);
});

for (const permission of [null,'CUSTOMER','ADMIN']) test('admin page server gate: '+String(permission),async () => {
  const AccessRequired = () => null;
  const page = load('src/app/[locale]/order/review-orders/page.tsx',{
    '@/lib/auth/authorization':{getAuthenticatedPrincipal:async () => permission ? {id:'fixture',permission} : null},
    '@/lib/i18n/metadata':{},'@/components/modules/auth/AccessRequired':{AccessRequired},'@/features/order/review-orders':{ReviewOrdersView:() => null}
  });
  const result = await page.default();
  if (permission === 'ADMIN') assert.equal(result.type,'main');
  else {assert.equal(result.type,AccessRequired); assert.equal(result.props.forbidden,permission === 'CUSTOMER');}
});

test('public team is empty without an explicitly configured roster',async () => {
  delete process.env.PUBLIC_TEAM_PROFILE_IDS; const env = environment();
  assert.deepEqual(await (await env.load('src/app/api/team/route.ts').GET()).json(),[]); assert.equal(env.db.calls.length,0);
});
test('published team response excludes identifiers and authorization roles',async () => {
  process.env.PUBLIC_TEAM_PROFILE_IDS = '1'; const env = environment(); const identity = user(); env.db.state.user.push(identity); env.db.state.personProfile.push({pr_id:1,user_id:identity.id,role:'app-admin'});
  try {
    const body = await (await env.load('src/app/api/team/route.ts').GET()).json();
    assert.deepEqual(Object.keys(body[0]).sort(),['image','user','websiteUrl']); assert.deepEqual(Object.keys(body[0].user).sort(),['fname','lname']);
  } finally {delete process.env.PUBLIC_TEAM_PROFILE_IDS;}
});

test('rate limits share database state across module instances and normalize purposes',async () => {
  const db = database(); const overrides = {'@/lib/prisma':{prisma:db.prisma}};
  const first = load('src/lib/security/rate-limit.ts',overrides); const second = load('src/lib/security/rate-limit.ts',overrides);
  await first.otpLimits(phone,'fixture',false);
  await assert.rejects(second.otpLimits(phone,'fixture',false),error => error.status === 429);
  assert.ok(db.state.securityRateLimit.every(bucket => !bucket.key.includes(phone)));
});
test('parallel rate-limit reservations permit only the configured budget',async () => {
  const db = database(); const limiter = load('src/lib/security/rate-limit.ts',{'@/lib/prisma':{prisma:db.prisma}});
  const results = await Promise.allSettled(Array.from({length:10},() => limiter.enforceLimits([{scope:'fixture',subject:'source',seconds:60,maximum:3}])));
  assert.equal(results.filter(result => result.status === 'fulfilled').length,3);
});
test('untrusted forwarding headers are not used as rate-limit identities',() => {
  delete process.env.SECURITY_TRUSTED_IP_HEADER; const limiter = load('src/lib/security/rate-limit.ts',{'@/lib/prisma':{prisma:database().prisma}});
  assert.equal(limiter.requestSource(request({}, {'X-Forwarded-For':'127.0.0.2'})),'unknown');
});

test('successful issuance stores keyed challenge material and consumes older challenges',async () => {
  const env = environment(); const {otp} = challenge(env); otp.createdAt = new Date(Date.now()-61000);
  env.overrides['@/lib/auth/sms'] = {sendOtpSms:async () => ({success:true})};
  await env.load('src/lib/auth/otp.ts').requestOtp(request({target:phone}));
  assert.ok(otp.consumedAt); assert.equal(env.db.state.otpVerification[1].deliveryState,'SENT'); assert.equal(env.db.state.otpVerification[1].browserBindingHash,hash(env.values.get('dream_auth_binding')));
});
test('failed delivery cannot leave a verifiable challenge',async () => {
  const env = environment(); env.overrides['@/lib/auth/sms'] = {sendOtpSms:async () => ({success:false})};
  await assert.rejects(env.load('src/lib/auth/otp.ts').requestOtp(request({target:phone})),error => error.status === 502); assert.equal(env.db.state.otpVerification[0].deliveryState,'FAILED'); assert.equal(env.values.has('dream_otp_challenge'),false);
});
test('exact resend cooldown is enforced across purposes',async () => {
  const env = environment(); challenge(env,'LOGIN'); env.overrides['@/lib/auth/sms'] = {sendOtpSms:async () => {throw new Error('Must not deliver');}};
  await assert.rejects(env.load('src/lib/auth/otp.ts').requestOtp(request({target:phone,purpose:'REGISTER'})),error => error.status === 429);
});
test('SMS delivery is disabled outside explicitly enabled production',async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'test'; let calls = 0; const original = globalThis.fetch; globalThis.fetch = async () => {calls++; throw new Error('No network');};
  try { assert.equal((await load('src/lib/auth/sms.ts').sendOtpSms({to:phone,code:secret()})).success,false); assert.equal(calls,0); }
  finally {globalThis.fetch = original; if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;}
});

test('identity cleanup cancels/removes sensitive caches, clears drafts and display roles',async () => {
  const calls = []; const client = {cancelQueries:async ({predicate}) => {assert.equal(predicate({queryKey:['orders']}),true); assert.equal(predicate({queryKey:['order-form-config','fa']}),false); calls.push('cancel');},removeQueries:() => calls.push('remove')};
  const clientState = load('src/lib/auth/client-state.ts',{'@/store/orderStore':{useOrderStore:{getState:() => ({resetForm:() => calls.push('draft')})}},'@/store/userStore':{useUserStore:{getState:() => ({setActiveRole:value => {assert.equal(value,null); calls.push('role');}})}}});
  await clientState.clearSensitiveState(client); assert.deepEqual(calls,['cancel','remove','draft','role']);
});

for (const [name,response,expected] of [
  ['documented acceptance',{status:200,body:{meta:{status:true,message_code:'200-1'},data:{message_outbox_ids:[1]}}},true],
  ['application rejection',{status:200,body:{meta:{status:false,message_code:'400-1'},data:null}},false],
  ['HTTP rejection',{status:401,body:{meta:{status:false}}},false],
  ['missing receipt',{status:200,body:{meta:{status:true,message_code:'200-1'},data:{}}},false],
  ['malformed response',{status:200,body:null},false]
]) test('SMS contract handles '+name+' without live requests',async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; process.env.SECURITY_SMS_ENABLED = 'true';
  process.env.FARAZSMS_API_KEY = secret(); process.env.FARAZSMS_PATTERN_CODE = 'fixture'; process.env.FARAZSMS_SENDER_NUMBER = '+98000000';
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url,options) => {
    calls++; assert.equal(url,'https://edge.ippanel.com/v1/api/send'); assert.ok(options.signal instanceof AbortSignal); assert.equal(options.redirect,'error');
    return new Response(JSON.stringify(response.body),{status:response.status});
  };
  try { assert.equal((await load('src/lib/auth/sms.ts').sendOtpSms({to:phone,code:secret()})).success,expected); assert.equal(calls,1); }
  finally {globalThis.fetch = original; delete process.env.SECURITY_SMS_ENABLED; delete process.env.FARAZSMS_API_KEY; delete process.env.FARAZSMS_PATTERN_CODE; delete process.env.FARAZSMS_SENDER_NUMBER; if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;}
});

test('SMS timeout or network failure fails closed',async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; process.env.SECURITY_SMS_ENABLED = 'true';
  process.env.FARAZSMS_API_KEY = secret(); process.env.FARAZSMS_PATTERN_CODE = 'fixture'; process.env.FARAZSMS_SENDER_NUMBER = '+98000000';
  const original = globalThis.fetch; globalThis.fetch = async () => {throw new DOMException('Synthetic timeout','TimeoutError');};
  try {assert.equal((await load('src/lib/auth/sms.ts').sendOtpSms({to:phone,code:secret()})).success,false);}
  finally {globalThis.fetch = original; delete process.env.SECURITY_SMS_ENABLED; delete process.env.FARAZSMS_API_KEY; delete process.env.FARAZSMS_PATTERN_CODE; delete process.env.FARAZSMS_SENDER_NUMBER; if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;}
});

test('review query keys partition identity and disable revoked administrator access',() => {
  for (const permission of ['ADMIN','CUSTOMER']) {
    const hook = load('src/features/order/review-orders/hooks/use-review-orders.ts',{
      '@tanstack/react-query':{useQuery:options => options},'@/hooks/useAuth':{useAuth:() => ({user:{id:'fixture-user',permission},isError:false})}
    });
    const options = hook.useReviewOrders({page:1}); assert.equal(options.enabled,permission === 'ADMIN'); assert.equal(options.queryKey[1],'fixture-user'); assert.equal(options.queryKey[2],permission); assert.equal('placeholderData' in options,false);
  }
});

test('order drafts remain memory-only and identity reset removes idempotency state',() => {
  const {useOrderStore} = load('src/store/orderStore.ts');
  useOrderStore.getState().updateFormData({project_description:'Synthetic draft'});
  useOrderStore.getState().setSubmission({fingerprint:'fixture',key:randomUUID()});
  assert.equal('persist' in useOrderStore,false); useOrderStore.getState().resetForm(); assert.deepEqual(useOrderStore.getState().formData,{}); assert.equal(useOrderStore.getState().submission,null);
});

test('registration API refuses privileged role fields',async () => {
  const env = await registrationEnvironment();
  const response = await env.load('src/app/api/auth/register/route.ts').POST(request({contact:phone,fname:'Fixture',lname:'Customer',role:'app-admin'}));
  assert.equal(response.status,422); assert.equal(env.db.state.personProfile.length,0); assert.equal(env.db.state.user.length,0);
});

test('canonical order fingerprints ignore object key order',() => {
  const {canonicalJson} = load('src/lib/order/validation.ts',{'@/lib/prisma':{prisma:database().prisma}});
  assert.equal(canonicalJson({z:1,a:{b:2,a:1}}),canonicalJson({a:{a:1,b:2},z:1}));
});

test('logout revokes pending registration proof as well as local cookies',async () => {
  const env = await registrationEnvironment();
  assert.equal((await env.load('src/app/api/auth/logout/route.ts').POST(request({}))).status,200);
  assert.ok(env.db.state.registrationGrant[0].consumedAt);
});
test('logout revokes the current browser-bound OTP challenge',async () => {
  const env = environment(); const {otp} = challenge(env);
  assert.equal((await env.load('src/app/api/auth/logout/route.ts').POST(request({}))).status,200);
  assert.ok(otp.consumedAt);
});
test('authorization database failure fails closed without exposing the database exception',async () => {
  const env = orderEnvironment(); env.db.prisma.personProfile.findMany = async () => {throw new Error('Synthetic private database detail');};
  const response = await env.load('src/app/api/order/submit-order/route.ts').POST(orderRequest());
  assert.equal(response.status,503); assert.deepEqual(await response.json(),{success:false,code:'UNKNOWN'}); assert.equal(env.db.state.order.length,0);
});

test('hidden controlling fields cannot suppress required visible fields',() => {
  const {createFormSchema} = load('src/schemas/orderSchema.ts');
  const steps = [{id:'s',title:'Fixture',order:1,fields:[
    {id:'service',label:'Fixture',type:'text',required:true},
    {id:'hiddenControl',label:'Fixture',type:'text',visibility:{operator:'AND',conditions:[{field:'service',operator:'equals',value:'app'}]}},
    {id:'requiredDetails',label:'Fixture',type:'text',required:true,visibility:{operator:'AND',conditions:[{field:'hiddenControl',operator:'not_equals',value:'skip'}]}}
  ]}];
  const values = {service:'web',hiddenControl:'skip'};
  assert.equal(createFormSchema(steps,values,key => key).safeParse(values).success,false);
});
test('published form contracts reject cyclic or unknown visibility dependencies',() => {
  const {orderFormConfigSchema} = load('src/schemas/orderFormConfig.ts');
  const form = {form:{id:'1',key:'order',title:'Fixture',settings:{showProgress:true,allowBack:true,submitButtonText:''},steps:[{id:'1',title:'Fixture',order:1,fields:[{id:'value',type:'text',label:'Fixture',visibility:{operator:'AND',conditions:[{field:'value',operator:'equals',value:'x'}]}}]}]}};
  assert.equal(orderFormConfigSchema.safeParse(form).success,false);
  form.form.steps[0].fields[0].visibility.conditions[0].field = 'missing';
  assert.equal(orderFormConfigSchema.safeParse(form).success,false);
});

function consoleDeliveryEnvironment(t, nodeEnv = 'development', mode = 'console') {
  const previous = {NODE_ENV:process.env.NODE_ENV, OTP_DELIVERY_MODE:process.env.OTP_DELIVERY_MODE};
  process.env.NODE_ENV = nodeEnv;
  if (mode === null) delete process.env.OTP_DELIVERY_MODE;
  else process.env.OTP_DELIVERY_MODE = mode;
  t.after(() => {
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const env = environment();
  const lines = [];
  t.mock.method(console,'info',(...args) => {lines.push(args);});
  let smsCalls = 0;
  env.overrides['@/lib/auth/sms'] = {sendOtpSms:async () => {smsCalls++; return {success:false};}};
  return {env,lines,get smsCalls() {return smsCalls;}};
}

test('development console prints only after SENT persistence and preserves OTP login and replay protection',async t => {
  const fixture = consoleDeliveryEnvironment(t);
  const {env,lines} = fixture;
  env.db.state.user.push(user());
  let sentBeforeOutput = false;
  t.mock.method(console,'info',(...args) => {
    sentBeforeOutput = env.db.state.otpVerification.length === 1 && env.db.state.otpVerification[0].deliveryState === 'SENT';
    lines.push(args);
  });
  const response = await env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{success:true,expiresIn:120,retryAfter:60});
  assert.equal(fixture.smsCalls,0);
  assert.ok(sentBeforeOutput && lines.length === 1);
  const [prefix,destination,code] = lines[0];
  assert.ok(prefix.startsWith('[development OTP]') && destination === phone && /^\d{5}$/.test(code));
  const row = env.db.state.otpVerification[0];
  assert.ok(row.codeHash !== code && row.browserBindingHash === hash(env.values.get('dream_auth_binding')));
  await env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code}));
  assert.equal(env.db.state.session.length,1);
  assert.ok(row.consumedAt && env.db.state.session[0].token.startsWith('sha256:'));
  await assert.rejects(env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code})),error => error.code.startsWith('OTP_'));
});

test('development console verified new phone still requires the single-use registration grant',async t => {
  const {env,lines} = consoleDeliveryEnvironment(t);
  await env.load('src/lib/auth/otp.ts').requestOtp(request({target:phone}));
  await env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code:lines[0][2]}));
  assert.equal(env.db.state.registrationGrant.length,1);
  assert.equal(env.db.state.session.length,0);
  const route = env.load('src/app/api/auth/register/route.ts');
  assert.equal((await route.POST(registration(phone))).status,200);
  assert.equal((await route.POST(registration(phone))).status,403);
  assert.equal(env.db.state.user.length,1);
  assert.equal(env.db.state.session.length,1);
});

for (const nodeEnv of ['production','test']) test('console mode is rejected without delivery or database writes in '+nodeEnv,async t => {
  const fixture = consoleDeliveryEnvironment(t,nodeEnv);
  const response = await fixture.env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{success:false,code:'SMS_FAILED'});
  assert.equal(fixture.smsCalls,0);
  assert.equal(fixture.lines.length,0);
  assert.equal(fixture.env.db.calls.length,0);
});

for (const failure of ['create','delivery-write','delivery-cas']) test('console never prints a usable code on database '+failure+' failure',async t => {
  const fixture = consoleDeliveryEnvironment(t);
  const {env} = fixture;
  if (failure === 'create') env.db.prisma.otpVerification.create = async () => {throw new Error('Synthetic persistence failure');};
  else {
    const updateMany = env.db.prisma.otpVerification.updateMany;
    env.db.prisma.otpVerification.updateMany = async args => {
      if (args.where.deliveryState !== 'PENDING') return updateMany(args);
      if (failure === 'delivery-write') throw new Error('Synthetic delivery persistence failure');
      return {count:0};
    };
  }
  const response = await env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}));
  assert.equal(response.status,failure === 'delivery-cas' ? 502 : 500);
  assert.equal(fixture.lines.length,0);
  assert.equal(fixture.smsCalls,0);
  assert.equal(env.values.has('dream_otp_challenge'),false);
});

for (const mode of [null,'sms','Console']) test('disabled or nonexact console flag preserves SMS failures without fallback: '+String(mode),async t => {
  const fixture = consoleDeliveryEnvironment(t,'development',mode);
  const response = await fixture.env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}));
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{success:false,code:'SMS_FAILED'});
  assert.equal(fixture.smsCalls,1);
  assert.equal(fixture.lines.length,0);
  assert.equal(fixture.env.db.state.otpVerification[0].deliveryState,'FAILED');
});

test('console issuance retains resend cooldown and attempt limits',async t => {
  const {env,lines} = consoleDeliveryEnvironment(t);
  const otpModule = env.load('src/lib/auth/otp.ts');
  await otpModule.requestOtp(request({target:phone}));
  await assert.rejects(otpModule.requestOtp(request({target:phone,purpose:'REGISTER'})),error => error.code === 'OTP_RATE_LIMIT');
  assert.equal(lines.length,1);
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(otpModule.verifyOtpRequest(request({target:phone,code:'00000'})),error => error.code === 'OTP_INVALID');
  }
  await assert.rejects(otpModule.verifyOtpRequest(request({target:phone,code:lines[0][2]})),error => error.code === 'OTP_ATTEMPTS_EXCEEDED');
  assert.equal(env.db.state.otpVerification[0].attempts,5);
  assert.equal(env.db.state.session.length,0);
});

for (const protection of ['browser','purpose','expiry']) test('console-issued OTP preserves '+protection+' binding',async t => {
  const {env,lines} = consoleDeliveryEnvironment(t);
  const otpModule = env.load('src/lib/auth/otp.ts');
  await otpModule.requestOtp(request({target:phone}));
  if (protection === 'browser') env.values.set('dream_auth_binding',secret());
  if (protection === 'expiry') env.db.state.otpVerification[0].expiresAt = new Date(0);
  await assert.rejects(otpModule.verifyOtpRequest(request({target:phone,code:lines[0][2],purpose:protection === 'purpose' ? 'REGISTER' : 'LOGIN'})),
    error => error.code === (protection === 'expiry' ? 'OTP_EXPIRED' : 'OTP_INVALID'));
  assert.equal(env.db.state.registrationGrant.length,0);
  assert.equal(env.db.state.session.length,0);
});

for (const mode of [null,'console']) test('missing HMAC configuration reproduces HTTP 500 before '+String(mode)+' delivery',async t => {
  const fixture = consoleDeliveryEnvironment(t,'development',mode);
  const previous = process.env.SECURITY_OTP_KEY;
  delete process.env.SECURITY_OTP_KEY;
  t.after(() => {if (previous === undefined) delete process.env.SECURITY_OTP_KEY; else process.env.SECURITY_OTP_KEY = previous;});
  // Use the actual rate-limit module to reproduce the earliest configuration failure.
  delete fixture.env.overrides['@/lib/security/rate-limit'];
  const diagnostics = [];
  t.mock.method(console,'warn',line => diagnostics.push(JSON.parse(line)));
  const response = await fixture.env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}));
  assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{success:false,code:'UNKNOWN'});
  assert.equal(fixture.smsCalls,0);
  assert.equal(fixture.lines.length,0);
  assert.equal(fixture.env.db.state.otpVerification.length,0);
  assert.deepEqual(diagnostics.find(line => line.event === 'otp_operation_failed'), {
    event:'otp_operation_failed', operation:'rate_limit', category:'security_otp_key_missing_or_short',
  });
});

test('development OTP diagnostics identify Prisma failures without exception data',async t => {
  const {env} = consoleDeliveryEnvironment(t);
  const {Prisma} = await import('@prisma/client');
  env.db.prisma.otpVerification.create = async () => {
    throw new Prisma.PrismaClientKnownRequestError('sensitive query data', {code:'P2022',clientVersion:'5.22.0',meta:{secret:'sensitive metadata'}});
  };
  const diagnostics = [];
  t.mock.method(console,'warn',line => diagnostics.push(JSON.parse(line)));
  assert.equal((await env.load('src/app/api/auth/send-otp/route.ts').POST(request({target:phone}))).status,500);
  assert.deepEqual(diagnostics.find(line => line.event === 'otp_operation_failed'), {
    event:'otp_operation_failed',operation:'challenge_persistence',category:'database_query',code:'P2022',
  });
  assert.ok(!JSON.stringify(diagnostics).includes('sensitive'));
});

test('OTP operation diagnostics remain disabled in production',async t => {
  const {env} = consoleDeliveryEnvironment(t,'production');
  const diagnostics = [];
  t.mock.method(console,'warn',line => diagnostics.push(line));
  await assert.rejects(env.load('src/lib/security/http.ts').otpOperation('rate_limit', () => {throw new Error('private');}));
  assert.equal(diagnostics.length,0);
});

function managementEnvironment() {
  const env = environment();
  const actor = {...user(), bannedAt:null};
  const target = {...user(randomUUID(),otherPhone),contactVerifiedAt:new Date(),bannedAt:null};
  session(env,actor,['app-admin']); env.db.state.user.push(target);
  const body = (action, expectedAdmin = false, expectedBanned = false) => ({action,expectedAdmin,expectedBanned,reason:'Synthetic security review'});
  return {...env,actor,target,body};
}

test('management promotion and demotion apply to an existing session and audit actual values',async () => {
  const env = managementEnvironment();
  env.db.state.personProfile.push({user_id:env.target.id,role:'developer'});
  const service = env.load('src/lib/admin/users.ts');
  await service.manageUser(request(env.body('promote')),env.target.id);
  assert.equal(env.db.state.userManagementAudit.length,1);
  assert.deepEqual(env.db.state.userManagementAudit[0].previousValue.roles,['developer']);
  assert.deepEqual(env.db.state.userManagementAudit[0].newValue.roles,['developer','app-admin']);
  const actorToken = env.values.get('dream_session');
  const targetToken = secret();
  env.db.state.session.push({token:'sha256:'+hash(targetToken),userId:env.target.id,expiresAt:new Date(Date.now()+60000)});
  env.values.set('dream_session',targetToken);
  assert.equal((await env.load('src/lib/auth/authorization.ts').requireAdmin()).id,env.target.id);
  env.values.set('dream_session',actorToken);
  await service.manageUser(request(env.body('demote',true)),env.target.id);
  env.values.set('dream_session',targetToken);
  await assert.rejects(env.load('src/lib/auth/authorization.ts').requireAdmin(),error=>error.status===403);
  assert.equal(env.db.state.userManagementAudit.length,2);
  assert.equal(env.db.state.personProfile.find(profile=>profile.user_id===env.target.id).role,'developer');
  const audit = env.db.state.userManagementAudit[1];
  assert.equal(audit.actorUserId,env.actor.id);assert.equal(audit.targetUserId,env.target.id);
  assert.equal(audit.reason,'Synthetic security review');assert.ok(audit.createdAt instanceof Date);
});

test('ban revokes every target session; unban does not revive a cookie; login is rejected while banned',async () => {
  const env = managementEnvironment();
  const targetToken=secret();const actorToken=env.values.get('dream_session');
  env.db.state.session.push({token:'sha256:'+hash(targetToken),userId:env.target.id,expiresAt:new Date(Date.now()+60000)});
  const service=env.load('src/lib/admin/users.ts');
  await service.manageUser(request(env.body('ban')),env.target.id);
  assert.ok(env.db.state.user.find(row=>row.id===env.target.id).bannedAt);
  assert.ok(!env.db.state.session.some(row=>row.userId===env.target.id));
  await assert.rejects(env.load('src/lib/auth/session.ts').insertSession(env.db.prisma,env.target.id),error=>error.code==='ACCOUNT_BANNED');
  env.values.set('dream_session',targetToken);
  assert.equal(await env.load('src/lib/auth/session.ts').getCurrentUser(),null);
  env.values.set('dream_session',actorToken);
  await service.manageUser(request(env.body('unban',false,true)),env.target.id);
  env.values.set('dream_session',targetToken);
  assert.equal(await env.load('src/lib/auth/session.ts').getCurrentUser(),null);
  assert.equal(env.db.state.userManagementAudit.length,2);
});

test('ban flag rejects a surviving legacy session across customer and admin authorization',async () => {
  const env=environment();const identity={...user(),bannedAt:new Date()};session(env,identity,['app-admin']);
  assert.equal(await env.load('src/lib/auth/session.ts').getCurrentUser(),null);
  await assert.rejects(env.load('src/lib/auth/authorization.ts').requireAuth(),error=>error.status===401);
  await assert.rejects(env.load('src/lib/auth/authorization.ts').requireAdmin(),error=>error.status===401);
});

test('a banned user cannot verify a valid OTP to establish a session',async () => {
  const env=environment();env.db.state.user.push({...user(),bannedAt:new Date()});const {code}=challenge(env);
  await assert.rejects(env.load('src/lib/auth/otp.ts').verifyOtpRequest(request({target:phone,code})),error=>error.code==='ACCOUNT_BANNED');
  assert.equal(env.db.state.session.length,0);
});

for(const action of ['ban','demote'])test('management prevents self-'+action,async()=>{
  const env=managementEnvironment();
  await assert.rejects(env.load('src/lib/admin/users.ts').manageUser(request(env.body(action,true)),env.actor.id),error=>error.code==='USER_SELF_ACTION');
  assert.equal(env.db.state.userManagementAudit.length,0);
});

test('concurrent opposing admin removals retain an active administrator',async()=>{
  const env=managementEnvironment();env.db.state.personProfile.push({user_id:env.target.id,role:'app-admin'});
  // Separate authenticated callers with one transactional database substitute.
  const overrides={...env.overrides,'@/lib/auth/authorization':{ADMIN_ROLE:'app-admin',requireAdmin:async()=>({id:env.target.id,permission:'ADMIN'})}};
  const first=env.load('src/lib/admin/users.ts');const second=load('src/lib/admin/users.ts',overrides);
  const results=await Promise.allSettled([
    first.manageUser(request(env.body('demote',true)),env.target.id),
    second.manageUser(request(env.body('ban',true)),env.actor.id),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'FORBIDDEN');
  assert.equal(env.db.state.userManagementAudit.length,1);
  assert.ok(env.db.calls.some(call=>call[0]==='raw'&&call[1].includes('pg_advisory_xact_lock')));
});

test('last-active-admin guard counts distinct active users and rejects removal',async()=>{
  const env=managementEnvironment();env.db.state.personProfile.push({user_id:env.target.id,role:'app-admin'});
  // Simulate an actor becoming banned after the transaction's actor check.
  const original=env.db.prisma.$queryRaw;
  env.db.prisma.$queryRaw=async sql=>sql.join('').includes('count(*)')?[{total:1n}]:original(sql);
  await assert.rejects(env.load('src/lib/admin/users.ts').manageUser(request(env.body('demote',true)),env.target.id),error=>error.code==='USER_LAST_ADMIN');
  assert.equal(env.db.state.userManagementAudit.length,0);
});

test('audit persistence failure rolls back role change and session revocation',async()=>{
  const env=managementEnvironment();
  env.db.prisma.userManagementAudit.create=async()=>{throw new Error('Synthetic audit failure');};
  await assert.rejects(env.load('src/lib/admin/users.ts').manageUser(request(env.body('promote')),env.target.id));
  assert.ok(!env.db.state.personProfile.some(row=>row.user_id===env.target.id&&row.role==='app-admin'));
  assert.equal(env.db.state.userManagementAudit.length,0);
});

for(const change of [body=>({...body,reason:'  '}),body=>({...body,reason:'x'.repeat(1001)}),body=>({...body,userId:randomUUID()}),body=>({...body,role:'app-admin'}),body=>({...body,expectedAdmin:undefined})])test('management strictly validates input and blocks payload escalation',async()=>{
  const env=managementEnvironment();
  await assert.rejects(env.load('src/lib/admin/users.ts').manageUser(request(change(env.body('promote'))),env.target.id),error=>error.code==='INVALID_INPUT');
  assert.equal(env.db.state.userManagementAudit.length,0);
});

test('management promotion rejects unverified, banned and stale accounts',async()=>{
  for(const variant of ['unverified','banned','stale']){
    const env=managementEnvironment();
    if(variant==='unverified')env.target.contactVerifiedAt=null;
    if(variant==='banned')env.target.bannedAt=new Date();
    const body=env.body('promote',variant==='stale',variant==='banned');
    await assert.rejects(env.load('src/lib/admin/users.ts').manageUser(request(body),env.target.id),error=>error.code===(variant==='stale'?'USER_STATE_CONFLICT':'USER_INELIGIBLE'));
  }
});

test('management mutations use the shared database rate limiter and never mutate when denied',async()=>{
  const env=managementEnvironment();const calls=[];
  const service=load('src/lib/admin/users.ts',{...env.overrides,'@/lib/security/rate-limit':{enforceLimits:async(...args)=>{calls.push(args);throw Object.assign(new Error('Limit'),{code:'MANAGEMENT_RATE_LIMIT'});}}});
  await assert.rejects(service.manageUser(request(env.body('promote')),env.target.id),error=>error.code==='MANAGEMENT_RATE_LIMIT');
  assert.equal(calls[0][0][0].subject,env.actor.id);assert.equal(calls[0][1],'MANAGEMENT_RATE_LIMIT');
  assert.equal(env.db.state.userManagementAudit.length,0);
});

test('every user-management endpoint denies customers and anonymous callers before reading data',async()=>{
  for(const authenticated of [false,true]){
    const env=environment();if(authenticated)session(env,user());
    const service=env.load('src/lib/admin/users.ts');
    for(const operation of [()=>service.listUsers(new Request('http://localhost/api/admin/users')),()=>service.userDetails(randomUUID()),()=>service.manageUser(request({}),randomUUID())]){
      await assert.rejects(operation(),error=>error.status===(authenticated?403:401));
    }
    assert.ok(!env.db.calls.some(call=>call[0]==='userManagementAudit'||call[0]==='order'));
  }
});

test('new management caches participate in logout and role-change cleanup',async()=>{
  const predicates=[];
  const clientState=load('src/lib/auth/client-state.ts',{
    '@/store/orderStore':{useOrderStore:{getState:()=>({resetForm(){}})}},
    '@/store/userStore':{useUserStore:{getState:()=>({setActiveRole(){}})}},
  });
  await clientState.clearSensitiveState({cancelQueries:async({predicate})=>predicates.push(predicate),removeQueries:({predicate})=>predicates.push(predicate)});
  for(const predicate of predicates){
    for(const key of ['admin-users','admin-user'])assert.equal(predicate({queryKey:[key,'en',randomUUID()]}),true);
    assert.equal(predicate({queryKey:['order-form-config','fa']}),false);
  }
});

test('simultaneous promotions produce one change and one audit record',async()=>{
  const env=managementEnvironment();const service=env.load('src/lib/admin/users.ts');
  const results=await Promise.allSettled([service.manageUser(request(env.body('promote')),env.target.id),service.manageUser(request(env.body('promote')),env.target.id)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'USER_STATE_CONFLICT');
  assert.equal(env.db.state.userManagementAudit.length,1);
  assert.equal(env.db.state.personProfile.filter(row=>row.user_id===env.target.id&&row.role==='app-admin').length,1);
});

test('management details return a safe profile and scoped recent order summaries',async()=>{
  const env=managementEnvironment();Object.assign(env.target,{natcode:'private-national-id'});
  env.db.state.order.push({order_id:42,client_id:env.target.id,type:'web',status:'PENDING',cr:'2026-10-23',meta:{private:'hidden'},description:'private description'});
  env.db.state.order.push({order_id:43,client_id:env.actor.id,type:'web',status:'PENDING'});
  const result=await env.load('src/lib/admin/users.ts').userDetails(env.target.id);
  assert.equal(result.orderCount,1);assert.equal(result.orders.length,1);assert.equal(result.orders[0].order_id,42);
  for(const forbidden of ['natcode','token','codeHash','contactVerifiedAt','meta','description'])assert.ok(!JSON.stringify(result).includes(forbidden));
  const orderQuery=env.db.calls.find(call=>call[0]==='order'&&call[1]==='findMany')[2];
  assert.equal(orderQuery.take,10);assert.deepEqual(orderQuery.where,{client_id:env.target.id});
});

test('user list pagination, search and role/status filters use bounded SQL parameters',async()=>{
  const env=managementEnvironment();const queries=[];
  env.db.prisma.$queryRaw=async sql=>{
    queries.push(sql);
    return sql.strings.join('').includes('count(*)')?[{total:11n}]:[{id:env.target.id}];
  };
  const search="%_' OR 1=1 --";
  const result=await env.load('src/lib/admin/users.ts').listUsers(new Request('http://localhost/api/admin/users?'+new URLSearchParams({page:'2',limit:'10',search,role:'customer',status:'active'})));
  assert.equal(result.total,11);assert.equal(result.data[0].id,env.target.id);
  for(const sql of queries){assert.ok(!sql.strings.join('').includes(search));assert.ok(sql.values.includes(search));assert.ok(sql.values.includes('app-admin'));}
  assert.deepEqual(queries[1].values.slice(-2),[10,10]);
});

for(const query of ['page=0','limit=101','role=ADMIN','status=deleted','page=1&page=2','includeSecrets=true'])test('user list rejects invalid query '+query,async()=>{
  const env=managementEnvironment();
  await assert.rejects(env.load('src/lib/admin/users.ts').listUsers(new Request('http://localhost/api/admin/users?'+query)),error=>error.code==='INVALID_INPUT');
});

test('banned sessions cannot list or submit customer orders or reach management endpoints',async()=>{
  const env=environment();session(env,{...user(),bannedAt:new Date()},['app-admin']);
  const list=await env.load('src/app/api/order/load-orders/route.ts').GET(new NextRequest('http://localhost/api/order/load-orders'));
  const submit=await env.load('src/app/api/order/submit-order/route.ts').POST(request({}));
  const management=env.load('src/app/api/admin/users/[userId]/route.ts');
  const context={params:Promise.resolve({userId:randomUUID()})};
  assert.equal(list.status,401);assert.equal(submit.status,401);
  assert.equal((await management.GET(request({}),context)).status,401);
  assert.equal((await management.PATCH(request({}),context)).status,401);
  assert.ok(!env.db.calls.some(call=>call[0]==='order'));
});

test('banned account cannot request OTP delivery',async()=>{
  const env=environment();env.db.state.user.push({...user(),bannedAt:new Date()});let sent=false;
  const otp=load('src/lib/auth/otp.ts',{...env.overrides,'@/lib/auth/sms':{sendOtpSms:async()=>{sent=true;throw new Error('Must not send');}}});
  await assert.rejects(otp.requestOtp(request({target:phone})),error=>error.code==='ACCOUNT_BANNED');
  assert.equal(sent,false);assert.equal(env.db.state.otpVerification.length,0);
});
