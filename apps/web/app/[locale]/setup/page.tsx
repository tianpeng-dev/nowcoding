import type { AppLocale } from '@/i18n/routing';
import { SetupPageContent } from '../../_components/setup-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LocalizedSetupPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;

  return <SetupPageContent locale={locale} />;
}
