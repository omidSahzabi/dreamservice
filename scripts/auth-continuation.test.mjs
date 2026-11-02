import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};

function fixture(locale, {authenticated = false, verify, refresh, session = true, newUser = false} = {}) {
  const messages = JSON.parse(fs.readFileSync(`messages/${locale}.json`, 'utf8'));
  const {useAuthModalStore: store} = load('src/store/authModalStore.ts');
  const useStore = Object.assign((select = value => value) => select(store.getState()), {getState: store.getState});
  const visits = [], events = [], refs = [];
  let refIndex = 0, work, tree;
  const queryClient = {
    async invalidateQueries(_filter, options) {
      events.push('session refresh');
      assert.equal(options.throwOnError, true);
      await refresh?.();
    },
    getQueryData: () => session ? {id: 'synthetic-user'} : null,
  };
  const overrides = {
    react: {...React, useState: value => [value, () => {}], useMemo: fn => fn(),
      useRef: value => refs[refIndex++] ?? (refs[refIndex - 1] = {current: value}), useEffect: () => {}},
    'next-intl': {useLocale: () => locale, useTranslations: namespace => createTranslator({locale, messages, namespace})},
    '@tanstack/react-query': {useQueryClient: () => queryClient},
    'react-hook-form': {useWatch: () => '', useForm: () => ({
      reset() {}, register() { return {}; }, formState: {errors: {}},
      handleSubmit: handler => data => { work = handler(data); return work; },
    })},
    '@/hooks/useAuth': {useAuth: () => ({isAuthenticated: authenticated, isLoading: false})},
    '@/lib/i18n/navigation': {useRouter: () => ({
      push: route => { events.push('navigate'); visits.push(`/${locale}${route}`); },
      refresh: () => events.push('route refresh'),
    })},
    '@/store/authModalStore': {useAuthModalStore: useStore},
    '@/lib/auth/client-state': {clearSensitiveState: async () => { events.push('clear'); }},
    '@/lib/auth/authClient': {
      verifyOtp: async () => { await verify?.(); return {success: true, isNewUser: newUser}; },
      registerUser: async () => ({success: true}),
    },
    '@/components/modules/navbar/Logo': {default: () => null},
    './UsernameAvailability': {UsernameAvailability: () => null},
    './PreviewPasswordLogin': {PreviewPasswordLogin: () => null},
    './Cinematic.module.css': {default: {}},
    sonner: {toast: {success() {}, error: () => events.push('error')}},
  };
  const {ProjectCTA} = load('src/components/modules/cinematic/ProjectCTA.tsx', overrides);
  const {AuthModal} = load('src/components/modules/auth/AuthModal.tsx', overrides);
  const render = () => { refIndex = 0; tree = AuthModal({}); return tree; };
  const findForm = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'form') return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = findForm(child);
      if (found) return found;
    }
  };
  return {
    store, visits, events, render,
    click: () => ProjectCTA().props.onClick(),
    cancel: () => tree.props.onOpenChange(false),
    submit: data => { findForm(render()).props.onSubmit(data); return work; },
  };
}

for (const locale of ['en', 'fa']) {
  test(`authenticated CTA navigates directly in ${locale}`, () => {
    const f = fixture(locale, {authenticated: true});
    f.click();
    assert.deepEqual(f.visits, [`/${locale}/order/order-form`]);
    assert.equal(f.store.getState().isOpen, false);
  });

  test(`guest intent survives OTP steps and session refresh, completes once in ${locale}`, async () => {
    const gate = deferred();
    const f = fixture(locale, {refresh: () => gate.promise});
    f.click();
    assert.equal(f.store.getState().isOpen, true);
    f.store.getState().setStep('OTP');
    const pending = f.submit({code: '00000'});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.visits, []);
    gate.resolve();
    await pending;
    assert.deepEqual(f.visits, [`/${locale}/order/order-form`]);
    assert.deepEqual(f.events, ['clear', 'session refresh', 'navigate']);
    assert.equal(f.store.getState().isOpen, false);
    assert.equal(f.store.getState().onSuccessCallback, undefined);
  });

  test(`cancelled login clears intent; a late response cannot navigate in ${locale}`, async () => {
    const gate = deferred();
    const f = fixture(locale, {verify: () => gate.promise});
    f.click(); f.store.getState().setStep('OTP');
    const pending = f.submit({code: '00000'});
    f.cancel();
    f.store.getState().openAuthModal();
    gate.resolve(); await pending;
    assert.deepEqual(f.visits, []);
    assert.equal(f.store.getState().onSuccessCallback, undefined);
  });

  test(`failed login never navigates in ${locale}`, async () => {
    const f = fixture(locale, {verify: () => { throw new Error('Mock verification failure'); }});
    f.click(); f.store.getState().setStep('OTP');
    await f.submit({code: '00000'});
    assert.deepEqual(f.visits, []);
    assert.equal(f.store.getState().isOpen, true);
  });

  test(`cancellation during session refresh prevents continuation in ${locale}`, async () => {
    const gate = deferred();
    const f = fixture(locale, {refresh: () => gate.promise});
    f.click(); f.store.getState().setStep('OTP');
    const pending = f.submit({code: '00000'});
    await new Promise(resolve => setImmediate(resolve));
    f.cancel(); gate.resolve(); await pending;
    assert.deepEqual(f.visits, []);
  });

  test(`concurrent successful responses consume the continuation once in ${locale}`, async () => {
    const gate = deferred();
    const f = fixture(locale, {refresh: () => gate.promise});
    f.click(); f.store.getState().setStep('OTP');
    const first = f.submit({code: '00000'}), second = f.submit({code: '00000'});
    await new Promise(resolve => setImmediate(resolve));
    gate.resolve(); await Promise.all([first, second]);
    assert.deepEqual(f.visits, [`/${locale}/order/order-form`]);
  });

  for (const session of [false, true]) test(`unconfirmed or failed session refresh never navigates (${session}) in ${locale}`, async () => {
    const f = fixture(locale, {session, refresh: session ? () => { throw new Error('Mock session failure'); } : undefined});
    f.click(); f.store.getState().setStep('OTP');
    await f.submit({code: '00000'});
    assert.deepEqual(f.visits, []);
    assert.ok(f.events.includes('error'));
  });

  test(`registration retains the guest continuation in ${locale}`, async () => {
    const f = fixture(locale, {newUser: true});
    f.click(); f.store.getState().setStep('OTP');
    await f.submit({code: '00000'});
    assert.equal(f.store.getState().step, 'REGISTER');
    assert.deepEqual(f.visits, []);
    await f.submit({fname: 'Synthetic', lname: 'User'});
    assert.deepEqual(f.visits, [`/${locale}/order/order-form`]);
    assert.ok(!f.events.includes('route refresh'));
  });

  test(`ordinary login still refreshes its current route in ${locale}`, async () => {
    const f = fixture(locale);
    f.store.getState().openAuthModal(); f.store.getState().setStep('OTP');
    await f.submit({code: '00000'});
    assert.deepEqual(f.visits, []);
    assert.deepEqual(f.events, ['clear', 'session refresh', 'route refresh']);
  });
}
