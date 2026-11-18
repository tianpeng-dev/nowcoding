import { redirect } from '../../../i18n/navigation';
import type { AppLocale } from '../../../i18n/routing';

type LocaleNowRedirectPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function LocaleNowRedirectPage({ params }: LocaleNowRedirectPageProps) {
  const { locale } = await params;

  redirect({ href: '/', locale });
}
