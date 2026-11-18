import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const matcherLiteral = proxySource.match(/matcher:\s*\[\s*(['"])([\s\S]*?)\1\s*,?\s*\]/)?.[2];

if (!matcherLiteral) {
  throw new Error('proxy.ts 必须声明单一的 matcher 字符串');
}

const matcher = JSON.parse(`"${matcherLiteral.replaceAll('"', '\\"')}"`);
const matcherPattern = new RegExp(`^${matcher}$`);
const matchesCloudProxy = (pathname) => matcherPattern.test(pathname);

test('cloud proxy excludes API and auth-sensitive routes', () => {
  for (const pathname of [
    '/api/cloud/usage/ingest',
    '/api/auth/github/start',
    '/login/device/status',
    '/u/peng/card.svg',
  ]) {
    expect(matchesCloudProxy(pathname), `${pathname} 不应进入 i18n proxy`).toBe(false);
  }
});

test('cloud proxy excludes static file paths', () => {
  for (const pathname of ['/favicon.ico', '/robots.txt', '/images/logo.svg', '/docs/readme.md']) {
    expect(matchesCloudProxy(pathname), `${pathname} 不应进入 i18n proxy`).toBe(false);
  }
});

test('cloud proxy still matches localized page routes', () => {
  for (const pathname of [
    '/',
    '/zh-CN',
    '/now',
    '/zh-CN/now',
    '/account/devices',
    '/login/device',
    '/u/peng',
  ]) {
    expect(matchesCloudProxy(pathname), `${pathname} 应进入 i18n proxy`).toBe(true);
  }
});
