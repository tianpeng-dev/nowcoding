import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Link } from '../../../i18n/navigation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserReadOnlyFromCookie,
  githubSignInHref,
} from '../../../lib/browser-session';
import CloudNav from '../../components/cloud-nav';

export const dynamic = 'force-dynamic';

// 测试边界保留文案锚点：Account settings
function accountValue(value: string | null | undefined): string {
  return value?.trim() || '';
}

export default async function AccountSettingsPage() {
  const t = await getTranslations('account');
  const cookieStore = await cookies();
  const currentUser = await getCurrentBrowserUserReadOnlyFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return (
      <main className="shell account-layout">
        <CloudNav active="account" note={t('settings')} signInReturnTo="/account/settings" />
        <header className="account-header">
          <p className="eyebrow">{t('account')}</p>
          <h1>{t('settings')}</h1>
          <p className="lead">{t('settingsSignInDescription')}</p>
          <a className="button primary" href={githubSignInHref('/account/settings')}>
            {t('signInWithGitHub')}
          </a>
        </header>
      </main>
    );
  }

  const displayName =
    currentUser.user.displayName ?? currentUser.user.username ?? currentUser.identity.githubLogin;

  return (
    <main className="shell account-layout">
      <CloudNav active="account" note={t('settings')} signInReturnTo="/account/settings" />

      <header className="account-header">
        <div>
          <p className="eyebrow">{t('account')}</p>
          <h1>{t('settings')}</h1>
          <p className="lead">{t('settingsDescription')}</p>
        </div>
        <form action="/api/auth/sign-out" method="post">
          <button className="danger-button" type="submit">
            {t('signOut')}
          </button>
        </form>
      </header>

      <section className="account-section" aria-labelledby="identity-heading">
        <div>
          <h2 id="identity-heading">{t('identity')}</h2>
          <p className="help">{t('identityDescription')}</p>
        </div>
        <dl className="account-facts">
          <div>
            <dt>{t('displayName')}</dt>
            <dd>{accountValue(displayName) || t('notSet')}</dd>
          </div>
          <div>
            <dt>{t('username')}</dt>
            <dd>{accountValue(currentUser.user.username) || t('notSet')}</dd>
          </div>
          <div>
            <dt>{t('githubLogin')}</dt>
            <dd>{accountValue(currentUser.user.githubLogin) || t('notSet')}</dd>
          </div>
          <div>
            <dt>{t('githubId')}</dt>
            <dd>{accountValue(currentUser.user.githubId) || t('notSet')}</dd>
          </div>
        </dl>
      </section>

      <section className="account-section" aria-labelledby="account-links-heading">
        <div>
          <h2 id="account-links-heading">{t('accountPages')}</h2>
          <p className="help">{t('accountPagesDescription')}</p>
        </div>
        <div className="account-actions">
          <Link className="button secondary" href="/onboarding">
            {t('onboarding')}
          </Link>
          <Link className="button secondary" href="/account/devices">
            {t('devices')}
          </Link>
        </div>
      </section>
    </main>
  );
}
