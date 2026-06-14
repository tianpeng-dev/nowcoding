import { routing } from '@/i18n/routing';
import { SetupPageContent } from '../_components/setup-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SetupPage() {
  return <SetupPageContent locale={routing.defaultLocale} />;
}
