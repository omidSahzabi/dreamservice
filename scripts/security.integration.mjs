// Explicitly opt-in PostgreSQL tests. Never loads .env or sends real SMS.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes, randomInt, randomUUID, createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {NextRequest} from 'next/server.js';
import {load} from './test-loader.mjs';

const configured = process.env.SECURITY_TEST_DATABASE_URL;
if (!configured) throw new Error('Explicit isolated test database configuration is required');
let target;
let database;
try {
  target = new URL(configured);
  database = decodeURIComponent(target.pathname.slice(1));
} catch { throw new Error('Invalid isolated test database configuration'); }
if (!['postgresql:', 'postgres:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname) ||
    !/^dreamservice_(?:baseline|security_test)_\w+$/.test(database) ||
    database !== process.env.SECURITY_TEST_DATABASE_NAME) {
  throw new Error('Refusing a database outside the explicitly acknowledged local test target');
}
process.env.DATABASE_URL = configured;
process.env.SECURITY_SMS_ENABLED = 'false';
process.env.SECURITY_OTP_KEY = randomBytes(32).toString('hex');
process.env.SECURITY_ORIGIN = 'http://localhost';
process.env.SECURITY_TRUSTED_IP_HEADER = 'x-security-test-source';
process.env.NODE_ENV = 'production';
globalThis.fetch = async () => { throw new Error('External HTTP is disabled during integration tests'); };

// Use the application's singleton and a second independent client for races.
const {prisma} = load('src/lib/prisma.ts');
const peer = new PrismaClient();
const context = new AsyncLocalStorage();
const secret = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
const phone = () => '09' + String(randomInt(0, 1000000000)).padStart(9, '0');
const runId = randomUUID();
const marker = 'Security integration fixture';
let browserNumber = 0;

function browser(values = new Map()) {
  const options = new Map();
  return {values, options, source: '192.0.2.' + (++browserNumber % 240 + 1),
    get: name => values.has(name) ? {value: values.get(name)} : undefined,
    set(name, value, config) { values.set(name, value); options.set(name, config); }};
}

function application(client = prisma, {skipIssuanceLimits = false, smsSuccess = true} = {}) {
  const codes = new Map();
  const overrides = {
    '@/lib/prisma': {prisma: client},
    'next/headers': {cookies: async () => {
      const jar = context.getStore();
      if (!jar) throw new Error('A test browser context is required');
      return jar;
    }},
    '@/lib/auth/sms': {sendOtpSms: async ({to, code}) => {
      codes.set(to, code);
      return {success: smsSuccess};
    }},
  };
  // This single scenario isolates advisory locking from the independently tested limiter.
  if (skipIssuanceLimits) overrides['@/lib/security/rate-limit'] = {
    otpLimits: async () => {}, requestSource: () => 'isolated-lock-scenario',
  };
  const modules = new Map();
  return {codes, run: (jar, operation) => context.run(jar, operation), module(file) {
    if (!modules.has(file)) modules.set(file, load(file, overrides));
    return modules.get(file);
  }};
}
const app = application();
const other = application(peer);
function request(jar, body, headers = {}) {
  return new Request('http://localhost/api/security-test', {method: 'POST', headers: {
    Origin: 'http://localhost', 'Content-Type': 'application/json',
    'X-Security-Test-Source': jar.source, ...headers,
  }, body: JSON.stringify(body)});
}
function integration(name, operation) {
  test(name, async () => {
    try { await operation(); }
    catch (error) {
      // Prisma/assertion diagnostics can contain inputs or credentials. Report safe labels only.
      const category = error instanceof assert.AssertionError ? 'assertion' :
        typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'operation';
      throw new Error('Security integration failed: ' + name + ' [' + category + ']');
    }
  });
}
const auth = () => app.module('src/lib/auth/authorization.ts');
const otp = () => app.module('src/lib/auth/otp.ts');
const register = () => app.module('src/app/api/auth/register/route.ts');
const submit = () => app.module('src/app/api/order/submit-order/route.ts');
const registration = contact => ({contact, fname: 'SecurityFixture', lname: runId});
const order = () => ({formKey: 'order', data: {
  service_type: 'web', budget_range: 'small', page_count: 3, project_description: 'Synthetic fixture',
}});
const orderRequest = (jar, body = order(), key = randomUUID(), headers = {}) =>
  request(jar, body, {'Idempotency-Key': key, ...headers});
async function customer() {
  return prisma.user.create({data: {contact: phone(), fname: 'SecurityFixture', lname: runId}});
}
async function session(identity, jar = browser(), roles = []) {
  for (const role of roles) await prisma.personProfile.create({data: {user_id: identity.id, role}});
  await app.run(jar, () => app.module('src/lib/auth/session.ts').createSession(identity.id));
  return jar;
}
async function challenge(jar, contact, purpose = 'LOGIN', changes = {}) {
  const binding = secret();
  const id = randomUUID();
  const code = String(randomInt(10000, 100000));
  const {protectedHash} = app.module('src/lib/security/crypto.ts');
  jar.values.set('dream_auth_binding', binding);
  jar.values.set('dream_otp_challenge', id);
  await prisma.otpVerification.create({data: {id, target: contact, channel: 'PHONE', purpose,
    codeHash: protectedHash('otp-v1', JSON.stringify([id, contact, purpose, code])),
    browserBindingHash: digest(binding), deliveryState: 'SENT',
    expiresAt: new Date(Date.now() + 120000), ...changes}});
  return {id, code};
}
async function grant(jar = browser(), contact = phone(), changes = {}) {
  const proof = secret();
  const binding = secret();
  jar.values.set('dream_registration', proof);
  jar.values.set('dream_auth_binding', binding);
  const row = await prisma.registrationGrant.create({data: {tokenHash: digest(proof), phone: contact,
    browserBindingHash: digest(binding), purpose: 'REGISTER',
    expiresAt: new Date(Date.now() + 600000), ...changes}});
  return {jar, contact, row};
}
const translations = key => ({create: [{locale: 'en', [key]: marker}, {locale: 'fa', [key]: 'آزمایش امنیت'}]});

before(async () => {
  try {
    const actual = await prisma.$queryRaw`SELECT current_database() AS name`;
    assert.ok(actual[0].name === database);
    assert.ok(await prisma.user.count({where: {NOT: {fname: 'SecurityFixture'}}}) === 0);
    const existing = await prisma.orderForm.findUnique({where: {form_key: 'order'}, include: {translations: true}});
    if (existing) {
      assert.ok(existing.translations.some(item => item.locale === 'en' && item.title === marker));
      return;
    }
    const fields = [
      {field_key: 'service_type', field_type: 'select', options: ['web']},
      {field_key: 'budget_range', field_type: 'radio', options: ['small']},
      {field_key: 'page_count', field_type: 'number', validation: {min: 1, max: 20}},
      {field_key: 'project_description', field_type: 'textarea', validation: {minLength: 3, maxLength: 100}},
      {field_key: 'details', field_type: 'text', visibility: {operator: 'AND', conditions: [
        {field: 'page_count', operator: 'equals', value: 20},
      ]}},
    ];
    await prisma.orderForm.create({data: {form_key: 'order', translations: translations('title'),
      steps: {create: {step_key: 'details', step_order: 0, translations: translations('title'),
        fields: {create: fields.map((field, index) => ({field_key: field.field_key,
          field_type: field.field_type, field_order: index, required: true,
          validation: field.validation ?? {}, visibility: field.visibility ?? {},
          translations: translations('label'), options: {create: (field.options ?? []).map((value, position) => ({
            option_value: value, option_order: position, translations: translations('label'),
          }))},
        }))},
      }},
    }});
  } catch { throw new Error('Isolated synthetic fixture initialization failed'); }
});
after(async () => { await Promise.all([prisma.$disconnect(), peer.$disconnect()]); });

integration('PostgreSQL advisory locks serialize OTP issuance across purposes and clients', async () => {
  const first = application(prisma, {skipIssuanceLimits: true});
  const second = application(peer, {skipIssuanceLimits: true});
  const contact = phone();
  const results = await Promise.allSettled([first, second].map((instance, index) => {
    const jar = browser();
    return instance.run(jar, () => instance.module('src/lib/auth/otp.ts').requestOtp(
      request(jar, {target: contact, purpose: index ? 'REGISTER' : 'LOGIN'})));
  }));
  assert.ok(results.filter(result => result.status === 'fulfilled').length === 1);
  assert.ok(results.filter(result => result.status === 'rejected' && result.reason.code === 'OTP_RATE_LIMIT').length === 1);
  assert.ok(await prisma.otpVerification.count({where: {target: contact}}) === 1);
});

for (const administrator of [false, true]) integration(
  administrator ? 'exact app-admin uses the same phone OTP login' : 'customer phone OTP persists a protected session', async () => {
    const identity = await customer();
    if (administrator) await prisma.personProfile.create({data: {user_id: identity.id, role: 'app-admin'}});
    const jar = browser();
    await app.run(jar, () => otp().requestOtp(request(jar, {target: identity.contact})));
    const issued = await prisma.otpVerification.findUnique({where: {id: jar.values.get('dream_otp_challenge')}});
    assert.ok(issued.deliveryState === 'SENT' && Boolean(issued.browserBindingHash));
    assert.ok(issued.codeHash !== app.codes.get(identity.contact));
    await app.run(jar, () => otp().verifyOtpRequest(request(jar, {target: identity.contact, code: app.codes.get(identity.contact)})));
    const principal = await app.run(jar, () => auth().requireAuth());
    assert.ok(principal.id === identity.id && principal.permission === (administrator ? 'ADMIN' : 'CUSTOMER'));
    const stored = await prisma.session.findFirst({where: {userId: identity.id}});
    assert.ok(stored.token.startsWith('sha256:') && stored.token !== jar.values.get('dream_session'));
    const flags = jar.options.get('dream_session');
    assert.ok(flags.httpOnly && flags.secure && flags.sameSite === 'lax' && flags.path === '/');
  });

integration('failed mocked delivery leaves an unusable database challenge', async () => {
  const failing = application(prisma, {smsSuccess: false});
  const jar = browser();
  const contact = phone();
  await assert.rejects(failing.run(jar, () => failing.module('src/lib/auth/otp.ts').requestOtp(
    request(jar, {target: contact}))), error => error.code === 'SMS_FAILED');
  const row = await prisma.otpVerification.findFirst({where: {target: contact}});
  assert.ok(row.deliveryState === 'FAILED' && !jar.values.get('dream_otp_challenge'));
});

integration('parallel invalid OTP attempts stop at five committed reservations', async () => {
  const jar = browser();
  const contact = phone();
  const issued = await challenge(jar, contact);
  const results = await Promise.allSettled(Array.from({length: 12}, (_, index) => {
    const instance = index % 2 ? other : app;
    return instance.run(jar, () => instance.module('src/lib/auth/otp.ts').verifyOtpRequest(
      request(jar, {target: contact, code: '00000'})));
  }));
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.ok((await prisma.otpVerification.findUnique({where: {id: issued.id}})).attempts === 5);
});

integration('parallel valid OTP verification commits exactly one session', async () => {
  const identity = await customer();
  const jar = browser();
  const issued = await challenge(jar, identity.contact);
  const results = await Promise.allSettled(Array.from({length: 8}, (_, index) => {
    const instance = index % 2 ? other : app;
    const concurrent = browser(new Map(jar.values));
    return instance.run(concurrent, () => instance.module('src/lib/auth/otp.ts').verifyOtpRequest(
      request(concurrent, {target: identity.contact, code: issued.code})));
  }));
  assert.ok(results.filter(result => result.status === 'fulfilled').length === 1);
  assert.ok(await prisma.session.count({where: {userId: identity.id}}) === 1);
});

for (const [name, changes] of [
  ['expired', {expiresAt: new Date(0)}], ['consumed', {consumedAt: new Date()}],
  ['unbound', {browserBindingHash: null}], ['pending delivery', {deliveryState: 'PENDING'}],
  ['failed delivery', {deliveryState: 'FAILED'}],
]) integration('database OTP rejects ' + name, async () => {
  const jar = browser();
  const contact = phone();
  const issued = await challenge(jar, contact, 'LOGIN', changes);
  await assert.rejects(app.run(jar, () => otp().verifyOtpRequest(request(jar, {target: contact, code: issued.code}))),
    error => error.code.startsWith('OTP_'));
  assert.ok(await prisma.registrationGrant.count({where: {phone: contact}}) === 0);
});

integration('OTP browser and purpose binding reject substituted proofs', async () => {
  const jar = browser();
  const contact = phone();
  const issued = await challenge(jar, contact);
  await assert.rejects(app.run(jar, () => otp().verifyOtpRequest(request(jar, {
    target: contact, code: issued.code, purpose: 'REGISTER',
  }))), error => error.code === 'OTP_INVALID');
  jar.values.set('dream_auth_binding', secret());
  await assert.rejects(app.run(jar, () => otp().verifyOtpRequest(request(jar, {target: contact, code: issued.code}))),
    error => error.code === 'OTP_INVALID');
  assert.ok((await prisma.otpVerification.findUnique({where: {id: issued.id}})).attempts === 0);
});

integration('verified registration grant creates one account and session under concurrency', async () => {
  const jar = browser();
  const contact = phone();
  const issued = await challenge(jar, contact);
  await app.run(jar, () => otp().verifyOtpRequest(request(jar, {target: contact, code: issued.code})));
  const responses = await Promise.all([app, other].map(instance => {
    const concurrent = browser(new Map(jar.values));
    return instance.run(concurrent, () => instance.module('src/app/api/auth/register/route.ts').POST(
      request(concurrent, registration(contact))));
  }));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 403]);
  const identity = await prisma.user.findUnique({where: {contact}});
  assert.ok(await prisma.session.count({where: {userId: identity.id}}) === 1);
  assert.ok((await app.run(jar, () => register().POST(request(jar, registration(contact))))).status === 403);
});

