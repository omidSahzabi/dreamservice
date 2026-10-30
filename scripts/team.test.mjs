import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'use-intl/core';
import {load} from './test-loader.mjs';

const {publicTeamImageUrl} = load('src/lib/team/image-url.ts');

test('team images accept public asset paths and existing HTTP/HTTPS sources', () => {
  for (const url of ['/images/team/default-avatar.svg', '/images/team/member-2.png', 'https://images.example.test/avatar.png', 'http://images.example.test/avatar.png', 'https://images.example.test/avatar%20name.png']) {
    assert.equal(publicTeamImageUrl(url), url);
  }
});

test('team images reject schemes, credentials, malformed URLs and paths escaping public images', () => {
  for (const url of ['', 'javascript:alert(1)', 'data:image/svg+xml,unsafe', '//example.test/a.svg', 'https://', 'https://user:password@example.test/a.png', 'https://example.test/%ZZ.svg', 'https://example.test/%00.svg', 'https://example.test/%5cavatar.svg', '/other/avatar.svg', '/images/', '/images//a.svg', '/images/../private.svg', '/images/%2e%2e/private.svg', '/images/%252e%252e/private.svg', '/images/%2fexample.test/a.svg', '/images/%5cprivate.svg', '/images/a.svg?redirect=other', '/images/a.svg#fragment', '/images/%00.svg', '/images/%ZZ.svg', '/images/a\\b.svg', ' https://example.test/a.svg', 'https://example.test/\na.svg']) {
    assert.equal(publicTeamImageUrl(url), null, url);
  }
});

test('published team links follow profile IDs while the response excludes private identifiers and roles', async () => {
  const previous = process.env.PUBLIC_TEAM_PROFILE_IDS;
  process.env.PUBLIC_TEAM_PROFILE_IDS = '1,2,3,9';
  try {
    const profiles = [1,2,3,9].map(pr_id => ({pr_id, user_id: 'private-user-' + pr_id}));
    const prisma = {
      personProfile: {findMany: async () => profiles},
      user: {findMany: async () => profiles.map(p => ({id: p.user_id, fname: 'Member', lname: String(p.pr_id)}))},
      image: {findMany: async () => profiles.map(p => ({ownerId: p.user_id, url: '/images/team/default-avatar.svg', altText: null}))},
    };
    const {GET} = load('src/app/api/team/route.ts', {'@/lib/prisma': {prisma}});
    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.map(member => member.websiteUrl), ['https://omid.dreamservice.net', 'https://hossein.dreamservice.net', 'https://daniel.dreamservice.net', null]);
    for (const member of body) {
      assert.deepEqual(Object.keys(member).sort(), ['image', 'user', 'websiteUrl']);
      assert.deepEqual(Object.keys(member.user).sort(), ['fname', 'lname']);
      assert.equal(member.image.url, '/images/team/default-avatar.svg');
    }
    assert.ok(!JSON.stringify(body).includes('private-user-'));
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_TEAM_PROFILE_IDS;
    else process.env.PUBLIC_TEAM_PROFILE_IDS = previous;
  }
});

for (const locale of ['en', 'fa']) test('whole team card is a localized semantic external link in ' + locale, () => {
  const messages = JSON.parse(fs.readFileSync('messages/' + locale + '.json', 'utf8'));
  const {TeamCard} = load('src/components/templates/about/TeamCard.tsx', {
    'next-intl': {useTranslations: namespace => createTranslator({locale, messages, namespace})},
  });
  const html = renderToStaticMarkup(React.createElement(TeamCard, {index: 0, member: {user: {fname: 'Member'}, websiteUrl: 'https://omid.dreamservice.net'}}));
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.ok(html.includes('href="https://omid.dreamservice.net"'));
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('focus-visible:outline-primary'));
  assert.ok(html.includes('/images/team/default-avatar.svg'));
  assert.ok(html.includes(messages.About.Team.viewWebsite));
  assert.ok(!/<(?:button|input|select|textarea)\b/.test(html));
});
