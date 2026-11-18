import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Link } from '../../i18n/navigation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserReadOnlyFromCookie,
  githubSignInHref,
} from '../../lib/browser-session';
import {
  formatCloudTimeSaved,
  formatTokenTotal,
  getProfileNow,
  getProfileStats,
  getPublicProfileUser,
} from '../../lib/profile-data';
import { buildOfficialProfileUrls } from '../../lib/profile-urls';
import CloudNav from '../components/cloud-nav';

export const dynamic = 'force-dynamic';

function formatStatus(status: string, t: Awaited<ReturnType<typeof getTranslations>>): string {
  return status === 'active'
    ? t('codingNow')
    : status === 'idle'
      ? t('activeRecently')
      : t('offline');
}

export default async function UsagePage() {
  const t = await getTranslations('usage');
  const cookieStore = await cookies();
  const currentUser = await getCurrentBrowserUserReadOnlyFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return (
      <main className="shell">
        <CloudNav note={t('title')} signInReturnTo="/usage" />
        <header className="page-head">
          <div>
            <p className="eyebrow">{t('title')}</p>
            <h1>{t('signInRequired')}</h1>
            <p className="lead">{t('signInDescription')}</p>
          </div>
          <a className="button primary" href={githubSignInHref('/usage')}>
            {t('signInWithGitHub')}
          </a>
        </header>
      </main>
    );
  }

  const username =
    currentUser.user.username ?? currentUser.user.githubLogin ?? currentUser.identity.githubLogin;
  const user = await getPublicProfileUser(username);

  if (!user) {
    return (
      <main className="shell">
        <CloudNav active="account" note={t('title')} signInReturnTo="/usage" />
        <header className="page-head">
          <div>
            <p className="eyebrow">{t('title')}</p>
            <h1>{t('profileUnavailable')}</h1>
            <p className="lead">{t('description')}</p>
          </div>
          <Link className="button secondary" href="/account/settings">
            {t('accountSettings')}
          </Link>
        </header>
      </main>
    );
  }

  const [stats, now] = await Promise.all([getProfileStats(user, '30d'), getProfileNow(user)]);
  const urls = buildOfficialProfileUrls(user.username);

  return (
    <main className="shell">
      <CloudNav active="account" note={t('title')} signInReturnTo="/usage" />
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('title')}</p>
          <h1>{t('headline')}</h1>
          <p className="lead">{t('description')}</p>
        </div>
        <Link className="button secondary" href={urls.profile as Route}>
          {t('viewPublicPresence')}
        </Link>
      </header>

      <section className="profile-grid" aria-label={t('signedInSummary')}>
        <div className="profile-metric primary">
          <span className="metric-label">{t('tokens30d')}</span>
          <strong>{formatTokenTotal(stats.totalTokens)}</strong>
          <span>{stats.topModel ?? t('noModelYet')}</span>
        </div>
        <div className="profile-metric">
          <span className="metric-label">{t('today')}</span>
          <strong>{formatTokenTotal(now.todayTokens)}</strong>
          <span>{formatStatus(now.status, t)}</span>
        </div>
        <div className="profile-metric">
          <span className="metric-label">{t('timeSaved')}</span>
          <strong>{formatCloudTimeSaved(stats.timeSavedMinutes)}</strong>
          <span>{stats.peakActivity?.label ?? t('noPatternYet')}</span>
        </div>
        <div className="profile-metric">
          <span className="metric-label">{t('streak')}</span>
          <strong>{t('streakDays', { count: stats.streak.toLocaleString('en-US') })}</strong>
          <span>{stats.topSource ?? t('noSourceYet')}</span>
        </div>
      </section>

      <section className="profile-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('supportingData')}</p>
            <h2>{t('publicProofInputs')}</h2>
          </div>
          <span className="pill">{user.timezone}</span>
        </div>
        <dl className="profile-facts">
          <div>
            <dt>{t('profile')}</dt>
            <dd>{urls.profile}</dd>
          </div>
          <div>
            <dt>{t('readmeCard')}</dt>
            <dd>{urls.card}</dd>
          </div>
          <div>
            <dt>{t('costVisibility')}</dt>
            <dd>{stats.estimatedCostUsd === null ? t('hidden') : t('visible')}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