for (const kind of ['browser', 'phone', 'purpose', 'expiry', 'replay']) integration(
  'registration grant rejects ' + kind + ' substitution or reuse', async () => {
    const fixture = await grant(browser(), phone(), kind === 'purpose' ? {purpose: 'LOGIN'} :
      kind === 'expiry' ? {expiresAt: new Date(0)} : kind === 'replay' ? {consumedAt: new Date()} : {});
    if (kind === 'browser') fixture.jar.values.set('dream_auth_binding', secret());
    const contact = kind === 'phone' ? phone() : fixture.contact;
    assert.ok((await app.run(fixture.jar, () => register().POST(request(fixture.jar, registration(contact))))).status === 403);
    assert.ok(await prisma.user.findUnique({where: {contact}}) === null);
  });

integration('failed session insertion rolls back real grant consumption and account creation', async () => {
  const fixture = await grant();
  const failing = application(prisma.$extends({query: {session: {create() { throw new Error('Injected session failure'); }}}}));
  const response = await failing.run(fixture.jar, () => failing.module('src/app/api/auth/register/route.ts').POST(
    request(fixture.jar, registration(fixture.contact))));
  assert.ok(response.status === 500);
  assert.ok(await prisma.user.findUnique({where: {contact: fixture.contact}}) === null);
  assert.ok((await prisma.registrationGrant.findUnique({where: {tokenHash: fixture.row.tokenHash}})).consumedAt === null);
});

