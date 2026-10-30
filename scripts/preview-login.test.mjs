import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {load} from './test-loader.mjs';

const password = randomBytes(32).toString('base64url'), salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 32, {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024});
const hash = 'scrypt-v1$' + salt.toString('hex') + '$' + key.toString('hex');
const phone = '09000000000', origin = 'http://localhost:31000';

function fixture(t, {existing = true, banned = false, role = 'customer', onLock} = {}) {
  const variables = {PREVIEW_PASSWORD_LOGIN_ENABLED: 'true', VERCEL_ENV: 'preview', PREVIEW_PASSWORD_LOGIN_HASH: hash,
    PREVIEW_PASSWORD_LOGIN_PHONES: phone + ',09000000001,09000000002',
    PREVIEW_PASSWORD_LOGIN_EXPIRES_AT: new Date(Math.floor((Date.now() + 86400000) / 1000) * 1000).toISOString(),
    SECURITY_ORIGIN: origin, SECURITY_OTP_KEY: randomBytes(32).toString('hex'), SECURITY_TRUSTED_IP_HEADER: 'x-test-ip', NODE_ENV: 'production'};
  const previous = Object.fromEntries(Object.keys(variables).map(name => [name, process.env[name]]));
  Object.assign(process.env, variables);
  t.after(() => {for (const [name, value] of Object.entries(previous)) {if (value === undefined) delete process.env[name];else process.env[name] = value;}});
  const account = existing ? {id: randomUUID(), contact: phone, bannedAt: banned ? new Date() : null, fname: 'Fixture', lname: 'Member', email: null} : null;
  const sessions = [], buckets = new Map(), values = new Map(), options = new Map(), lookups = [];
  let locks = 0;
  const db = {
    user: {findUnique: async args => {lookups.push(args.where);return account && (args.where.id === account.id || args.where.contact === account.contact) ? {...account} : null;}},
    personProfile: {findMany: async () => account ? [{user_id: account.id, role}] : []},
    session: {
      create: async ({data}) => {sessions.push({...data});return data;},
      deleteMany: async ({where}) => {let count = 0;for (let i = sessions.length - 1; i >= 0; i--) if (where.token.in.includes(sessions[i].token)) {sessions.splice(i, 1);count++;}return {count};},
      findFirst: async ({where}) => {const session = sessions.find(row => where.token.in.includes(row.token) && row.expiresAt > where.expiresAt.gt);return session ? {...session, user: {...account}} : null;},
    },
    securityRateLimit: {upsert: async ({where, create}) => {const bucket = buckets.get(where.key) ?? {...create, count: 0};bucket.count++;buckets.set(where.key, bucket);return bucket;}},
    $queryRaw: async () => {locks++;onLock?.(account);return [];},
    $transaction: async run => {const before = sessions.slice();try {return await run(db);}catch (error) {sessions.splice(0, sessions.length, ...before);throw error;}},
  };
  const jar = {get: name => values.has(name) ? {value: values.get(name)} : undefined, set: (name, value, config) => {values.set(name, value);options.set(name, config);}};
  const overrides = {'@/lib/prisma': {prisma: db}, 'next/headers': {cookies: async () => jar}, '@/lib/account/profile': {usernameSupported: async () => false}};
  const route = load('src/app/api/auth/preview-login/route.ts', overrides);
  const session = load('src/lib/auth/session.ts', overrides);
  const send = (body = {phone, password}, headers = {}) => route.POST(new Request(origin + '/api/auth/preview-login', {
    method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', 'x-test-ip': '192.0.2.10', ...headers}, body: JSON.stringify(body),
  }));
  return {send, session, sessions, values, options, account, lookups, buckets, get locks() {return locks;}};
}

test('preview login uses existing identity, ban lock, marked hashed token and secure one-hour cookie', async t => {
  const f = fixture(t);
  const response = await f.send({phone: '+989000000000', password});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {success: true});
  assert.equal(f.locks, 1);
  assert.equal(f.sessions.length, 1);
  assert.equal(f.sessions[0].userId, f.account.id);
  assert.ok(f.sessions[0].token.startsWith('preview-password:'));
  assert.ok(!f.sessions[0].token.includes(f.values.get('dream_session')));
  const cookie = f.options.get('dream_session');
  assert.equal(cookie.httpOnly, true);assert.equal(cookie.secure, true);assert.equal(cookie.sameSite, 'lax');
  assert.ok(cookie.maxAge > 0 && cookie.maxAge <= 3600);
  assert.ok(f.sessions[0].expiresAt <= new Date(Date.now() + 3600000));
  assert.equal((await f.session.getCurrentUser()).id, f.account.id);
  assert.deepEqual((await f.session.getCurrentUser()).roles, ['customer']);
  assert.ok(!f.values.has('dream_registration'));
});

for (const variant of ['wrong-password', 'denied-number', 'missing-account', 'banned', 'ban-after-lookup']) test('generic denial for ' + variant, async t => {
  const f = fixture(t, {existing: variant !== 'missing-account', banned: variant === 'banned', onLock: variant === 'ban-after-lookup' ? account => {account.bannedAt = new Date();} : undefined});
  const response = await f.send({phone: variant === 'denied-number' ? '09000000003' : phone, password: variant === 'wrong-password' ? randomBytes(32).toString('base64url') : password});
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {success: false, code: 'PREVIEW_LOGIN_FAILED'});
  assert.equal(f.sessions.length, 0);assert.equal(f.values.size, 0);
  if (variant === 'wrong-password' || variant === 'denied-number') assert.equal(f.lookups.length, 0);
});

