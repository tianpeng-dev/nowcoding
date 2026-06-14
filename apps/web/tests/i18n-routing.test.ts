import { resolve } from 'node:path';
import { getPageStaticInfo } from 'next/dist/build/analysis/get-page-static-info';
import { loadBindings } from 'next/dist/build/swc';
import { unstable_doesMiddlewareMatch } from 'next/dist/experimental/testing/server/middleware-testing-utils';
import type { PAGE_TYPES } from 'next/dist/lib/page-types';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../proxy';

vi.mock('next-intl/middleware', () => ({
  default: () => () => undefined,
}));

const matcher = config.matcher;
const i18nProxyMatcher = new RegExp(`^${matcher}$`);
const proxyFilePath = resolve(import.meta.dirname, '../proxy.ts');
const pagesPageType = 'pages' as PAGE_TYPES.PAGES;

const shouldNotMatchI18nProxy = [
  '/api/heatmap',
  '/_next/static/chunk.js',
  '/_vercel/insights',
  '/badge/live.svg',
  '/og/summary',
  '/card.svg',
  '/card',
  '/card/foo',
];

const shouldMatchI18nProxy = ['/usage', '/zh-CN/usage', '/setup'];

describe('i18n proxy 路由 matcher', () => {
  it('导出 Next 可静态提取的 matcher 字面量', async () => {
    expect(typeof matcher).toBe('string');

    await loadBindings();

    const staticInfo = await getPageStaticInfo({
      pageFilePath: proxyFilePath,
      nextConfig: {},
      isDev: true,
      page: '/proxy',
      pageType: pagesPageType,
    });

    expect(staticInfo.middleware?.matchers).toHaveLength(1);
    expect(staticInfo.middleware?.matchers?.[0]?.originalSource).toBe(matcher);
  });

  it.each(shouldNotMatchI18nProxy)('不匹配 %s', (pathname) => {
    expect(i18nProxyMatcher.test(pathname)).toBe(false);
  });

  it.each(shouldMatchI18nProxy)('匹配页面路径 %s', (pathname) => {
    expect(i18nProxyMatcher.test(pathname)).toBe(true);
  });

  it.each(shouldNotMatchI18nProxy)('Next matcher 不执行 proxy：%s', (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: pathname,
      }),
    ).toBe(false);
  });

  it.each(shouldMatchI18nProxy)('Next matcher 执行 proxy：%s', (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: pathname,
      }),
    ).toBe(true);
  });
});
