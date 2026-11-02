// Local production-build regression. Every API response is fulfilled in Chromium;
// run the application with scripts/no-services.cjs as a second isolation layer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base = process.argv[2] ?? 'http://localhost:3100';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const artifacts = path.resolve('coverage/auth-continuation');
fs.mkdirSync(artifacts, {recursive: true});
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(executable, 'Installed Chromium browser required');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
const user = {id: 'synthetic-browser-user', fname: 'Synthetic', lname: 'User', contact: null, email: null, roles: ['customer'], permission: 'CUSTOMER'};

for (const locale of ['en', 'fa']) {
  for (const scenario of ['authenticated', 'guest', 'cancelled', 'failed', 'unconfirmed', 'refresh-failed', 'late-cancel', 'register']) {
    const profile = fs.mkdtempSync(path.join(artifacts, `${locale}-${scenario}-`));
    const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-extensions', '--user-data-dir=' + profile, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
    let socket;
    try {
      let port;
      for (let attempt = 0; attempt < 150; attempt++) {
        try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (error) { if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error; }
        if (port) break;
        await pause(100);
      }
      assert.ok(port, 'Browser debugging endpoint');
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      let sequence = 0, authenticated = scenario === 'authenticated', verificationCount = 0, registrationCount = 0;
      let heldVerification, heldSession, sessionReleased = false;
      const pending = new Map(), errors = [], unexpectedMutations = [];
      const command = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timeout: ' + method)); }, 30000);
        pending.set(id, {resolve, reject, timer});
        socket.send(JSON.stringify({id, method, params}));
      });
      const fulfill = (requestId, body, responseCode = 200) => command('Fetch.fulfillRequest', {
        requestId, responseCode, responseHeaders: [{name: 'Content-Type', value: 'application/json'}],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      });
      socket.onmessage = async event => {
        const data = JSON.parse(event.data);
        if (data.id) {
          const item = pending.get(data.id);
          if (item) {
            clearTimeout(item.timer); pending.delete(data.id);
            if (data.error) item.reject(new Error(data.error.message)); else item.resolve(data.result);
          }
          return;
        }
        if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
        if (data.method === 'Runtime.consoleAPICalled') {
          const message = data.params.args.map(arg => arg.value ?? '').join(' ');
          if (/MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(message)) errors.push(message);
        }
        if (data.method !== 'Fetch.requestPaused') return;
        const {requestId, request} = data.params, url = new URL(request.url);
        if (url.origin !== new URL(base).origin) {
          await command('Fetch.failRequest', {requestId, errorReason: 'BlockedByClient'}); return;
        }
        if (!url.pathname.startsWith('/api/')) { await command('Fetch.continueRequest', {requestId}); return; }
        if (url.pathname === '/api/auth/me') {
          if (authenticated && scenario !== 'authenticated' && !sessionReleased) heldSession = requestId;
          else await fulfill(requestId, {success: true, user: authenticated ? user : null});
        } else if (request.method === 'POST' && ['/api/auth/send-otp', '/api/auth/otp-status'].includes(url.pathname)) {
          await fulfill(requestId, {success: true, delivery: 'ACCEPTED', expiresAt: new Date(Date.now() + 120000).toISOString(), serverNow: new Date().toISOString(), retryAfter: 60, expiresIn: 120});
        } else if (request.method === 'POST' && url.pathname === '/api/auth/verify') {
          verificationCount++;
          if (scenario === 'late-cancel') { heldVerification = requestId; return; }
          if (scenario === 'failed') { await fulfill(requestId, {success: false, code: 'OTP_INVALID', remainingAttempts: 2}, 400); return; }
          authenticated = scenario !== 'register';
          await fulfill(requestId, {success: true, isNewUser: scenario === 'register'});
        } else if (request.method === 'POST' && url.pathname === '/api/auth/register') {
          registrationCount++; authenticated = true;
          await fulfill(requestId, {success: true});
        } else if (request.method !== 'GET') {
          unexpectedMutations.push(url.pathname);
          await command('Fetch.failRequest', {requestId, errorReason: 'BlockedByClient'});
        } else await fulfill(requestId, url.pathname === '/api/team' ? [] : {success: true, user: null});
      };
      const evaluate = async expression => {
        const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        assert.ok(!result.exceptionDetails, 'Browser evaluation failed');
        return result.result.value;
      };
      const wait = async (predicate, label) => {
        for (let attempt = 0; attempt < 200; attempt++) { if (await predicate()) return; await pause(100); }
        throw new Error(`${locale}/${scenario}: ${label}`);
      };
      const waitFor = (expression, label) => wait(() => evaluate(expression), label);
      const fill = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      const submit = () => evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
      const assertHome = async () => assert.equal(await evaluate('location.pathname'), '/' + locale);
      await command('Page.enable'); await command('Runtime.enable');
      await command('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
      await command('Fetch.enable', {patterns: [{urlPattern: '*', requestStage: 'Request'}]});
      await command('Page.addScriptToEvaluateOnNewDocument', {source: `globalThis.__navigation=[];for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){globalThis.__navigation.push(String(args[2]));return original.apply(this,args);}}`});
      await command('Page.navigate', {url: base + '/' + locale});
      await waitFor('document.readyState==="complete" && !!document.querySelector("#cinematic-end button") && !document.querySelector("#cinematic-end button").disabled', 'hydrated CTA');
      await pause(500);
      assert.equal(await evaluate('document.documentElement.dir'), locale === 'fa' ? 'rtl' : 'ltr');
      await evaluate('document.querySelector("#cinematic-end button").click()');
      if (scenario !== 'authenticated') {
        await waitFor('!!document.getElementById("phone")', 'existing authentication modal');
        await assertHome();
        if (scenario === 'cancelled') {
          await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
          await waitFor('!document.querySelector("[role=dialog]")', 'cancelled modal closes');
        } else {
          await fill('phone', '09000000000'); await submit();
          await waitFor('!!document.getElementById("code") && !document.querySelector("[role=dialog] button[type=submit]").disabled', 'mock verification window');
          await fill('code', '00000'); await submit();
          await wait(() => verificationCount === 1, 'single verification request');
          if (scenario === 'late-cancel') {
            await wait(() => !!heldVerification, 'held verification');
            await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
            await waitFor('!document.querySelector("[role=dialog]")', 'cancel in flight');
            authenticated = true;
            await fulfill(heldVerification, {success: true, isNewUser: false});
          } else if (scenario !== 'failed') {
            if (scenario === 'register') {
              await waitFor('!!document.getElementById("fname")', 'registration step');
              await assertHome();
              await fill('fname', 'Synthetic'); await fill('lname', 'User'); await submit();
              await wait(() => registrationCount === 1, 'mock registration');
            }
            await wait(() => !!heldSession, 'session confirmation requested');
            await pause(300); await assertHome();
            assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), true, 'Modal remains until session confirmation');
            const sessionRequest = heldSession; heldSession = undefined;
            // Subsequent periodic reads must not be held after this confirmation.
            sessionReleased = true;
            authenticated = !['unconfirmed', 'refresh-failed'].includes(scenario);
            await fulfill(sessionRequest,
              scenario === 'refresh-failed' ? {success: false, code: 'UNKNOWN'} : {success: true, user: scenario === 'unconfirmed' ? null : user},
              scenario === 'refresh-failed' ? 503 : 200);
          }
        }
      }
      const continues = ['authenticated', 'guest', 'register'].includes(scenario);
      if (continues) {
        await waitFor(`location.pathname==='/${locale}/order/order-form'`, 'locale-aware order continuation');
        await waitFor('!document.querySelector("[role=dialog]")', 'modal closed');
      }
      await pause(1200);
      if (continues) {
        assert.equal(await evaluate('location.pathname'), `/${locale}/order/order-form`);
        assert.equal(await evaluate(`globalThis.__navigation.filter(url=>url==='/${locale}/order/order-form').length`), 1, 'Exactly one navigation, no loop');
      } else {
        await assertHome();
        assert.equal(await evaluate(`globalThis.__navigation.some(url=>url.includes('/order/order-form'))`), false, 'No premature navigation');
      }
      assert.deepEqual(errors, []); assert.deepEqual(unexpectedMutations, []);
      const shot = await command('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(artifacts, `${locale}-${scenario}.png`), Buffer.from(shot.data, 'base64'));
      const result = {locale, scenario, passed: true, verificationCount, registrationCount};
      results.push(result); console.log(JSON.stringify(result));
    } finally { socket?.close(); browser.kill(); }
  }
}
fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({results, realSms: false, databaseWrites: false, authentication: 'browser API fixtures; server authorization remains enabled'}, null, 2));