integration('public registration cannot assign administrator roles', async () => {
  const fixture = await grant();
  const response = await app.run(fixture.jar, () => register().POST(request(fixture.jar, {
    ...registration(fixture.contact), role: 'app-admin',
  })));
  assert.ok(response.status === 422);
  assert.ok(await prisma.user.findUnique({where: {contact: fixture.contact}}) === null);
});

integration('only exact own app-admin profiles grant privileges and revocation is immediate', async () => {
  for (const role of ['ADMIN', 'admin', 'App-Admin', 'app-admin ', null]) {
    const identity = await customer();
    const jar = await session(identity, browser(), [role]);
    assert.ok((await app.run(jar, () => auth().requireAuth())).permission === 'CUSTOMER');
    await assert.rejects(app.run(jar, () => auth().requireAdmin()), error => error.status === 403);
  }
  const ordinary = await customer();
  const jar = await session(ordinary);
  const administrator = await customer();
  await prisma.personProfile.create({data: {user_id: administrator.id, role: 'app-admin'}});
  await assert.rejects(app.run(jar, () => auth().requireAdmin()), error => error.status === 403);
  const profile = await prisma.personProfile.create({data: {user_id: ordinary.id, role: 'app-admin'}});
  assert.ok((await app.run(jar, () => auth().requireAdmin())).id === ordinary.id);
  await prisma.personProfile.update({where: {pr_id: profile.pr_id}, data: {role: 'customer'}});
  await assert.rejects(app.run(jar, () => auth().requireAdmin()), error => error.status === 403);
});

