import { hasLocale } from 'next-intl';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh-CN'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];

export const REQUEST_LOCALE_HEADER = 'x-nowcoding-locale';

export function resolveAppLocale(locale: string | null | undefined): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
