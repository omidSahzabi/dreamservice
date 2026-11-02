import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const {createHemisphereRenderer} = load('src/components/modules/cinematic/hemisphere-renderer.ts');
const {chapterAt, climax, createCinematicTimeline, clockSpeedAt, handRatios, shotAt, shotGeometry, shotDuration} = load('src/components/modules/cinematic/timeline.ts');
// Record SVG geometry and transforms; visual path rendering is verified in Chromium.
globalThis.Path2D = class { constructor(d) { this.d = d; } addPath(path, matrix) {this.d = path.d; this.matrix = matrix;} };

function canvas() {
  let lines = [], texts = [], arcs = [], fills = [], current = [];
  let matrix = [1,0,0,1,0,0];
  const stack = [];
  const project = (x,y) => [matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
  let styles = {globalAlpha:1};
  const context = new Proxy({}, {
    set(_, key, value) {styles[key] = value; return true;},
    get(_, key) {
      if (key === 'save') return () => stack.push({matrix:[...matrix],styles:{...styles}});
      if (key === 'restore') return () => {({matrix,styles}=stack.pop());};
      if (key === 'translate') return (x,y) => {const p=project(x,y); matrix[4]=p[0];matrix[5]=p[1];};
      if (key === 'scale') return (x,y) => {matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;};
      if (key === 'rotate') return angle => {const [a,b,c,d]=matrix,cos=Math.cos(angle),sin=Math.sin(angle); matrix[0]=a*cos+c*sin;matrix[1]=b*cos+d*sin;matrix[2]=c*cos-a*sin;matrix[3]=d*cos-b*sin;};
      if (key === 'fill') return path => {if(path instanceof Path2D) fills.push({path:path.d,tip:project(31,16),alpha:styles.globalAlpha,color:styles.fillStyle,scaleX:Math.hypot(matrix[0],matrix[1]),scaleY:Math.hypot(matrix[2],matrix[3])});};
      if (key === 'createRadialGradient') return () => ({addColorStop(){}});
      if (key === 'beginPath') return () => {current = [];};
      if (key === 'moveTo' || key === 'lineTo') return (x,y) => {assert.ok(Number.isFinite(x)&&Number.isFinite(y)); current.push(project(x,y));};
      if (key === 'stroke') return () => {lines.push({color:styles.strokeStyle, points:[...current]});};
      if (key === 'fillText') return (text,x,y) => {texts.push({text,x,y});};
      if (key === 'arc') return (x,y,r) => {assert.ok(r>=0&&Number.isFinite(r)); const p=project(x,y); arcs.push({x:p[0],y:p[1],r});};
      return () => {};
    },
  });
  const renderer = createHemisphereRenderer(context);
  renderer.resize(760,760);
  return {renderer, frame(progress, time=1000, reduced=true) {
    lines=[]; texts=[]; arcs=[]; fills=[];
    renderer.render(time,32,{progress,turn:.25,oscillation:0,settled:progress>=climax.settled},reduced);
    return {lines,texts,arcs,fills};
  }};
}

test('the five chapters follow the approved progression, including reverse scrolling',()=>{
  assert.deepEqual([0,.18,.19,.44,.45,.62,.63,.84,.899,.90,1].map(chapterAt),[0,0,1,1,2,2,3,3,3,4,4]);
  assert.deepEqual([.95,.73,.54,.30,0].map(chapterAt),[4,3,2,1,0]);
});

test('the rear clock keeps 12 above, 3 right, 6 below and 9 left',()=>{
  const {frame} = canvas();
  const {texts} = frame(.6);
  assert.equal(texts.length,12);
  const at = value => texts.find(item=>item.text===String(value));
  assert.ok(at(12).y < at(6).y);
  assert.ok(at(3).x > at(9).x);
  assert.ok(Math.abs(at(12).x-at(6).x)<1);
});

test('official SVG arrow tip meets the projected clock hub exactly at impact',()=>{
  const {frame} = canvas();
  const {fills,arcs} = frame(climax.impact,1000,false);
  const geometry = JSON.parse(fs.readFileSync('src/components/brand/geometry.json','utf8'));
  const arrow = fills.find(fill=>fill.path===geometry.needle);
  assert.ok(fills.some(fill=>fill.path===geometry.arch),'Use official bow geometry');
  const hub = arcs.find(arc=>arc.r===8);
  assert.ok(arrow&&hub);
  assert.ok(Math.abs(arrow.tip[0]-hub.x)<.001);
  assert.ok(Math.abs(arrow.tip[1]-hub.y)<.001);
});

test('geometry is identical to the official brand commit and bow proportions are never distorted',()=>{
  const official=JSON.parse(execFileSync('git',['show','fb63f6c:src/components/brand/geometry.json'],{encoding:'utf8'}));
  assert.deepEqual(JSON.parse(fs.readFileSync('src/components/brand/geometry.json','utf8')),official);
  const {frame}=canvas();
  const bow=frame(climax.entered,1000,false).fills.find(fill=>fill.path===official.arch);
  assert.equal(bow.scaleX,bow.scaleY);
  assert.equal(bow.color,'#f8fafc');
  assert.ok(26*shotGeometry.scale/2<.3,'Bow height stays below 30% of the clock diameter');
});

test('clock runs without scrolling, accelerates through questions, and uses synchronized hand ratios',()=>{
  const timeline=createCinematicTimeline();
  const first=timeline.advance(16,.3);
  for(let i=0;i<60;i++) timeline.advance(16,.3);
  assert.ok(timeline.frame().turn>first.turn+2.8,'Visible hands move at a stationary scroll position');
  for(const [a,b] of [[.19,.25],[.25,.4],[.4,.55],[.55,climax.release]]) assert.ok(clockSpeedAt(b)>clockSpeedAt(a));
  assert.equal(clockSpeedAt(climax.release),42);
  assert.ok(handRatios.second<handRatios.minute&&handRatios.minute<handRatios.hour);
});

test('flight cannot be skipped and clock brakes only after collision, then stays stopped on reverse scroll',()=>{
  const timeline=createCinematicTimeline();
  timeline.advance(16,.7);
  let previous=timeline.frame(), previousVelocity=0, seenImpact=false, brakingVelocity=Infinity, settling=false;
  for(let i=0;i<120;i++) {
    const current=timeline.advance(16,1),velocity=(current.turn-previous.turn)/.016;
    if(current.progress<climax.impact) assert.ok(velocity>0,'Never freeze in flight');
    if(current.progress>=climax.impact&&!seenImpact) {
      assert.ok(previous.progress<climax.impact);
      assert.ok(velocity>previousVelocity*.85,'Velocity is continuous at collision');
      seenImpact=true;
    }
    if(current.progress>climax.impact+.004&&current.progress<climax.stopped) {
      assert.ok(velocity<brakingVelocity);brakingVelocity=velocity;
    }
    if(Math.abs(current.oscillation)>0) settling=true;
    previousVelocity=velocity;previous=current;
  }
  assert.ok(seenImpact&&settling&&timeline.frame().settled);
  const frozen=timeline.frame().turn;
  for(const p of [0,.3,.7,1]) for(let i=0;i<10;i++) {
    const current=timeline.advance(16,p);
    assert.equal(current.turn,frozen);assert.equal(current.oscillation,0);
    assert.ok(current.progress>=climax.settled,'The impacted scene cannot rewind');
  }
});

test('visible-time motion remains consistent at different render cadences',()=>{
  const play=dt=>{
    const timeline=createCinematicTimeline();
    for(let ms=0;ms<960;ms+=dt) timeline.advance(dt,.65);
    for(let ms=0;ms<1920;ms+=dt) timeline.advance(dt,1);
    return timeline.frame();
  };
  assert.ok(Math.abs(play(8).turn-play(32).turn)<.000001);
});

test('draw and release keep the official arrow nock attached to the string',()=>{
  assert.ok(shotAt(.675).string<shotAt(.655).string);
  assert.equal(shotAt(.715).string,shotAt(.730).string);
  assert.equal(shotAt(climax.release).flight,0);
  for (const p of [.734,.740,.750]) {
    const shot=shotAt(p);
    assert.ok(Math.abs(shot.string-(-shotGeometry.draw+(shotGeometry.distance/shotGeometry.scale-13)*shot.flight))<.000001,'Arrow nock remains attached during acceleration');
  }
  assert.ok(shotAt(.79).flight-shotAt(.78).flight>shotAt(.76).flight-shotAt(.75).flight);
  assert.equal(shotAt(climax.impact).flight,1);
  assert.equal(shotAt(.80).flash,0);
  assert.equal(shotAt(.90).flash,0);
});

test('embedded arrow is opaque, penetrates slightly, and stays aligned on desktop and mobile',()=>{
  const {renderer,frame}=canvas();
  const geometry=JSON.parse(fs.readFileSync('src/components/brand/geometry.json','utf8'));
  for(const [width,height] of [[760,760],[390,400],[320,340]]) {
    renderer.resize(width,height);
    for(const progress of [climax.impact,.84,.88,.95,1]) {
      const {fills,arcs}=frame(progress,1000,false);
      const arrow=fills.find(fill=>fill.path===geometry.needle),hub=arcs.find(arc=>arc.r===8);
      assert.equal(arrow.alpha,1);
      assert.equal(arrow.color,'#22d3ee');
      assert.ok(Math.abs(arrow.tip[1]-hub.y)<.001);
      const penetration=Math.min(width*.335,height*.315,240)*shotAt(progress).penetration;
      assert.ok(Math.abs(arrow.tip[0]-hub.x-penetration)<.001);
      if(progress>=climax.settled) assert.equal(fills.find(fill=>fill.path===geometry.arch).alpha,0);
    }
  }
});

test('settled renderer is stable across repeated frames',()=>{
  const {frame}=canvas();
  const hands = result => result.lines.filter(line=>['#dffefa','#98fff1','#38deea'].includes(line.color));
  const collision=frame(climax.impact,1000,false);
  frame(.95,2000,false);
  frame(.65,3000,false);
  assert.deepEqual(hands(frame(climax.impact,4000,false)),hands(collision));
  assert.deepEqual(frame(climax.impact,4000,false).fills,collision.fills);
  const frozen=hands(frame(.95,5000,false));
  assert.deepEqual(hands(frame(1,9000,false)),frozen);
});

test('reduced motion omits flight and shockwave while preserving a static embedded arrow',()=>{
  const {frame}=canvas();
  const result=frame(climax.impact,1000,true);
  assert.ok(result.fills.length>0);
  assert.equal(result.lines.some(line=>line.color.startsWith('rgba(176,255,249,')),false);
});

test('reduced motion permanently settles an already released sequence',()=>{
  const timeline=createCinematicTimeline();
  timeline.advance(16,.75);
  const still=timeline.advance(16,1,true);
  assert.ok(still.settled);
  assert.equal(timeline.advance(16,.3).turn,still.turn);
  assert.ok(Math.abs(shotDuration.flight+shotDuration.braking+shotDuration.settling-1.42)<1e-10);
});

test('reduced motion stays still and a dragged hemisphere can be reset',()=>{
  const {renderer, frame} = canvas();
  const initial = frame(0);
  assert.deepEqual(frame(0,4000),initial);
  renderer.rotate(.8,.2);
  assert.notDeepEqual(frame(0),initial);
  renderer.reset();
  assert.deepEqual(frame(0),initial);
  renderer.resize(320,400);
  assert.ok(frame(.95).texts.length===12);
});

for (const locale of ['en','fa']) test('project CTA continues through existing login callback in '+locale,()=>{
  const messages = JSON.parse(fs.readFileSync('messages/'+locale+'.json','utf8'));
  const visits = [];
  let authenticated = false;
  let loading = false;
  let continuation;
  const {ProjectCTA} = load('src/components/modules/cinematic/ProjectCTA.tsx', {
    './Cinematic.module.css':{},
    'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
    '@/hooks/useAuth':{useAuth:()=>({isAuthenticated:authenticated,isLoading:loading})},
    '@/lib/i18n/navigation':{useRouter:()=>({push:route=>visits.push(route)})},
    '@/store/authModalStore':{useAuthModalStore:select=>select({openAuthModal:(_phone,callback)=>{continuation=callback;}})},
  });
  ProjectCTA().props.onClick();
  assert.deepEqual(visits,[]);
  assert.equal(typeof continuation,'function');
  continuation();
  assert.deepEqual(visits,['/order/order-form']);
  authenticated=true;
  ProjectCTA().props.onClick();
  assert.deepEqual(visits,['/order/order-form','/order/order-form']);
  loading=true;
  assert.equal(ProjectCTA().props.disabled,true);
});