integration('session expiry, rotation, and logout prevent replay', async () => {
  const identity = await customer();
  const jar = await session(identity);
  const previous = jar.values.get('dream_session');
  await app.run(jar, () => app.module('src/lib/auth/session.ts').createSession(identity.id));
  assert.ok(await prisma.session.count({where: {token: 'sha256:' + digest(previous)}}) === 0);
  const current = jar.values.get('dream_session');
  const replay = browser(new Map([['dream_session', current]]));
  const response = await app.run(jar, () => app.module('src/app/api/auth/logout/route.ts').POST(request(jar, {})));
  assert.ok(response.status === 200 && jar.options.get('dream_session').maxAge === 0);
  assert.ok(await app.run(replay, () => app.module('src/lib/auth/session.ts').getCurrentUser()) === null);
  const expired = secret();
  await prisma.session.create({data: {userId: identity.id, token: 'sha256:' + digest(expired), expiresAt: new Date(0)}});
  replay.values.set('dream_session', expired);
  assert.ok(await app.run(replay, () => app.module('src/lib/auth/session.ts').getCurrentUser()) === null);
});

integration('shared PostgreSQL rate buckets enforce an atomic budget across clients', async () => {
  const limits = [{scope: 'integration-' + runId, subject: randomUUID(), seconds: 86400, maximum: 3}];
  const results = await Promise.allSettled(Array.from({length: 12}, (_, index) =>
    (index % 2 ? other : app).module('src/lib/security/rate-limit.ts').enforceLimits(limits)));
  assert.ok(results.filter(result => result.status === 'fulfilled').length === 3);
  assert.ok(results.filter(result => result.status === 'rejected' && result.reason.status === 429).length === 9);
});

