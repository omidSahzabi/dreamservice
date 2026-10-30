import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

for (const locale of ['en', 'fa']) {
  const messages = JSON.parse(fs.readFileSync('messages/' + locale + '.json', 'utf8'));
  const translations = {'next-intl/server': {getTranslations: async ({namespace}) => createTranslator({locale, messages, namespace})}};
  test('public metadata has localized identity and canonical alternates in ' + locale, async () => {
    const {pageMetadata} = load('src/lib/i18n/metadata.ts', translations);
    for (const [page, path] of [['home', ''], ['about', '/about']]) {
      const metadata = await pageMetadata(Promise.resolve({locale}), page, path);
      assert.equal(metadata.title, messages.Metadata.pages[page].title);
      assert.equal(metadata.description, messages.Metadata.pages[page].description);
      assert.equal(String(metadata.alternates.canonical), 'https://dreamservice.net/' + locale + path);
      assert.equal(metadata.alternates.languages['x-default'], 'https://dreamservice.net/en' + path);
      assert.equal(metadata.alternates.languages.fa, 'https://dreamservice.net/fa' + path);
      assert.equal(metadata.robots.index, true);
      assert.equal(metadata.twitter.card, 'summary_large_image');
      assert.equal(metadata.openGraph.images[0].url, 'https://dreamservice.net/opengraph-image');
    }
  });
  test('authenticated page metadata is excluded from indexing in ' + locale, async () => {
    const {pageMetadata} = load('src/lib/i18n/metadata.ts', translations);
    for (const page of ['order', 'orderForm', 'reviewOrders', 'adminUsers', 'adminProjects', 'support', 'adminTickets']) {
      const metadata = await pageMetadata(Promise.resolve({locale}), page, '/private');
      assert.deepEqual(metadata.robots, {index: false, follow: false});
      assert.equal(metadata.alternates, undefined);
    }
  });
}

test('sitemap lists only the four public localized pages without fabricated timestamps', () => {
  const sitemap = load('src/app/sitemap.ts').default();
  assert.deepEqual(sitemap.map(entry => entry.url).sort(), ['https://dreamservice.net/en', 'https://dreamservice.net/en/about', 'https://dreamservice.net/fa', 'https://dreamservice.net/fa/about']);
  for (const entry of sitemap) {
    assert.equal(entry.lastModified, undefined);
    assert.ok(entry.alternates.languages.en);
    assert.ok(entry.alternates.languages.fa);
  }
});

test('robots allows crawlers to read noindex headers and does not block rendering assets', () => {
  const robots = load('src/app/robots.ts').default();
  assert.equal(robots.sitemap, 'https://dreamservice.net/sitemap.xml');
  assert.equal(robots.rules.allow, '/');
  assert.equal(robots.rules.disallow, undefined);
});

test('both Next middleware declarations bypass the actual social-image endpoint', () => {
  const root = load('middleware.ts').config;
  assert.deepEqual(load('src/middleware.ts').config, root);
  const matcher = new RegExp('^' + root.matcher[0] + '$');
  assert.equal(matcher.test('/opengraph-image'), false);
  assert.equal(matcher.test('/en/about'), true);
});

test('unpublished team returns empty without any database access', async () => {
  const previous = process.env.PUBLIC_TEAM_PROFILE_IDS;
  delete process.env.PUBLIC_TEAM_PROFILE_IDS;
  try {
    const {getPublishedTeam} = load('src/lib/team/service.ts', {'@/lib/prisma': {prisma: new Proxy({}, {get() {throw Error('Unexpected query')}})}});
    assert.deepEqual(await getPublishedTeam(), []);
  } finally {
    if (previous !== undefined) process.env.PUBLIC_TEAM_PROFILE_IDS = previous;
  }
});

for (const mode of ['members', 'empty', 'failure']) test('About server loading preserves the ' + mode + ' state', async () => {
  const team = mode === 'members' ? [{user: {fname: 'Published'}, image: null, websiteUrl: null}] : [];
  let dynamicRequests = 0, failures = 0;
  const Team = () => null;
  const About = load('src/app/[locale]/about/page.tsx', {
    'next/server': {connection: async () => {dynamicRequests++}},
    'next/navigation': {unstable_rethrow: () => {}},
    '@/lib/team/service': {getPublishedTeam: async () => {if (mode === 'failure') throw Error('private diagnostic'); return team}},
    '@/lib/security/http': {securityEvent: event => {assert.equal(event, 'operation_failed'); failures++}},
    '@/components/templates/about/TeamSection': Team,
    '@/components/templates/about/AboutHero': () => null,
    '@/components/templates/about/AboutValues': () => null,
  }).default;
  const page = await About();
  const section = page.props.children.find(child => child.type === Team);
  assert.equal(dynamicRequests, 1);
  assert.equal(failures, mode === 'failure' ? 1 : 0);
  assert.deepEqual(section.props.initialTeam, mode === 'failure' ? undefined : team);
});
