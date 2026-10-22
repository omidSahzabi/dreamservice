import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import sharp from 'sharp';
import {load} from './test-loader.mjs';

const root = new URL('../',import.meta.url);
const read = file => fs.readFileSync(new URL(file,root),'utf8');
const css = read('src/styles/globals.css');
const geometry = JSON.parse(read('src/components/brand/geometry.json'));
const luminance = hex => {
  const linear = hex.match(/[a-f\d]{2}/gi).map(channel=>{
    const value = parseInt(channel,16)/255;
    return value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4;
  });
  return linear[0]*0.2126 + linear[1]*0.7152 + linear[2]*0.0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);

for(const theme of [':root','.dark'])test(theme+' text, controls and focus indicators meet their contrast targets',()=>{
  const block = css.slice(css.indexOf(theme+' {')).split('}')[0];
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})/gi)].map(match=>[match[1],match[2]]));
  for(const background of ['background','card','popover','secondary']) {
    for(const foreground of ['foreground','text-secondary','text-muted','primary','destructive','success','warning']) {
      assert.ok(contrast(tokens[foreground],tokens[background])>=4.5,`${theme}: ${foreground} on ${background}`);
    }
    assert.ok(contrast(tokens.primary,tokens[background])>=3,`${theme}: focus indicator`);
  }
  assert.ok(contrast(tokens.input,tokens.card)>=3,`${theme}: input boundary`);
  for(const control of ['primary','primary-hover','destructive']) {
    const foreground = control==='destructive'?'destructive-foreground':'primary-foreground';
    assert.ok(contrast(tokens[foreground],tokens[control])>=4.5,`${theme}: ${control} button`);
  }
});

test('favicon and app icons use the same editable geometry and valid image dimensions',async()=>{
  for(const file of ['public/images/dreamservice-mark.svg','src/app/icon.svg']) {
    const svg = read(file);
    for(const shape of Object.values(geometry).slice(1))assert.ok(svg.includes(shape));
    assert.ok(!svg.includes('<image')&&!svg.includes('<script'));
  }
  for(const [file,size]of [['src/app/apple-icon.png',180],['public/icons/icon-192.png',192],['public/icons/icon-512.png',512]]) {
    const metadata=await sharp(fileURLToPath(new URL(file,root))).metadata();
    assert.equal(metadata.width,size);assert.equal(metadata.height,size);
  }
  const ico=fs.readFileSync(new URL('src/app/favicon.ico',root));
  assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  assert.deepEqual([0,1,2].map(index=>ico[6+16*index]),[16,32,48]);
});

for(const locale of ['en','fa'])test('brand links have one localized name and independent masks in '+locale,()=>{
  const messages=JSON.parse(read('messages/'+locale+'.json'));
  const {default:Logo}=load('src/components/modules/navbar/Logo.tsx',{
    './geometry.json':geometry,
    'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
    'next/image':props=>React.createElement('img',{...props,priority:undefined}),
    '@/lib/i18n/navigation':{Link:({href,...props})=>React.createElement('a',{...props,href:'/'+locale+href})},
  });
  const html=renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(Logo),React.createElement(Logo)));
  assert.ok(html.includes('href="/'+locale+'/"'));
  assert.ok(html.includes('aria-label="'+messages.Navbar.logoAlt+'"'));
  const ids=[...html.matchAll(/<mask id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
  assert.ok(!html.includes('rotate-180'));
});

for(const initiallyReduced of [true,false])test('carousel autoplay respects reduced motion '+(initiallyReduced?'at startup':'before a scheduled slide'),t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  let reduced=initiallyReduced,callback,slides=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:reduced})}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
  t.mock.method(globalThis,'setTimeout',fn=>{callback=fn;return 1;});
  t.mock.method(globalThis,'clearTimeout',()=>{});
  const {useRandomAutoplay}=load('src/hooks/useRandomAutoplay.ts',{
    react:{useRef:()=>({current:null}),useEffect:fn=>{fn();}},
  });
  const reset=useRandomAutoplay({slideNext(){slides++;}});
  if(initiallyReduced)assert.equal(callback,undefined);
  else {assert.equal(typeof callback,'function');reduced=true;callback();}
  reset();assert.equal(slides,0);
});