integration('database-driven form translations preserve machine values in both locales', async () => {
  const route = app.module('src/app/api/order/order-form-config/route.ts');
  const values = [];
  for (const locale of ['en', 'fa']) {
    const response = await route.GET(new Request('http://localhost/api/order/order-form-config?locale=' + locale));
    assert.ok(response.status === 200);
    const config = await response.json();
    values.push(config.form.steps.flatMap(step => step.fields.map(field => ({
      id: field.id, validation: field.validation, visibility: field.visibility,
      options: field.options.map(option => option.value),
    }))));
    assert.ok(config.form.title === (locale === 'en' ? marker : 'آزمایش امنیت'));
  }
  assert.deepEqual(values[0], values[1]);
});

for (const [name, change] of [
  ['unknown field', body => { body.data.unpublished = 'x'; }],
  ['client-selected owner', body => { body.data.client_id = randomUUID(); }],
  ['unpublished option', body => { body.data.service_type = 'forged'; }],
  ['noninteger page count', body => { body.data.page_count = 1.5; }],
  ['published numeric rule', body => { body.data.page_count = 21; }],
  ['visible required field', body => { body.data.page_count = 20; }],
]) integration('server database-driven order validation rejects ' + name, async () => {
  const identity = await customer();
  const jar = await session(identity);
  const body = order(); change(body);
  assert.ok((await app.run(jar, () => submit().POST(orderRequest(jar, body)))).status === 422);
  assert.ok(await prisma.order.count({where: {client_id: identity.id}}) === 0);
});