for (const mode of ['absent', 'false', 'production', 'missing-hash', 'malformed-hash', 'bad-allowlist', 'expired', 'too-far-future']) test('preview mode fails closed: ' + mode, async t => {
  const f = fixture(t);
  if (mode === 'absent') delete process.env.PREVIEW_PASSWORD_LOGIN_ENABLED;
  if (mode === 'false') process.env.PREVIEW_PASSWORD_LOGIN_ENABLED = 'false';
  if (mode === 'production') process.env.VERCEL_ENV = 'production';
  if (mode === 'missing-hash') delete process.env.PREVIEW_PASSWORD_LOGIN_HASH;
  if (mode === 'malformed-hash') process.env.PREVIEW_PASSWORD_LOGIN_HASH = 'not-a-verifier';
  if (mode === 'bad-allowlist') process.env.PREVIEW_PASSWORD_LOGIN_PHONES = phone + ',invalid';
  if (mode === 'expired') process.env.PREVIEW_PASSWORD_LOGIN_EXPIRES_AT = '2020-01-01T00:00:00.000Z';
  if (mode === 'too-far-future') process.env.PREVIEW_PASSWORD_LOGIN_EXPIRES_AT = new Date(Math.floor((Date.now() + 8 * 86400000) / 1000) * 1000).toISOString();
  assert.equal((await f.send()).status, 401);
  assert.equal(f.lookups.length, 0);assert.equal(f.buckets.size, 0);assert.equal(f.sessions.length, 0);
});

test('IP budget charges different phone identities before password work', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.send({phone: '0900000000' + i, password: 'incorrect'})).status, 401);
  const response = await f.send();
  assert.equal(response.status, 429);assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.equal((await response.json()).code, 'PREVIEW_LOGIN_FAILED');
});

test('phone budget canonicalizes equivalent formats across different IPs', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.send({phone: i % 2 ? '+989000000000' : '9000000000', password: 'incorrect'}, {'x-test-ip': '192.0.2.' + (20 + i)})).status, 401);
  const response = await f.send({phone, password}, {'x-test-ip': '192.0.2.99'});
  assert.equal(response.status, 429);assert.equal(f.sessions.length, 0);
});

test('CSRF, content type and unknown source remain fail-closed', async t => {
  const f = fixture(t);
  assert.equal((await f.send(undefined, {Origin: 'https://foreign.invalid'})).status, 403);
  assert.equal((await f.send(undefined, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  assert.equal((await f.send(undefined, {'Content-Type': 'text/plain'})).status, 415);
  assert.equal((await f.send(undefined, {'x-test-ip': 'untrusted, chain'})).status, 401);
  assert.equal(f.sessions.length, 0);assert.equal(f.buckets.size, 0);
});

test('no public phone-discovery handler exists', t => {
  fixture(t);
  const route = load('src/app/api/auth/preview-login/route.ts', {'@/lib/auth/preview-login': {previewPasswordLogin: async () => ({success: true})}});
  assert.equal(route.GET, undefined);
});

test('disable and configuration rotation invalidate preview sessions; OTP-format sessions still work', async t => {
  const f = fixture(t);
  assert.equal((await f.send()).status, 200);
  const originalConfig = process.env.PREVIEW_PASSWORD_LOGIN_PHONES;
  process.env.PREVIEW_PASSWORD_LOGIN_PHONES = '09000000001';
  assert.equal(await f.session.getCurrentUser(), null);
  process.env.PREVIEW_PASSWORD_LOGIN_PHONES = originalConfig;
  assert.ok(await f.session.getCurrentUser());
  process.env.PREVIEW_PASSWORD_LOGIN_ENABLED = 'false';
  assert.equal(await f.session.getCurrentUser(), null);
  const normal = randomBytes(32).toString('hex');
  f.sessions.push({userId: f.account.id, token: f.session.storedToken(normal), expiresAt: new Date(Date.now() + 60000)});
  f.values.set('dream_session', normal);
  assert.ok(await f.session.getCurrentUser());
});

test('session rotation, expiry, logout and existing admin roles retain normal contracts', async t => {
  const f = fixture(t, {role: 'app-admin'});
  assert.equal((await f.send()).status, 200);
  assert.equal((await f.send()).status, 200);
  assert.equal(f.sessions.length, 1);
  assert.deepEqual((await f.session.getCurrentUser()).roles, ['app-admin']);
  f.sessions[0].expiresAt = new Date(0);
  assert.equal(await f.session.getCurrentUser(), null);
  f.sessions[0].expiresAt = new Date(Date.now() + 10000);
  await f.session.invalidateSession();
  assert.equal(f.sessions.length, 0);assert.equal(f.values.get('dream_session'), '');
});

test('configuration disabled while password verification is in flight cannot establish a session', async t => {
  const f = fixture(t, {onLock: () => {process.env.PREVIEW_PASSWORD_LOGIN_ENABLED = 'false';}});
  assert.equal((await f.send()).status, 401);
  assert.equal(f.sessions.length, 0);
});
