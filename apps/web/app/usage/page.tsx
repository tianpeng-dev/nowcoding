import { routing } from '@/i18n/routing';
import { UsagePageContent } from '../_components/usage-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsagePage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  return <UsagePageContent locale={routing.defaultLocale} searchParams={searchParams} />;
}
