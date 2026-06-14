import { routing } from '@/i18n/routing';
import { ProfilePageContent } from './_components/profile-page-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProfilePage() {
  return <ProfilePageContent locale={routing.defaultLocale} />;
}
