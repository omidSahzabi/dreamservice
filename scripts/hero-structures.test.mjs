import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {motionValue} from 'framer-motion';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const css=fs.readFileSync('src/components/modules/hero/IsometricDigitalStructure.module.css','utf8');
const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z]+)/g)].map(match=>[match[1],match[1]]));
const overrides={'./IsometricDigitalStructure.module.css':classes};

test('both structures are original decorative vector compositions with independent paint servers',()=>{
  const {IsometricDigitalStructure}=load('src/components/modules/hero/IsometricDigitalStructure.tsx',overrides);
  const progress=motionValue(0);
  const render=variation=>React.createElement(IsometricDigitalStructure,{progress,variation});
  const html=renderToStaticMarkup(React.createElement(React.Fragment,null,render('spire'),render('terrace')));
  assert.equal((html.match(/aria-hidden="true"/g)??[]).length,2);
  assert.equal((html.match(/focusable="false"/g)??[]).length,2);
  assert.equal((html.match(/data-structure-layer="floating"/g)??[]).length,6);
  assert.equal((html.match(/data-structure-fragment=""/g)??[]).length,8);
  assert.ok(html.includes('data-digital-structure="spire"')&&html.includes('data-digital-structure="terrace"'));
  const ids=[...html.matchAll(/(?:linearGradient|filter) id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
  for(const reference of html.matchAll(/url\(#([^\)]+)\)/g))assert.ok(ids.includes(reference[1]));
  assert.ok(!/<(?:image|foreignObject|a|button)\b/.test(html));
  const paths=variation=>[...renderToStaticMarkup(render(variation)).matchAll(/ d="([^"]+)"/g)].map(match=>match[1]);
  assert.notDeepEqual(paths('spire'),paths('terrace'));
});

for(const locale of ['en','fa'])test('cinematic hero retains approved localized copy and the existing official brand in '+locale,async()=>{
  const messages=JSON.parse(fs.readFileSync('messages/'+locale+'.json','utf8'));
  const Hero=load('src/components/templates/Hero.tsx',{
    ...overrides,
    '@/components/modules/cinematic/Cinematic.module.css':new Proxy({}, {get:(_,key)=>key}),
    'next-intl/server':{getTranslations:async namespace=>createTranslator({locale,messages,namespace})},
    '@/components/modules/cinematic/IndustryCounters':{IndustryCounters:()=>React.createElement('div',{'data-counters':''})},
    '@/components/modules/cinematic/CinematicStory':{CinematicStory:()=>React.createElement('div',{'data-story':''})},
    '@/components/modules/cinematic/ProjectCTA':{ProjectCTA:()=>React.createElement('button',null,messages.Cinematic.startProject)},
  }).default;
  const html=renderToStaticMarkup(await Hero());
  assert.equal((html.match(/<h1\b/g)??[]).length,1);
  assert.ok(html.includes(messages.Cinematic.hero1)&&html.includes(messages.Cinematic.hero2));
  assert.ok(html.includes(messages.Cinematic.heroDesc));
  assert.ok(html.includes('href="#cinematic-story"')&&html.includes('href="#cinematic-end"'));
  assert.ok(html.includes('data-counters')&&html.includes('data-story'));
  assert.ok(html.includes(messages.Cinematic.startProject));
  assert.ok(html.includes('viewBox="0 0 32 32"'));
  assert.ok(!html.includes('<iframe'));
});
