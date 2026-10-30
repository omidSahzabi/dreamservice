// Anonymous HTTP checks only. Never submit valid OTPs, sessions or order writes.
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const address = reservation.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise(resolve => reservation.close(resolve));
const child = spawn(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)], {
  cwd:root, windowsHide:true, stdio:['ignore','pipe','pipe'],
  env:{...process.env,PUBLIC_TEAM_PROFILE_IDS:'',NODE_OPTIONS:'--require=' + JSON.stringify(path.join(root,'scripts/no-services.cjs'))}
});
let checks = 0;
try {
  await new Promise((resolve,reject) => {
    const deadline = setTimeout(() => reject(new Error('Offline server startup timed out')),30000);
    child.on('error',error => {clearTimeout(deadline); reject(error);});
    child.on('exit',() => {clearTimeout(deadline); reject(new Error('Offline server exited before startup'));});
    child.stdout.on('data',chunk => {if (chunk.toString().includes('Ready in')) {clearTimeout(deadline); resolve();}});
    child.stderr.resume();
  });
  const base = `http://127.0.0.1:${port}`;
  for (const locale of ['en','fa']) for (const route of ['review-orders','order-form']) {
    const response = await fetch(`${base}/${locale}/order/${route}`,{signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    const html = await response.text();
    assert.ok(html.includes(`lang="${locale}"`) && html.includes(`dir="${locale === 'fa' ? 'rtl' : 'ltr'}"`));
    assert.ok(html.includes(locale === 'fa' ? 'برای ادامه وارد شوید.' : 'Sign in to continue.'),
      'Missing anonymous access state: ' + locale + '/' + route + '; headings=' + (html.match(/<h[12][^>]*>[^<]*<\/h[12]>/g) ?? []).join(' '));
    assert.equal((html.match(/<html\b/g) ?? []).length,1); checks++;
  }
  const me = await fetch(base+'/api/auth/me');
  assert.deepEqual(await me.json(),{success:false,user:null});
  assert.ok(me.headers.get('cache-control').includes('no-store')); assert.equal(me.headers.get('x-frame-options'),'DENY'); checks++;
  assert.equal((await fetch(base+'/api/order/load-orders?role=app-admin')).status,401); checks++;
  assert.equal((await fetch(base+'/api/order/submit-order',{method:'POST'})).status,401); checks++;
  const post = (origin,body) => fetch(base+'/api/auth/send-otp',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});
  assert.equal((await post('https://untrusted.invalid','{}')).status,403); checks++;
  assert.equal((await post('http://localhost','{')).status,400); checks++;
  assert.equal((await post('http://localhost','{}')).status,422); checks++;
  assert.equal((await fetch(base+'/api/order/order-form-config?locale=de')).status,400); checks++;
  assert.deepEqual(await (await fetch(base+'/api/team')).json(),[]); checks++;
  console.log(`PASS: ${checks} anonymous HTTP checks; en/fa access states and document directions; no database or SMS calls.`);
} finally {
  child.kill();
}
