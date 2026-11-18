import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { REQUEST_LOCALE_HEADER, resolveAppLocale } from '../i18n/routing';
import './globals.css';

async function getRootLocale() {
  const requestHeaders = await headers();

  return resolveAppLocale(requestHeaders.get(REQUEST_LOCALE_HEADER));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRootLocale();
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRootLocale();

  return (
    <html data-theme="light" lang={locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
