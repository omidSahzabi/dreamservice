// Local-only visual comparison. API responses are fixtures; no forms are submitted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

const base = process.argv[2] ?? 'http://localhost:3100';
const reference = process.argv[3];
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
if (!process.argv.includes('--implementation-only')) assert.ok(reference && fs.existsSync(reference), 'Pass the approved reference HTML as the second argument');
const artifacts = path.resolve('coverage/cinematic-review');
fs.mkdirSync(artifacts, {recursive:true});
const profile = fs.mkdtempSync(path.join(artifacts, 'browser-'));
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(executable, 'Installed Chrome or Edge is required');
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-extensions', '--user-data-dir=' + profile, 'about:blank'], {windowsHide:true, stdio:'ignore'});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const catalogs = Object.fromEntries(['en', 'fa'].map(locale => [locale, JSON.parse(fs.readFileSync('messages/' + locale + '.json', 'utf8'))]));
let socket;
let checks = 0;
let recording = null;
const recordings = [];
const geometry = JSON.parse(fs.readFileSync('src/components/brand/geometry.json','utf8'));
const errors = [];
const metrics = [];
const blockedMutations = [];
const variants = process.argv.includes('--implementation-only') ? ['implementation'] : ['reference', 'implementation'];
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    const file = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(file)) {port = fs.readFileSync(file, 'utf8').split('\n')[0]; break;}
    await pause(100);
  }
  assert.ok(port, 'Browser debugging endpoint');
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
    } else if (data.method === 'Page.screencastFrame') {
      await command('Page.screencastFrameAck',{sessionId:data.params.sessionId});
      if(recording && recording.frames.length<100) {
        const name=recording.name+'-'+String(recording.frames.length).padStart(3,'0')+'.jpg';
        fs.writeFileSync(path.join(artifacts,name),Buffer.from(data.params.data,'base64'));
        recording.frames.push(name);
      }
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    else if (data.method === 'Runtime.consoleAPICalled') {
      const message = data.params.args.map(arg => arg.value ?? '').join(' ');
      if (/MISSING_MESSAGE|hydration failed|hydration mismatch/i.test(message)) errors.push(message);
    } else if (data.method === 'Fetch.requestPaused') {
      const {request, requestId} = data.params;
      const url = new URL(request.url);
      if (url.protocol === 'file:' || url.protocol === 'data:') await command('Fetch.continueRequest', {requestId});
      else if (url.origin !== new URL(base).origin) await command('Fetch.failRequest', {requestId, errorReason:'BlockedByClient'});
      else if (url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET') {
          blockedMutations.push(url.pathname);
          await command('Fetch.failRequest', {requestId, errorReason:'BlockedByClient'});
        } else await command('Fetch.fulfillRequest', {requestId, responseCode:200, responseHeaders:[{name:'Content-Type', value:'application/json'}], body:Buffer.from(JSON.stringify(url.pathname === '/api/team' ? [] : {success:true, user:null})).toString('base64')});
      } else await command('Fetch.continueRequest', {requestId});
    }
  };
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
    if (result.exceptionDetails) throw new Error('Browser expression failed: ' + expression + ': ' + result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression, label) {
    for (let attempt = 0; attempt < 200; attempt++) {if (await evaluate(expression)) return; await pause(100);}
    throw new Error('Timeout: ' + label);
  }
  async function screenshot(name) {
    const shot = await command('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
  }
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Fetch.enable', {patterns:[{urlPattern:'*', requestStage:'Request'}]});
  await command('Page.addScriptToEvaluateOnNewDocument', {source:`
    globalThis.__cinematicFrames=0;
    const Path=Path2D;
    globalThis.Path2D=class extends Path {constructor(d){super(d);this.source=d;}};
    globalThis.__shotHistory=[];
    const proto=CanvasRenderingContext2D.prototype,clear=proto.clearRect,fill=proto.fill,arc=proto.arc,stroke=proto.stroke,begin=proto.beginPath,move=proto.moveTo,line=proto.lineTo;
    proto.clearRect=function(...args){globalThis.__cinematicFrames++;if(globalThis.__shot?.hub){globalThis.__shotHistory.push(globalThis.__shot);if(globalThis.__shotHistory.length>2000)globalThis.__shotHistory.shift();}globalThis.__shot={time:performance.now(),hands:{}};return clear.apply(this,args);};
    proto.beginPath=function(){this.recordedPath=[];return begin.call(this);};
    proto.moveTo=function(x,y){const p=this.getTransform().transformPoint(new DOMPoint(x,y));this.recordedPath?.push({x:p.x,y:p.y});return move.call(this,x,y);};
    proto.lineTo=function(x,y){const p=this.getTransform().transformPoint(new DOMPoint(x,y));this.recordedPath?.push({x:p.x,y:p.y});return line.call(this,x,y);};
    proto.stroke=function(...args){if(['#dffefa','#98fff1','#38deea'].includes(this.strokeStyle))globalThis.__shot.hands[this.strokeStyle]=this.recordedPath;return stroke.apply(this,args);};
    proto.arc=function(x,y,r,...args){if(r===8){const p=this.getTransform().transformPoint(new DOMPoint(x,y));globalThis.__shot.hub={x:p.x,y:p.y};}return arc.call(this,x,y,r,...args);};
    proto.fill=function(path,...args){if(path?.source===${JSON.stringify(geometry.needle)}){const p=this.getTransform().transformPoint(new DOMPoint(31,16));globalThis.__shot.arrow={x:p.x,y:p.y,alpha:this.globalAlpha};}if(path?.source===${JSON.stringify(geometry.arch)}){const m=this.getTransform();globalThis.__shot.bow={alpha:this.globalAlpha,scaleX:Math.hypot(m.a,m.b),scaleY:Math.hypot(m.c,m.d)};}return fill.call(this,path,...args);};
  `});
  for (const locale of ['fa', 'en']) for (const width of [1440, 390]) for (const variant of variants) {
    const height = width === 1440 ? 960 : 844;
    const isReference = variant === 'reference';
    await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor:1, mobile:width < 700});
    await command('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion', value:'no-preference'}]});
    await command('Page.navigate', {url:isReference ? pathToFileURL(reference).href : base + '/' + locale});
    await wait(isReference ? "document.querySelector('#story') && document.readyState==='complete'" : "document.querySelector('#cinematic-story') && document.readyState==='complete'", 'page ready');
    if (isReference && locale === 'en') await evaluate("document.querySelector('#langBtn').click()");
    await wait(`document.documentElement.lang===${JSON.stringify(locale)}`, 'locale');
    await pause(2400);
    if (!isReference && width === 1440) {
      for (let toggle=0; toggle<2; toggle++) {
        const dark = await evaluate('document.documentElement.classList.contains("dark")');
        const label = catalogs[locale].Navbar[dark ? 'lightTheme' : 'darkTheme'];
        await evaluate(`[...document.querySelectorAll('nav button')].find(el=>el.getAttribute('aria-label')===${JSON.stringify(label)}).click()`);
        await wait(`document.documentElement.classList.contains('dark')===${!dark}`, 'theme control');
        assert.equal(await evaluate('getComputedStyle(document.querySelector("nav .ds-brand")).color'), 'rgb(248, 250, 252)', 'Official identity stays legible on the cinematic background'); checks++;
      }
    }
    await screenshot(`${variant}-${locale}-${width}-hero`);
    assert.equal(await evaluate('document.documentElement.dir'), locale === 'fa' ? 'rtl' : 'ltr'); checks++;
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'No horizontal overflow: ' + variant + locale + width); checks++;
    const selector = isReference ? '#story' : '#cinematic-story';
    for (const [name, progress, stage] of [['hemisphere', .04, 0], ['questions-early', .23, 1], ['questions', .42, 1], ['pressure', .59, 2], ['brand', .649, 3], ['bow', .697, 3], ['flight', .76, 3], ['impact', .8085, 3], ['shockwave', .840, 3], ['settling', .885, 3], ['message-first', .910, 4], ['resolution', .985, 4]]) {
      if (!isReference && name==='flight') {
        await evaluate('globalThis.__shotHistory=[]');
        recording={name:'motion-'+locale+'-'+width,frames:[]};
        await command('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1440,maxHeight:960,everyNthFrame:1});
      }
      await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-innerHeight)*${progress},behavior:'instant'});})()`);
      await wait('document.querySelector("canvas")?.width>0', 'canvas ready');
      if(!isReference && name==='flight') await pause(230);
      else if(!isReference && name==='impact') await wait('globalThis.__shot.arrow && globalThis.__shot.hub && globalThis.__shot.arrow.x>=globalThis.__shot.hub.x', 'arrow reaches center');
      else if(!isReference && name==='shockwave') await pause(130);
      else if(!isReference && name==='settling') await pause(460);
      else await pause(800);
      await screenshot(`${variant}-${locale}-${width}-${name}`);
      const bounds = await evaluate(`(()=>{const story=document.querySelector(${JSON.stringify(selector)}),chapter=story.querySelector(${JSON.stringify('[data-chapter="' + stage + '"]')}),canvas=story.querySelector('canvas');const box=chapter.getBoundingClientRect(),visual=canvas.getBoundingClientRect();return {stage:story.dataset.cinematicStage??${stage},left:box.left,right:box.right,top:box.top,bottom:box.bottom,visualTop:visual.top,visualBottom:visual.bottom};})()`);
      metrics.push({variant, locale, width, name, ...bounds});
      if (!isReference) {
        assert.equal(Number(bounds.stage), stage, name); checks++;
        if(name==='impact') {
          const history=await evaluate('globalThis.__shotHistory');
          const shot=history.filter(s=>s.arrow&&s.hub).sort((a,b)=>Math.abs(a.arrow.x-a.hub.x)-Math.abs(b.arrow.x-b.hub.x))[0];
          assert.ok(shot.arrow&&shot.hub,'Rendered SVG and clock hub');
          assert.ok(Math.hypot(shot.arrow.x-shot.hub.x,shot.arrow.y-shot.hub.y)<.4,'Actual rendered trajectory reaches clock center: '+JSON.stringify(shot));checks++;
          assert.ok(history.filter(s=>s.arrow).every(s=>s.arrow.alpha===1),'Arrow remains opaque throughout flight and impact');checks++;
          const flight=history.filter(s=>s.arrow&&s.hub&&s.arrow.x<s.hub.x);
          assert.notDeepEqual(flight[0]?.hands,flight.at(-1)?.hands,'Clock keeps rotating until physical impact');checks++;
        }
        if(name==='pressure') {
          const hands=await evaluate('globalThis.__shot.hands');
          await pause(200);
          assert.notDeepEqual(await evaluate('globalThis.__shot.hands'),hands,'Visible hands move while scrolling is stationary');checks++;
        }
        if(name==='brand'||name==='bow') {
          const bow=await evaluate('globalThis.__shot.bow');
          assert.ok(bow?.alpha>.9&&Math.abs(bow.scaleX-bow.scaleY)<1e-6,'Official bow keeps its SVG aspect ratio');checks++;
        }
        assert.equal(await evaluate('[...document.querySelectorAll("[data-chapter]")].filter(el=>getComputedStyle(el).visibility==="visible").length'),1,'Only the active chapter is exposed'); checks++;
        assert.ok(bounds.left >= 0 && bounds.right <= width, 'Chapter fits viewport'); checks++;
        if (width < 700) assert.ok(bounds.bottom <= bounds.visualTop + 12, 'Story copy stays above scene: ' + JSON.stringify({locale,name,bounds}));
        if(name==='settling') {
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-chapter="4"]')).visibility`),'hidden','Message waits for complete settling');checks++;
        }
        if(name==='message-first') {
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-chapter="4"] p')).visibility`),'hidden','Typography precedes supporting text');checks++;
        }
        if(name==='resolution') {
          if(recording) {await command('Page.stopScreencast');recordings.push(recording);recording=null;}
          const frozen=await evaluate('globalThis.__shot');
          assert.equal(frozen.arrow?.alpha,1,'Embedded arrow survives the final chapter');checks++;
          assert.ok(frozen.arrow.x>frozen.hub.x&&frozen.arrow.x-frozen.hub.x<10,'Arrow penetrates slightly past hub');checks++;
          await pause(250);
          assert.deepEqual(await evaluate('globalThis.__shot.hands'),frozen.hands,'Hands remain permanently stopped');checks++;
          assert.deepEqual(await evaluate('globalThis.__shot.arrow'),frozen.arrow,'Arrow has settled into a stable position');checks++;
          for(let toggle=0;toggle<2;toggle++) {
            const dark=await evaluate('document.documentElement.classList.contains("dark")');
            const label=catalogs[locale].Navbar[dark?'lightTheme':'darkTheme'];
            {
              if(width===1440) await evaluate(`[...document.querySelectorAll('nav button')].find(el=>el.getAttribute('aria-label')===${JSON.stringify(label)}).click()`);
              else await evaluate(`document.documentElement.classList.toggle('dark',${!dark})`);
              await wait(`document.documentElement.classList.contains('dark')===${!dark}`,'resolution theme');
              await screenshot(`implementation-${locale}-${width}-resolution-${!dark?'dark':'light'}`);checks++;
            }
          }
        }
        if (name === 'hemisphere') {
          const point = await evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
          await command('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', clickCount:1, ...point});
          await command('Input.dispatchMouseEvent', {type:'mouseMoved', button:'left', buttons:1, x:point.x+90, y:point.y+15});
          await command('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', clickCount:1, x:point.x+90, y:point.y+15});
          if (width < 700) {
            const beforeScroll = await evaluate('scrollY');
            await command('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:point.x,y:point.y}]});
            for (const delta of [30,60,90]) await command('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:point.x+delta,y:point.y}]});
            await command('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
            assert.ok(Math.abs(await evaluate('scrollY')-beforeScroll)<2, 'Horizontal touch rotation preserves scroll position'); checks++;
          }
          await evaluate('document.querySelector("canvas").focus()');
          await command('Input.dispatchKeyEvent', {type:'keyDown', key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39});
          await command('Input.dispatchKeyEvent', {type:'keyUp', key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39});
          await pause(250);
          await screenshot(`${variant}-${locale}-${width}-rotation`);
          await evaluate('document.activeElement.blur()');
          checks++;
        }
      }
    }
    if (!isReference) {
      const embedded=await evaluate('globalThis.__shot');
      await evaluate(`(()=>{const el=document.querySelector('#cinematic-story');scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-innerHeight)*.625,behavior:'instant'});})()`);
      await pause(700);
      assert.deepEqual(await evaluate('globalThis.__shot.arrow'),embedded.arrow,'Reverse scroll preserves embedded arrow');checks++;
      assert.deepEqual(await evaluate('globalThis.__shot.hands'),embedded.hands,'Reverse scroll cannot restart clock');checks++;
      // Scrub the completed scene in both directions without replaying its impact.
      await evaluate(`new Promise(resolve=>{const el=document.querySelector('#cinematic-story'),top=el.getBoundingClientRect().top+scrollY,range=el.offsetHeight-innerHeight;const start=performance.now();function frame(now){const t=Math.min(1,(now-start)/1200);scrollTo({top:top+range*(.625+t*.36),behavior:'instant'});if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);})`);
      await pause(600);
      if(recording) {
        await command('Page.stopScreencast');
        recordings.push(recording);recording=null;
      }
      assert.ok(await evaluate(`[...document.querySelectorAll('[data-chapter="4"] h2 span')].every(el=>getComputedStyle(el).opacity==='1')`),'Final typography completes after settling'); checks++;
      const invitation = '#cinematic-story a[href="#cinematic-end"]';
      assert.equal(await evaluate(`document.querySelector('${invitation}').textContent.trim()`),catalogs[locale].Cinematic.nextChapter); checks++;
      await evaluate(`document.querySelector('${invitation}').focus()`);
      await command('Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
      await command('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
      await pause(1100);
      assert.equal(await evaluate('document.activeElement.id'),'cinematic-end','Keyboard scroll invitation transfers focus to existing next section'); checks++;
      assert.ok(await evaluate('Math.abs(document.querySelector("#cinematic-end").getBoundingClientRect().top)<2'),'Invitation scrolls to the next section'); checks++;
      if(width===390) {
        await command('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
        await evaluate(`(()=>{const el=document.querySelector('#cinematic-story');scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-innerHeight)*.985,behavior:'instant'});})()`);
        await pause(900);
        await screenshot('implementation-'+locale+'-320-resolution');
        const resized=await evaluate('globalThis.__shot');
        assert.equal(resized.arrow?.alpha,1,'Embedded arrow survives resize');checks++;
        assert.ok(Math.abs(resized.arrow.y-resized.hub.y)<.01&&resized.arrow.x>resized.hub.x,'Resized arrow remains attached to clock hub');checks++;
        assert.ok(await evaluate(`(()=>{const r=document.querySelector('#cinematic-story a[href="#cinematic-end"]').getBoundingClientRect(),chapter=document.querySelector('[data-chapter="4"]').getBoundingClientRect(),canvas=document.querySelector('canvas').getBoundingClientRect();return chapter.top>=40&&r.bottom<=canvas.top+12&&r.left>=0&&r.right<=innerWidth;})()`),'Final message and invitation fit above the scene at 320 x 568');checks++;
        await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      }
      await evaluate('document.querySelector("#cinematic-story [aria-current=step]").parentElement.children[0].click()');
      await wait('document.querySelector("#cinematic-story").dataset.cinematicStage==="0"', 'first chapter control'); checks++;
      await pause(500);
      const revisited=await evaluate('globalThis.__shot');
      assert.equal(revisited.arrow?.alpha,1,'Revisiting the first chapter cannot remove the arrow');checks++;
      assert.deepEqual(revisited.hands,embedded.hands,'Chapter navigation cannot restart the clock');checks++;
      await evaluate('document.querySelector("#cinematic-story [aria-current=step]").parentElement.children[4].click()');
      await wait('document.querySelector("#cinematic-story").dataset.cinematicStage==="4"', 'final chapter control'); checks++;
      await pause(500);
      await evaluate(`document.querySelector('[data-chapter="4"] button').click()`);
      await wait('document.querySelector("[role=dialog]")!==null', 'existing login modal'); checks++;
      await screenshot(`${variant}-${locale}-${width}-auth`);
      await command('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
      await command('Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
      await wait('document.querySelector("[role=dialog]")===null', 'login dismissal');
      await pause(400);
      await evaluate('document.activeElement.blur()');
      await evaluate('document.querySelector("#cinematic-end").scrollIntoView({behavior:"instant"})');
      await evaluate('scrollBy({top:4,behavior:"instant"})');
      await pause(700);
      await screenshot(`${variant}-${locale}-${width}-outro`);
      const canvasBounds = await evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {top:r.top,bottom:r.bottom,scrollY};})()');
      assert.ok(canvasBounds.bottom <= 0 || canvasBounds.top >= height, 'Canvas must be offscreen before checking pause: ' + JSON.stringify(canvasBounds));
      const count = await evaluate('globalThis.__cinematicFrames');
      await pause(250);
      assert.equal(await evaluate('globalThis.__cinematicFrames'), count, 'Canvas pauses offscreen'); checks++;
      assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1); checks++;
      assert.equal(await evaluate('document.querySelectorAll("[data-count]").length'), 6); checks++;
      assert.ok(await evaluate(`document.body.textContent.includes(${JSON.stringify(catalogs[locale].Cinematic.counterFootnote)})`)); checks++;
      await command('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion', value:'reduce'}]});
      await pause(200);
      await evaluate('document.querySelector("#cinematic-story").scrollIntoView({behavior:"instant"})');
      await pause(400);
      assert.ok(await evaluate('[...document.querySelectorAll("[data-chapter]")].every(el=>getComputedStyle(el).opacity==="1"&&getComputedStyle(el).visibility==="visible"&&!el.inert)'), 'Reduced motion exposes the complete story'); checks++;
      await screenshot(`${variant}-${locale}-${width}-reduced`);
    }
  }
  assert.deepEqual(errors, [], 'No runtime, hydration or translation failures');
  assert.deepEqual(blockedMutations, [], 'No mutation requests attempted');
  fs.writeFileSync(path.join(artifacts,'motion-review.html'),`<!doctype html><meta charset="utf-8"><title>DreamService impact playback</title><style>body{background:#030d16;color:#eefaff;font:16px system-ui;margin:24px}img{display:block;max-width:100%;max-height:78vh}button{margin:12px;padding:10px}</style><h1>Rendered impact sequence</h1><p>Recorded from a continuous animation-frame scroll. Use the slider to inspect release and impact.</p><select id="scene"></select><button id="play">Play / pause</button><input id="frame" type="range" min="0" value="0"><img id="view" alt="Recorded animation frame"><script>const recordings=${JSON.stringify(recordings)};let run=true;const select=document.querySelector('#scene'),slider=document.querySelector('#frame'),view=document.querySelector('#view');for(const r of recordings)select.add(new Option(r.name,r.name));function draw(){const r=recordings.find(r=>r.name===select.value);slider.max=r.frames.length-1;view.src=r.frames[Number(slider.value)];}select.onchange=()=>{slider.value=0;draw()};slider.oninput=()=>{run=false;draw()};document.querySelector('#play').onclick=()=>run=!run;setInterval(()=>{if(run){slider.value=(Number(slider.value)+1)%(Number(slider.max)+1);draw()}},100);draw();</script>`);
  fs.writeFileSync(path.join(artifacts, 'metrics.json'), JSON.stringify(metrics,null,2));
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({passed:checks, errors, blockedMutations, databaseWrites:false, realSms:false},null,2));
  fs.writeFileSync(path.join(artifacts, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>DreamService local visual comparison</title><style>body{margin:24px;background:#030d16;color:#eefaff;font:16px system-ui}select{padding:10px;margin:0 12px 20px 0;background:#0a2030;color:#eefaff;border:1px solid #315b6d;border-radius:8px}.views{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{display:block;width:100%;height:auto}figure{margin:0}figcaption{padding:12px 0;color:#9dbbc9}</style><h1>DreamService — local visual comparison</h1><label>Language <select id="locale"><option value="fa">Persian</option><option value="en">English</option></select></label><label>Viewport <select id="width"><option>1440</option><option>390</option></select></label><label>Stage <select id="stage">${['hero','hemisphere','questions-early','questions','pressure','bow','flight','impact','shockwave','settling','message-first','resolution'].map(stage=>'<option>'+stage+'</option>').join('')}</select></label><div class="views"><figure><figcaption>Approved reference</figcaption><img id="reference" alt="Approved HTML reference"></figure><figure><figcaption>Next.js implementation</figcaption><img id="implementation" alt="DreamService local implementation"></figure></div><script>function update(){for(const variant of ['reference','implementation'])document.getElementById(variant).src=variant+'-'+document.getElementById('locale').value+'-'+document.getElementById('width').value+'-'+document.getElementById('stage').value+'.png'}document.querySelectorAll('select').forEach(el=>el.addEventListener('change',update));update();</script></html>`);
  console.log(JSON.stringify({passed:checks, artifacts, databaseWrites:false, realSms:false}));
} finally {socket?.close(); browser.kill();}
