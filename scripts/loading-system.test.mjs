import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const state=load('src/components/brand/loader-state.ts');
test('arrow launches exactly once for an observed successful completion',()=>{
  let current=state.initialLoaderState(false,true);
  assert.equal(current.phase,'complete');
  current=state.updateLoaderState(current,true,false);assert.equal(current.phase,'loading');
  current=state.updateLoaderState(current,false,true);assert.equal(current.phase,'completing');
  const completing=current;
  assert.equal(state.updateLoaderState(current,false,true),completing);
  current=state.finishLoaderState(current,current.cycle);assert.equal(current.phase,'complete');
  assert.equal(state.updateLoaderState(current,false,true),current);
  assert.equal(state.finishLoaderState(current,current.cycle),current);
});
test('failure, cancellation and success without observed loading never launch',()=>{
  for(const success of [false,true])assert.equal(state.initialLoaderState(false,success).phase,'complete');
  let current=state.initialLoaderState(true,false);
  current=state.updateLoaderState(current,false,false);assert.equal(current.phase,'complete');
  current=state.updateLoaderState(current,false,true);assert.equal(current.phase,'complete');
});
test('rapid restart invalidates old animation-end events and allows one new release',()=>{
  let current=state.initialLoaderState(true,false);
  current=state.updateLoaderState(current,false,true);const previousCycle=current.cycle;
  current=state.updateLoaderState(current,true,true);assert.equal(current.phase,'loading');
  assert.equal(state.finishLoaderState(current,previousCycle),current);
  current=state.updateLoaderState(current,false,true);assert.equal(current.phase,'completing');
  assert.equal(state.finishLoaderState(current,previousCycle),current);
  assert.equal(state.finishLoaderState(current,current.cycle).phase,'complete');
});

for(const locale of ['en','fa']){
  const messages=JSON.parse(fs.readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'));
  const overrides={'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace,onError:error=>{throw error;}})}};
  const render=(file,name,props)=>renderToStaticMarkup(React.createElement(load(file,overrides)[name],props));
  test('brand loader keeps original geometry and accessible status in '+locale,()=>{
    const geometry=JSON.parse(fs.readFileSync(new URL('../src/components/brand/geometry.json',import.meta.url),'utf8'));
    const html=render('src/components/brand/DreamServiceLoader.tsx','DreamServiceLoader',{loading:true});
    assert.ok(html.includes('role="status"')&&html.includes(messages.Common.loading));
    assert.ok(html.includes('dir="ltr"')&&html.includes('data-state="loading"')&&html.includes('focusable="false"'));
    for(const shape of [geometry.arch,geometry.needle,geometry.clearance])assert.ok(html.includes(shape));
    const idle=render('src/components/brand/DreamServiceLoader.tsx','DreamServiceLoader',{loading:false,success:true});
    assert.ok(idle.includes('data-state="complete"'));assert.ok(!idle.includes('role="status"'));
    const decorative=render('src/components/brand/DreamServiceLoader.tsx','DreamServiceLoader',{loading:true,decorative:true});
    assert.ok(!decorative.includes('role="status"')&&!decorative.includes('sr-only'));
  });
  test('skeleton layouts announce once and hide decorative shapes in '+locale,()=>{
    for(const layout of ['cards','details','form','page']){
      const html=render('src/components/ui/content-skeleton.tsx','ContentSkeleton',{layout});
      assert.equal((html.match(/role="status"/g)??[]).length,1);
      assert.ok(html.includes('aria-label="'+messages.Common.loading+'"')&&html.includes('aria-busy="true"'));
      assert.ok(html.includes('aria-hidden="true"')&&html.includes('data-slot="skeleton"'));
      assert.ok(!html.includes('<input')&&!html.includes('<button'));
    }
  });
  test('pending buttons preserve disabled state and show a localized compact loader in '+locale,()=>{
    const html=render('src/components/ui/button.tsx','Button',{pending:true,pendingLabel:messages.Common.loading,children:'Fixture action'});
    assert.ok(html.includes('disabled=""')&&html.includes('aria-busy="true"'));
    assert.ok(html.includes(messages.Common.loading)&&!html.includes('Fixture action'));
    assert.ok(html.includes('data-slot="dream-loader"')&&!html.includes('role="status"'));
    const idle=render('src/components/ui/button.tsx','Button',{pending:false,disabled:true,children:'Fixture action'});
    assert.ok(idle.includes('disabled=""')&&idle.includes('Fixture action'));
    const link=render('src/components/ui/button.tsx','Button',{asChild:true,children:React.createElement('a',{href:'/'+locale+'/order'},'Fixture link')});
    assert.ok(link.includes('href="/'+locale+'/order"')&&link.includes('Fixture link'));
  });
  test('initial table shell has one localized status and noninteractive placeholder rows in '+locale,()=>{
    const html=render('src/components/modules/data-table/data-table-loading.tsx','DataTableLoading',{columns:4});
    assert.equal((html.match(/role="status"/g)??[]).length,1);
    assert.ok(html.includes(messages.DataTable.loading));assert.match(html,/<tbody\b/);
    assert.ok(html.includes('aria-hidden="true"')&&html.includes('h-12'));
    assert.ok(!html.includes('<button')&&!html.includes('<input'));
  });
}
test('motion is restrained, reduced-motion completion dismisses without travel, and no timers gate content',()=>{
  const css=fs.readFileSync(new URL('../src/styles/globals.css',import.meta.url),'utf8');
  assert.match(css,/prefers-reduced-motion: reduce/);
  assert.match(css,/\.ds-loader\[data-state="completing"\] \.ds-loader-arrow \{ animation: ds-loader-dismiss \.01ms both/);
  assert.match(css,/\.ds-loader\[data-state="loading"\] :is\(\.ds-loader-arrow, \.ds-loader-string, \.ds-loader-bow\) \{ animation: none/);
  const loader=fs.readFileSync(new URL('../src/components/brand/DreamServiceLoader.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(loader,/setTimeout|setInterval|useEffect|matchMedia/);
});
