import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';
import { REQUEST_LOCALE_HEADER, resolveAppLocale } from '../i18n/routing';
import proxy from '../proxy';

const middlewareLocaleHeader = `x-middleware-request-${REQUEST_LOCALE_HEADER}`;

describe('cloud locale request contract', () => {
  test('resolves supported locales and falls back to English', () => {
    expect(resolveAppLocale('zh-CN')).toBe('zh-CN');
    expect(resolveAppLocale('en')).toBe('en');
    expect(resolveAppLocale('fr')).toBe('en');
    expect(resolveAppLocale(null)).toBe('en');
  });

  test('rewrites the unprefixed homepage with an English locale header', () => {
    const response = proxy(new NextRequest('https://nowcoding.cc/'));

    expect(response.headers.get('x-middleware-rewrite')).toBe('https://nowcoding.cc/en');
    expect(response.headers.get(middlewareLocaleHeader)).toBe('en');
  });

  test('passes the Chinese locale to the root layout', () => {
    const response = proxy(
      new NextRequest('https://nowcoding.cc/zh-CN', {
        headers: { [REQUEST_LOCALE_HEADER]: 'en' },
      }),
    );

    expect(response.headers.get(middlewareLocaleHeader)).toBe('zh-CN');
  });
});
