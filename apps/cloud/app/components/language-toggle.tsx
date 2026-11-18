'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '../../i18n/navigation';
import type { AppLocale } from '../../i18n/routing';

const NEXT_LOCALE: Record<AppLocale, AppLocale> = {
  en: 'zh-CN',
  'zh-CN': 'en',
};

export default function LanguageToggle() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('common');
  const targetLocale = NEXT_LOCALE[locale] ?? 'zh-CN';
  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;
  const label = targetLocale === 'zh-CN' ? t('switchToChinese') : t('switchToEnglish');

  return (
    <button
      aria-label={label}
      className="btn btn-outline nc-language"
      onClick={() => router.replace(href, { locale: targetLocale })}
      type="button"
    >
      {targetLocale === 'zh-CN' ? '中文' : 'EN'}
    </button>
  );
}
