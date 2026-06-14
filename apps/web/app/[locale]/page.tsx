import type { AppLocale } from '@/i18n/routing';
import { ProfilePageContent } from '../_components/profile-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LocalizedProfilePage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;

  return <ProfilePageContent locale={locale} />;
}
