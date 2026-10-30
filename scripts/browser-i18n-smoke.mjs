import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createTranslator} from 'use-intl/core';

// Local headless Chrome/Edge + native CDP. All application API requests are mocked.
// Run with a local development server: node scripts/browser-i18n-smoke.mjs
const base = process.argv[2] ?? 'http://127.0.0.1:3100';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local server only');
const executable = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(file => fs.existsSync(file));
assert.ok(executable, 'No installed Chrome/Edge found');
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamservice-i18n-'));
const browser = spawn(executable, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-sync', '--disable-extensions',
  '--user-data-dir=' + artifactDir, 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const exceptions = [];
const localizationErrors = [];
let submitted;
let otpMode = 'invalid';
let sendMode = 'success';
let formUnavailable = false;
const catalogs = Object.fromEntries(['en', 'fa'].map(locale => [locale, JSON.parse(fs.readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'))]));
const translator = (locale, namespace) => createTranslator({locale, messages: catalogs[locale], namespace, onError: error => {throw error;}});

function formFixture(locale) {
  const fa = locale === 'fa';
  const field = (id, type, en, persian, extra = {}) => ({id, type, label: fa ? persian : en, required: true, validation: {}, visibility: {}, ...extra});
  return {form: {id: '1', key: 'order', title: fa ? 'فرم آزمایشی سفارش' : 'Order fixture', description: '',
    settings: {showProgress: true, allowBack: true, submitButtonText: ''}, steps: [
      {id: '1', order: 1, title: fa ? 'اطلاعات تماس' : 'Contact details', fields: [
        field('full_name', 'text', 'Full name', 'نام کامل', {validation: {minLength: 2}}),
        field('email', 'email', 'Email', 'ایمیل'), field('phone', 'tel', 'Phone', 'شماره همراه'),
        field('service_type', 'select', 'Service', 'خدمت', {defaultValue: 'web_store', options: [{value: 'web_store', label: fa ? 'فروشگاه' : 'Store'}]})
      ]},
      {id: '2', order: 2, title: fa ? 'جزئیات پروژه' : 'Project details', fields: [
        field('page_count', 'number', 'Pages', 'تعداد صفحات', {validation: {min: 1, max: 20}}),
        field('budget_range', 'radio', 'Budget', 'بودجه', {options: [{value: 'low', label: fa ? 'بودجه آزمایشی' : 'Fixture budget'}]}),
        field('website_type', 'checkbox', 'Features', 'امکانات', {options: [{value: 'responsive', label: fa ? 'واکنش‌گرا' : 'Responsive'}]}),
        field('project_description', 'textarea', 'Description', 'توضیحات')
      ]}
    ]}};
}

try {
  let port;
  for (let i = 0; i < 100; i++) {
    const file = path.join(artifactDir, 'DevToolsActivePort');
    if (fs.existsSync(file)) {port = fs.readFileSync(file, 'utf8').split('\n')[0]; break;}
    await sleep(100);
  }
  assert.ok(port, 'Browser did not start');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  let sequence = 0;
  const pending = new Map();
  function command(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {pending.delete(id); reject(new Error('CDP timeout: ' + method));}, 20000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  socket.onmessage = async event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const item = pending.get(data.id);
      if (item) {
        clearTimeout(item.timer); pending.delete(data.id);
        if (data.error) item.reject(new Error(data.error.message));
        else item.resolve(data.result);
      }
    } else if (data.method === 'Runtime.exceptionThrown') {
      exceptions.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
    } else if (data.method === 'Runtime.consoleAPICalled') {
      const message = data.params.args.map(argument => argument.value ?? argument.description ?? '').join(' ');
      if (/MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR|hydration failed|hydration mismatch|didn't match/i.test(message)) localizationErrors.push(message);
    } else if (data.method === 'Fetch.requestPaused') {
      const request = data.params.request;
      const url = new URL(request.url);
      let body;
      let status = 200;
      if (url.pathname === '/api/auth/me') body = {success: false, user: null};
      else if (url.pathname === '/api/team') body = [{pr_id: 1, user: {fname: 'Fixture', lname: 'Member'}}];
      else if (url.pathname === '/api/order/order-form-config') {
        if (formUnavailable) {status = 503; body = {code: 'FORM_TRANSLATION_MISSING', error: 'DO_NOT_DISPLAY'};}
        else body = formFixture(url.searchParams.get('locale') ?? 'en');
      } else if (url.pathname === '/api/auth/send-otp') {
        if (sendMode === 'network') {
          await command('Fetch.failRequest', {requestId: data.params.requestId, errorReason: 'Failed'});
          return;
        }
        if (sendMode === 'rate-limit') {status = 429; body = {success: false, code: 'OTP_RATE_LIMIT', retryAfter: 9, error: 'DO_NOT_DISPLAY'};}
        else body = {success: true, retryAfter: 60, expiresIn: 120};
      }
      else if (url.pathname === '/api/auth/verify') {
        if (otpMode === 'register') body = {success: true, isNewUser: true};
        else {status = 400; body = {success: false, code: otpMode === 'expired' ? 'OTP_EXPIRED' : 'OTP_INVALID', remainingAttempts: 2, error: 'DO_NOT_DISPLAY'};}
      } else if (url.pathname === '/api/auth/register') {
        body = {success: true};
      } else if (url.pathname === '/api/order/submit-order') {
        submitted = JSON.parse(request.postData);
        body = {success: true, order_id: 101};
      } else if (url.pathname === '/api/order/load-orders') {
        body = {success: true, data: [{order_id: 101, client_id: 'fixture', type: 'web_store', budget_range: 'low', page_count: 3, description: 'Fixture description', status: 'PENDING', cr: null, meta: {full_name: 'Fixture Customer', phone: '09123456789', email: 'fixture@example.test'}}], pagination: {page: Number(url.searchParams.get('page') ?? 1), limit: 10, total: 15, totalPages: 2, hasNextPage: true, hasPrevPage: false}};
      } else {status = 503; body = {code: 'UNKNOWN'};}
      await command('Fetch.fulfillRequest', {requestId: data.params.requestId, responseCode: status, responseHeaders: [{name: 'Content-Type', value: 'application/json'}], body: Buffer.from(JSON.stringify(body)).toString('base64')});
    }
  };
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Fetch.enable', {patterns: [{urlPattern: '*/api/*', requestStage: 'Request'}]});
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed');
    return result.result.value;
  }
  async function wait(expression, label) {
    for (let i = 0; i < 150; i++) {if (await evaluate('Boolean(' + expression + ')')) return; await sleep(100);}
    throw new Error('Timeout: ' + label);
  }
  async function navigate(route) {
    await command('Page.navigate', {url: base + route});
    await wait('document.readyState === "complete"', route);
    await sleep(350);
  }
  async function clickText(text) {
    await wait('[...document.querySelectorAll("button")].some(b => !b.disabled && b.textContent.trim() === ' + JSON.stringify(text) + ')', 'enabled button ' + text);
    const success = await evaluate('(() => {const b = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === ' + JSON.stringify(text) + '); if (!b) return false; b.click(); return true;})()');
    assert.ok(success, 'Button missing: ' + text);
  }
  async function input(id, value) {
    await evaluate('(() => {const e=document.getElementById(' + JSON.stringify(id) + '); const p=e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + JSON.stringify(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  }
  for (const locale of ['en', 'fa']) {
    for (const width of [1280, 390]) {
      await command('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width < 600});
      await navigate('/' + locale);
      await wait('document.querySelector("button[lang]")', 'locale control');
      assert.equal(await evaluate('document.documentElement.lang'), locale);
      assert.equal(await evaluate('document.documentElement.dir'), locale === 'fa' ? 'rtl' : 'ltr');
      const overflow = await evaluate('document.documentElement.scrollWidth > innerWidth + 2');
      if (overflow) console.log('Overflow evidence:', await evaluate('[...document.querySelectorAll("body *")].map(e => ({tag:e.tagName,class:e.className?.baseVal ?? e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(r=>r.width>0&&(r.left < -2 || r.right > innerWidth+2)).slice(0,20)'));
      await command('Page.captureScreenshot', {format: 'png'}).then(result => fs.writeFileSync(path.join(artifactDir, locale + '-' + width + '.png'), Buffer.from(result.data, 'base64')));
      assert.equal(overflow, false, locale + ' homepage overflows at ' + width);
      const clipped = await evaluate('(() => {const elements=[document.querySelector("h1"),document.querySelector("a[href^=tel]")];return elements.some(e => {const r=e.getBoundingClientRect();return r.left < -2 || r.right > innerWidth + 2;});})()');
      assert.equal(clipped, false, locale + ' hero/contact clipped at ' + width);
      const badLinks = await evaluate('[...document.querySelectorAll("a[href]")].filter(a => a.origin === location.origin && !a.pathname.startsWith("/' + locale + '") && !a.pathname.startsWith("/api")).map(a => a.getAttribute("href"))');
      assert.deepEqual(badLinks, [], 'Links lost locale');
      if (width < 600) {
        await evaluate('document.querySelector(' + JSON.stringify('button[aria-label="' + catalogs[locale].Navbar.openMenu + '"]') + ').click()');
        await wait('document.querySelector("[role=dialog]")', 'mobile sheet');
        assert.equal(await evaluate('getComputedStyle(document.querySelector("[role=dialog]")).direction'), locale === 'fa' ? 'rtl' : 'ltr');
        await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b => b.textContent.trim() === ' + JSON.stringify(catalogs[locale].Common.close) + ').click()');
      }
    }
    await navigate('/' + locale + '/about?source=smoke#top');
    await wait('document.body.textContent.includes("Fixture Member")', 'team fixture');
    await evaluate('document.querySelector("button[lang]").click()');
    const other = locale === 'en' ? 'fa' : 'en';
    await wait('location.pathname === "/' + other + '/about"', 'equivalent page switch');
    assert.equal(await evaluate('location.search + location.hash'), '?source=smoke#top');
    await command('Page.reload');
    await wait('document.readyState === "complete" && document.documentElement.lang === "' + other + '"', 'locale after refresh');
    await navigate('/' + locale + '/order');
    await navigate('/' + locale + '/about');
    await evaluate('history.back()');
    await wait('location.pathname === "/' + locale + '/order"', 'browser back');
    await evaluate('history.forward()');
    await wait('location.pathname === "/' + locale + '/about"', 'browser forward');
    await navigate('/' + locale);
    const auth = translator(locale, 'AuthModal');
    await wait('[...document.querySelectorAll("button")].some(b => b.textContent.trim() === ' + JSON.stringify(catalogs[locale].Navbar.login) + ')', 'login');
    await clickText(catalogs[locale].Navbar.login);
    await wait('document.getElementById("phone")', 'auth phone field');
    await input('phone', locale === 'fa' ? '۰۹۱۲۳۴۵۶۷۸۹' : '09123456789');
    await clickText(auth('button.sendOtp'));
    await wait('document.getElementById("code")', 'OTP field');
    await input('code', locale === 'fa' ? '۱۲۳۴۵' : '12345');
    for (const mode of ['invalid', 'expired']) {
      otpMode = mode;
      await clickText(auth('button.verify'));
      const expected = translator(locale, 'Errors')(mode === 'expired' ? 'OTP_EXPIRED' : 'OTP_INVALID', {attempts: 2});
      await wait('document.body.textContent.includes(' + JSON.stringify(expected) + ')', 'localized OTP ' + mode);
    }
    assert.equal(await evaluate('document.body.textContent.includes("DO_NOT_DISPLAY")'), false);
    await clickText(auth('action.changePhone'));
    for (const mode of ['rate-limit', 'network']) {
      sendMode = mode;
      await clickText(auth('button.sendOtp'));
      const expected = translator(locale, 'Errors')(mode === 'network' ? 'NETWORK_ERROR' : 'OTP_RATE_LIMIT', {seconds: 9});
      await wait('document.body.textContent.includes(' + JSON.stringify(expected) + ')', 'localized ' + mode);
    }
    sendMode = 'success';
    otpMode = 'register';
    await clickText(auth('button.sendOtp'));
    await wait('document.getElementById("code")', 'registration OTP');
    await clickText(auth('button.verify'));
    await wait('document.getElementById("fname")', 'registration fields');
    await input('fname', 'Fixture');
    await input('lname', 'Person');
    await input('email', 'fixture@example.test');
    await clickText(auth('button.register'));
    await wait('document.body.textContent.includes(' + JSON.stringify(auth('toast.registerSuccess')) + ')', 'registration success');
    await navigate('/' + locale + '/order/order-form');
    const form = translator(locale, 'OrderForm');
    await wait('document.getElementById("full_name")', 'dynamic form');
    await clickText(form('next'));
    await wait('document.body.textContent.includes(' + JSON.stringify(form('validation.required')) + ')', 'localized required validation');
    await input('full_name', 'Fixture Customer');
    await input('email', 'fixture@example.test');
    await input('phone', '09123456789');
    await evaluate('document.querySelector("button[lang]").click()');
    await wait('location.pathname === "/' + other + '/order/order-form" && document.getElementById("full_name")', 'form language switch');
    assert.equal(await evaluate('document.getElementById("full_name").value'), 'Fixture Customer');
    await clickText(translator(other, 'OrderForm')('next'));
    await wait('document.getElementById("page_count")', 'second form step');
    await input('page_count', '3');
    await input('project_description', 'Fixture description');
    await evaluate('document.querySelector("[role=radio]").click();document.querySelector("[role=checkbox]").click()');
    await clickText(translator(other, 'OrderForm')('submit'));
    await wait('document.body.textContent.includes(' + JSON.stringify(translator(other, 'OrderForm')('successTitle')) + ')', 'order success');
    assert.equal(submitted.formKey, 'order');
    assert.equal(submitted.data.service_type, 'web_store');
    assert.equal(submitted.data.budget_range, 'low');
    assert.equal(submitted.data.page_count, 3);
    assert.deepEqual(submitted.data.website_type, ['responsive']);
    await navigate('/' + locale + '/order/review-orders');
    await wait('document.body.textContent.includes("Fixture Customer")', 'order review');
    assert.ok(await evaluate('document.body.textContent.includes(' + JSON.stringify(catalogs[locale].OrderStatus.PENDING) + ')'));
    assert.equal(await evaluate('document.body.textContent.includes("web_store")'), false);
    await evaluate('document.querySelector(' + JSON.stringify('button[aria-label="' + catalogs[locale].ReviewOrders.columns.actions + '"]') + ').focus()');
    await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
    await wait('document.querySelector("[role=menuitem]")', 'order actions');
    await evaluate('[...document.querySelectorAll("[role=menuitem]")].find(e => e.textContent.trim() === ' + JSON.stringify(catalogs[locale].ReviewOrders.viewDetails) + ').click()');
    await wait('document.querySelector("[role=dialog]")', 'order details');
    assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Fixture description")'));
    await navigate('/' + locale + '/unknown');
    assert.ok(await evaluate('document.body.textContent.includes(' + JSON.stringify(catalogs[locale].Common.notFoundTitle) + ')'));
    formUnavailable = true;
    await navigate('/' + locale + '/order/order-form');
    await wait('document.body.textContent.includes(' + JSON.stringify(catalogs[locale].Errors.FORM_TRANSLATION_MISSING) + ')', 'missing database translation');
    formUnavailable = false;
  }
  assert.deepEqual(exceptions, [], 'Browser runtime exceptions');
  assert.deepEqual(localizationErrors, [], 'Localization/hydration console errors');
  console.log('PASS: desktop/mobile en/fa, locale links/switch/query/hash/refresh/history, mocked OTP/registration/network/rate-limit flows, dynamic validation/value preservation/submission, order review/details, localized 404/unavailable states; no runtime or localization/hydration errors.');
  console.log('Screenshots: ' + artifactDir);
} finally {
  socket?.close();
  browser.kill();
}