integration('durable customer-scoped order idempotency resolves PostgreSQL unique races', async () => {
  const identity = await customer();
  const jar = await session(identity);
  const key = randomUUID();
  const responses = await Promise.all(Array.from({length: 8}, (_, index) => {
    const instance = index % 2 ? other : app;
    return instance.run(jar, () => instance.module('src/app/api/order/submit-order/route.ts').POST(orderRequest(jar, order(), key)));
  }));
  assert.ok(responses.filter(response => response.status === 201).length === 1);
  assert.ok(responses.every(response => [200, 201].includes(response.status)));
  const bodies = await Promise.all(responses.map(response => response.json()));
  assert.ok(new Set(bodies.map(body => body.order_id)).size === 1);
  const restarted = application(peer);
  assert.ok((await restarted.run(jar, () => restarted.module('src/app/api/order/submit-order/route.ts').POST(orderRequest(jar, order(), key)))).status === 200);
  const changed = order(); changed.data.page_count = 4;
  assert.ok((await app.run(jar, () => submit().POST(orderRequest(jar, changed, key)))).status === 409);
  assert.ok(await prisma.order.count({where: {client_id: identity.id, idempotency_key: key}}) === 1);
  const second = await customer();
  const secondJar = await session(second);
  assert.ok((await app.run(secondJar, () => submit().POST(orderRequest(secondJar, order(), key)))).status === 201);
  const stored = await prisma.order.findUnique({where: {client_id_idempotency_key: {client_id: identity.id, idempotency_key: key}}});
  assert.ok(stored.status === 'PENDING' && stored.client_id === identity.id);
});

integration('order APIs enforce customer ownership and exact administrator access', async () => {
  const first = await customer();
  const second = await customer();
  const firstOrder = await prisma.order.create({data: {client_id: first.id, meta: {private: true}}});
  const secondOrder = await prisma.order.create({data: {client_id: second.id, meta: {private: true}}});
  const jar = await session(first);
  const route = app.module('src/app/api/order/load-orders/route.ts');
  const listing = query => new NextRequest('http://localhost/api/order/load-orders' + query);
  assert.ok((await app.run(browser(), () => route.GET(listing('')))).status === 401);
  assert.ok((await app.run(browser(), () => submit().POST(orderRequest(browser())))).status === 401);
  const response = await app.run(jar, () => route.GET(listing('')));
  const body = await response.json();
  assert.ok(body.data.length === 1 && body.data[0].order_id === firstOrder.order_id && body.data[0].meta === null);
  assert.ok(!('request_hash' in body.data[0]) && !('idempotency_key' in body.data[0]));
  assert.ok(response.headers.get('cache-control').includes('no-store') && response.headers.get('vary') === 'Cookie');
  assert.ok((await app.run(jar, () => route.GET(listing('?client_id=' + second.id)))).status === 403);
  assert.ok((await app.run(jar, () => route.GET(listing('?includeClient=true')))).status === 403);
  const administrator = await session(await customer(), browser(), ['app-admin']);
  const privileged = await app.run(administrator, () => route.GET(listing('?client_id=' + second.id + '&includeClient=true')));
  const privilegedBody = await privileged.json();
  assert.ok(privileged.status === 200 && privilegedBody.data[0].order_id === secondOrder.order_id);
  assert.ok(privilegedBody.data[0].client.id === second.id);
});

integration('CSRF and display-role tampering cannot change PostgreSQL authorization or orders', async () => {
  const identity = await customer();
  const jar = await session(identity);
  const csrf = await app.run(jar, () => submit().POST(orderRequest(jar, order(), randomUUID(), {Origin: 'https://untrusted.invalid'})));
  assert.ok(csrf.status === 403 && await prisma.order.count({where: {client_id: identity.id}}) === 0);
  const role = await app.run(jar, () => app.module('src/app/api/auth/switch-role/route.ts').POST(request(jar, {role: 'app-admin'})));
  assert.ok(role.status === 403 && await prisma.personProfile.count({where: {user_id: identity.id}}) === 0);
});
