import type { AppLocale } from '@/i18n/routing';
import { ModelsPageContent } from '../../_components/models-page-content';

export default async function LocalizedModelsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;

  return <ModelsPageContent locale={locale} />;
}
