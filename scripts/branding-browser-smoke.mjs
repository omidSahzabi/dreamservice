// Local browser checks against a production build. No login, database writes or SMS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base = process.argv[2] ?? 'http://127.0.0.1:3100';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
assert.ok(executable, 'Installed Chrome or Edge is required');
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamservice-branding-'));
const catalogs = Object.fromEntries(['en', 'fa'].map(locale => [locale, JSON.parse(fs.readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'))]));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-extensions', '--user-data-dir=' + artifacts, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
let socket;
let checks = 0;
const errors = [];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    const file = path.join(artifacts, 'DevToolsActivePort');
    if (fs.existsSync(file)) {port = fs.readFileSync(file, 'utf8').split('\n')[0]; break;}
    await pause(100);
  }
  assert.ok(port, 'Browser debug endpoint');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  let sequence = 0;
  const pending = new Map();
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {pending.delete(id); reject(new Error('Browser timeout: ' + method));}, 30000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  socket.onmessage = async event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const item = pending.get(data.id);
      if (item) {clearTimeout(item.timer); pending.delete(data.id); if (data.error) item.reject(new Error(data.error.message)); else item.resolve(data.result);}
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    else if (data.method === 'Runtime.consoleAPICalled') {
      const message = data.params.args.map(arg => arg.value ?? '').join(' ');
      if (/MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(message)) errors.push(message);
    } else if (data.method === 'Fetch.requestPaused') {
      const {request, requestId} = data.params;
      const url = new URL(request.url);
      if (url.origin !== new URL(base).origin) await command('Fetch.failRequest', {requestId, errorReason: 'BlockedByClient'});
      else if (url.pathname.startsWith('/api/')) {
        assert.equal(request.method, 'GET', 'Verification must never submit forms');
        await command('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'application/json'}], body: Buffer.from(JSON.stringify(url.pathname === '/api/team' ? [] : {success: false, user: null})).toString('base64')});
      } else await command('Fetch.continueRequest', {requestId});
    }
  };
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error('Browser expression failed: ' + expression);
    return result.result.value;
  }
  async function wait(expression, label) {
    for (let i = 0; i < 150; i++) {if (await evaluate(expression)) return; await pause(100);}
    throw new Error('Timeout: ' + label);
  }
  async function screenshot(name) {
    const shot = await command('Page.captureScreenshot', {format: 'png'});
    fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
  }
  async function verifyBrand(selector, theme, width) {
    const metrics = await evaluate(`(() => {
      const brand = document.querySelector(${JSON.stringify(selector)});
      if (!brand) return null;
      const svg = [...brand.children].find(el => getComputedStyle(el).display !== 'none');
      const box = brand.getBoundingClientRect(), bounds = svg.getBBox(), view = svg.viewBox.baseVal;
      return {root:document.documentElement.className,darkAncestor:brand.closest('.dark')?.tagName,left:box.left,right:box.right,width:box.width,height:box.height,dir:getComputedStyle(brand).direction,ink:getComputedStyle(brand).color,accent:getComputedStyle(svg.querySelector('.ds-brand-accent')).color,fits:bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=view.width&&bounds.y+bounds.height<=view.height,link:brand.closest('a')?.getAttribute('aria-label')};
    })()`);
    assert.ok(metrics, selector);
    assert.equal(metrics.dir, 'ltr');
    assert.equal(metrics.ink, theme === 'dark' ? 'rgb(248, 250, 252)' : 'rgb(6, 17, 30)', JSON.stringify({selector,theme,width,metrics}));
    assert.equal(metrics.accent, theme === 'dark' ? 'rgb(34, 211, 238)' : 'rgb(6, 182, 212)');
    assert.ok(metrics.fits, 'Paths must fit their SVG canvas');
    assert.ok(metrics.left >= 0 && metrics.right <= width, 'Brand stays within viewport: ' + JSON.stringify({selector,theme,width,metrics}));
    assert.ok(metrics.width >= 172 && metrics.height >= 32, 'Reserved logo size');
    assert.ok(metrics.link, 'Localized link name');
    checks++;
    return metrics;
  }
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Fetch.enable', {patterns: [{urlPattern: '*', requestStage: 'Request'}]});
  // Disable motion only for stable screenshots; loader motion has its own browser suite.
  await command('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  for (const locale of ['en', 'fa']) for (const width of [320, 390, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', {width, height: 960, deviceScaleFactor: 1, mobile: width < 640});
    await command('Page.navigate', {url: base + '/' + locale});
    const login = catalogs[locale].Navbar.login;
    await wait(`document.documentElement.lang===${JSON.stringify(locale)} && [...document.querySelectorAll('nav button')].some(el=>el.textContent.trim()===${JSON.stringify(login)})`, 'home hydration');
    await wait(`[...document.querySelectorAll('nav button')].some(el=>!el.disabled&&[${JSON.stringify(catalogs[locale].Navbar.lightTheme)},${JSON.stringify(catalogs[locale].Navbar.darkTheme)}].includes(el.getAttribute('aria-label')))`, 'theme hydration');
    assert.equal(await evaluate('document.documentElement.dir'), locale === 'fa' ? 'rtl' : 'ltr'); checks++;
    for (const theme of ['light', 'dark']) {
      if (await evaluate("document.documentElement.classList.contains('dark')") !== (theme === 'dark')) {
        await evaluate(`[...document.querySelectorAll('nav button')].find(el=>el.getAttribute('aria-label')===${JSON.stringify(catalogs[locale].Navbar[theme === 'dark' ? 'darkTheme' : 'lightTheme'])}).click()`);
      }
      await wait(`document.documentElement.classList.contains('dark')===${theme === 'dark'}`, 'theme switch');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await wait(`getComputedStyle(document.querySelector('nav .ds-brand')).color===${JSON.stringify(theme === 'dark' ? 'rgb(248, 250, 252)' : 'rgb(6, 17, 30)')}`, 'theme paint');
      const before = await verifyBrand('nav .ds-brand', theme, width);
      await verifyBrand('footer .ds-brand', theme, width);
      await screenshot(`${locale}-${width}-${theme}`);
      if (width < 640) {
        await evaluate(`document.querySelector('button[aria-label='+${JSON.stringify(JSON.stringify(catalogs[locale].Navbar.openMenu))}+']').click()`);
        await wait(`document.querySelector('[data-slot="sheet-content"] .ds-brand')!==null`, 'mobile menu');
        await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        await verifyBrand('[data-slot="sheet-content"] .ds-brand', theme, width);
        await screenshot(`${locale}-${width}-${theme}-menu`);
      }
      await evaluate(`[...document.querySelectorAll('button')].filter(el=>el.getBoundingClientRect().width>0&&el.textContent.trim()===${JSON.stringify(login)}).at(-1).click()`);
      await wait(`document.querySelector('[role="dialog"]:not([data-slot="sheet-content"]) .ds-brand')!==null`, 'auth modal');
      await verifyBrand('[role="dialog"]:not([data-slot="sheet-content"]) .ds-brand', theme, width);
      await screenshot(`${locale}-${width}-${theme}-auth`);
      await evaluate(`[...document.querySelectorAll('[role="dialog"]:not([data-slot="sheet-content"]) button')].find(el=>el.textContent.trim()===${JSON.stringify(catalogs[locale].Common.close)}).click()`);
      await wait(`document.querySelector('[role="dialog"]:not([data-slot="sheet-content"])')===null`, 'auth close');
      if (width < 640) {
        await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        await wait(`document.querySelector('[data-slot="sheet-content"]')===null`, 'menu close');
      }
      const after = await verifyBrand('nav .ds-brand', theme, width);
      assert.equal(before.width, after.width); assert.equal(before.height, after.height); checks++;
    }
    if (width === 390) for (const route of ['/account', '/order/review-orders', '/admin/users', '/admin/projects', '/admin/tickets']) {
      await command('Page.navigate', {url: base + '/' + locale + route});
      await wait(`location.pathname===${JSON.stringify('/' + locale + route)} && document.querySelector('nav .ds-brand')!==null && document.readyState==='complete'`, route);
      await evaluate("document.documentElement.classList.add('dark')");
      await verifyBrand('nav .ds-brand', 'dark', width);
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed: checks, locales: ['en', 'fa'], themes: ['light', 'dark'], widths: [320, 390, 1440], surfaces: ['header', 'footer', 'mobile menu', 'auth modal', 'customer routes', 'admin routes'], authenticatedData: false, databaseWrites: false, realSms: false, artifacts}));
} catch (error) {
  console.error('Branding browser artifacts: ' + artifacts);
  throw error;
} finally {socket?.close(); browser.kill();}
