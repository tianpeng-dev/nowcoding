import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Link } from '../../i18n/navigation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserReadOnlyFromCookie,
  githubSignInHref,
} from '../../lib/browser-session';
import LanguageToggle from './language-toggle';
import ThemeToggle from './theme-toggle';

type CloudNavProps = {
  active?: 'account' | 'arena' | 'home';
  note?: string;
  signInReturnTo?: string;
};

export default async function CloudNav({ active, note, signInReturnTo = '/' }: CloudNavProps) {
  const [cookieStore, t] = await Promise.all([cookies(), getTranslations('nav')]);
  const currentUser = await getCurrentBrowserUserReadOnlyFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );
  const accountLabel =
    currentUser?.user.username ??
    currentUser?.user.githubLogin ??
    currentUser?.identity.githubLogin;
  const brandNote = note ?? t('brandNote');

  return (
    <nav className="nav nc-nav" aria-label={t('primaryNavigation')}>
      <Link className="brand nc-brand" href="/">
        <span className="brand-mark nc-mark">N</span>
        <span>
          <span className="brand-name">NowCoding Cloud</span>
          <span className="brand-note">{brandNote}</span>
        </span>
      </Link>
      <div className="nav-links nc-links">
        <Link className={`nc-link ${active === 'home' ? 'on' : ''}`} href="/">
          {t('home')}
        </Link>
        <Link className={`nc-link ${active === 'arena' ? 'on' : ''}`} href="/leaderboard">
          {t('leaderboard')}
        </Link>
      </div>
      <div className="nc-actions">
        <LanguageToggle />
        <ThemeToggle />
        {currentUser ? (
          <Link
            className={`btn btn-outline ${active === 'account' ? 'active' : ''}`}
            href="/account/settings"
          >
            {accountLabel ? `@${accountLabel}` : t('account')}
          </Link>
        ) : (
          <a className="btn btn-outline" href={githubSignInHref(signInReturnTo)}>
            {t('signInWithGitHub')}
          </a>
        )}
        <a className="btn btn-primary" href={githubSignInHref(signInReturnTo)}>
          {t('startBroadcasting')}
        </a>
      </div>
    </nav>
  );
}
