import { type NextRequest, NextResponse } from 'next/server';
import { REQUEST_LOCALE_HEADER, resolveAppLocale, routing } from './i18n/routing';

const DEFAULT_LOCALIZED_PAGE_PATTERN =
  /^\/(?:$|now\/?$|leaderboard\/?$|onboarding\/?$|usage\/?$|admin\/?$|account\/(?:settings|devices)\/?$|u\/[^/]+\/?$|login\/device\/?$)/;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1];
  const locale = resolveAppLocale(firstSegment);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_LOCALE_HEADER, locale);
  const responseInit = { request: { headers: requestHeaders } };

  if (locale === routing.defaultLocale && firstSegment !== locale) {
    if (DEFAULT_LOCALIZED_PAGE_PATTERN.test(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${routing.defaultLocale}${pathname === '/' ? '' : pathname}`;

      // 默认英文地址保持无前缀，对应页面内部改写到 [locale] 包装路由以获得 next-intl 上下文。
      return NextResponse.rewrite(url, responseInit);
    }

    return NextResponse.next(responseInit);
  }

  return NextResponse.next(responseInit);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|login/device/status|u/[^/]+/card\\.svg|.*\\..*).*)'],
};
