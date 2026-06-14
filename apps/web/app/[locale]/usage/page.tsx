import type { AppLocale } from '@/i18n/routing';
import { UsagePageContent } from '../../_components/usage-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LocalizedUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const { locale } = await params;

  return <UsagePageContent locale={locale} searchParams={searchParams} />;
}
