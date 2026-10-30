import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const messages=Object.fromEntries(['en','fa'].map(locale=>[locale,JSON.parse(fs.readFileSync('messages/'+locale+'.json','utf8'))]));
const geometry=JSON.parse(fs.readFileSync('src/components/brand/geometry.json','utf8'));
const source='src/components/illustrations/StateIllustration.tsx';
const render=element=>renderToStaticMarkup(element);
const props={error:new Error('PRIVATE_MESSAGE_SENTINEL'),reset(){}};
const keys=value=>Object.entries(value).flatMap(([key,item])=>typeof item==='object'?keys(item).map(child=>key+'.'+child):key).sort();

test('illustration variants are distinct, decorative, theme-aware vectors',()=>{
  const {StateIllustration}=load(source);
  const shapes=[];
  for(const kind of ['not-found','disconnected','empty-orders']){
    const html=render(React.createElement(StateIllustration,{kind}));
    assert.ok(html.includes('aria-hidden="true"')&&html.includes('focusable="false"'));
    assert.ok(html.includes('viewBox="0 0 440 320"')&&html.includes('fill-card'));
    assert.ok(!/<(?:image|script|foreignObject|button)\b/.test(html));
    shapes.push([...html.matchAll(/ d="([^"]+)"/g)].map(match=>match[1]).join('|'));
  }
  assert.equal(new Set(shapes).size,3);
});

test('recovery messages have locale parity',()=>{
  assert.deepEqual(keys(messages.en.Recovery),keys(messages.fa.Recovery));
  for(const locale of ['en','fa']){
    const t=createTranslator({locale,messages:messages[locale],namespace:'Recovery'});
    for(const key of keys(messages[locale].Recovery)){
      assert.ok(t(key).length>0);
      if(locale==='fa')assert.match(t(key),/[\u0600-\u06ff]/);
    }
  }
});

for(const locale of ['en','fa']){
  const intl={useTranslations:namespace=>createTranslator({locale,messages:messages[locale],namespace})};
  const overrides={
    'next-intl':intl,
    '@/lib/i18n/navigation':{Link:({href,...p})=>React.createElement('a',{...p,href:'/'+locale+href})},
  };
  test('404 has a localized illustration, heading and home link in '+locale,async()=>{
    const Page=load('src/app/[locale]/not-found.tsx',{
      ...overrides,'next-intl/server':{getTranslations:async namespace=>intl.useTranslations(namespace)},
    }).default;
    const html=render(await Page());
    assert.ok(html.includes(messages[locale].Recovery.notFound.title));
    assert.ok(html.includes('data-state-illustration="not-found"')&&html.includes('href="/'+locale+'/"'));
    assert.ok(html.includes('aria-labelledby="recovery-title"')&&html.includes('content="noindex"'));
    assert.ok(!html.includes('PRIVATE_MESSAGE_SENTINEL'));
  });
  test('error retry uses the Next refresh/reset callback with a reset fallback in '+locale,()=>{
    let resets=0,retries=0;const handlers=[];
    const Page=load('src/app/[locale]/error.tsx',{
      ...overrides,'@/components/ui/button':{Button:({onClick,children})=>{if(onClick)handlers.push(onClick);return React.createElement('button',{onClick},children);}},
    }).default;
    const html=render(React.createElement(Page,{...props,reset(){resets++;},unstable_retry(){retries++;}}));
    assert.ok(html.includes(render(messages[locale].Recovery.error.title))&&html.includes('data-state-illustration="disconnected"'));
    assert.ok(html.includes('href="/'+locale+'/"'));assert.ok(!html.includes('PRIVATE_MESSAGE_SENTINEL'));
    handlers.pop()();assert.equal(retries,1);assert.equal(resets,0);
    render(React.createElement(Page,{...props,reset(){resets++;}}));handlers.pop()();assert.equal(resets,1);
  });
  test('global error supplies its own localized document without an intl provider in '+locale,()=>{
    const Global=load('src/app/global-error.tsx',{
      react:{...React,useSyncExternalStore:()=>locale},
      '../../messages/en.json':messages.en,'../../messages/fa.json':messages.fa,
      './geometry.json':geometry,'@/styles/globals.css':{},
      'next/image':p=>React.createElement('img',p),
    }).default;
    const html=render(React.createElement(Global,props));
    assert.ok(html.includes('<html lang="'+locale+'" dir="'+(locale==='fa'?'rtl':'ltr')+'"'));
    assert.ok(html.includes('<body>')&&html.includes(render(messages[locale].Recovery.error.title)));
    assert.ok(html.includes('href="/'+locale+'"'));assert.ok(!html.includes('PRIVATE_MESSAGE_SENTINEL'));
  });
  test('customer empty state has an illustrated localized CTA in '+locale,()=>{
    const {CustomerOrdersEmpty}=load('src/features/order/workflow/CustomerOrdersEmpty.tsx',overrides);
    const html=render(React.createElement(CustomerOrdersEmpty));
    assert.ok(html.includes('data-state-illustration="empty-orders"'));
    assert.ok(html.includes(messages[locale].CustomerPanel.emptyDescription));
    assert.ok(html.includes('href="/'+locale+'/order/order-form"')&&html.includes('aria-labelledby="empty-orders-title"'));
  });
}

test('boundary logging records only a fixed event and category, without exception data',t=>{
  const entries=[];t.mock.method(console,'error',value=>entries.push(JSON.parse(value)));
  const {useErrorReport}=load('src/components/modules/recovery/use-error-report.ts',{react:{useEffect:fn=>fn()}});
  useErrorReport({message:'PRIVATE_MESSAGE_SENTINEL',stack:'PRIVATE_STACK',digest:'PRIVATE_DIGEST'},'global');
  assert.deepEqual(entries,[{event:'render_failed',category:'application_error',boundary:'global'}]);
});

test('wordmark contains the complete brand name within a padded SVG canvas',()=>{
  const svg=fs.readFileSync('public/images/dreamservice-wordmark.svg','utf8');
  assert.ok(svg.includes('>DreamService</text>'));
  const width=Number(svg.match(/viewBox="0 0 ([\d.]+)/)[1]);
  const start=Number(svg.match(/<text x="([\d.]+)/)[1]);
  const length=Number(svg.match(/textLength="([\d.]+)/)[1]);
  assert.ok(start>0&&start+length<width);
});
