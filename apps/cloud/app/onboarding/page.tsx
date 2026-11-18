import { getCloudUrl } from '@nowcoding/cloud-core';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Link } from '../../i18n/navigation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserReadOnlyFromCookie,
  githubSignInHref,
} from '../../lib/browser-session';
import { loadOnboardingData } from '../../lib/onboarding-data';
import CloudNav from '../components/cloud-nav';
import CopyLinkButton from './copy-link-button';
import { joinArenaFromOnboarding, leaveArenaFromOnboarding } from './onboarding-actions';

export const dynamic = 'force-dynamic';

// 测试边界保留文案锚点：Device / First sync / Arena / Profile / Automatic sync / Enabled / Not enabled yet
type OnboardingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: Date | null | undefined, emptyLabel: string): string {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

function statusMessage(
  status: string | string[] | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string | null {
  const value = Array.isArray(status) ? status[0] : status;

  if (value === 'arena-joined') {
    return t('arenaJoined');
  }

  if (value === 'arena-left') {
    return t('arenaLeft');
  }

  if (value === 'sign-in-required') {
    return t('signInRequiredStatus');
  }

  return null;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const t = await getTranslations('onboarding');
  const cookieStore = await cookies();
  const currentUser = await getCurrentBrowserUserReadOnlyFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );
  const params = await searchParams;
  const notice = statusMessage(params?.status, t);

  if (!currentUser) {
    return (
      <main className="shell onboarding-layout">
        <CloudNav note={t('title')} signInReturnTo="/onboarding" />
        <header className="onboarding-header">
          <p className="eyebrow">{t('title')}</p>
          <h1>{t('headline')}</h1>
          <p className="lead">{t('description')}</p>
          <a className="button primary" href={githubSignInHref('/onboarding')}>
            {t('signInWithGitHub')}
          </a>
        </header>
      </main>
    );
  }

  const username =
    currentUser.user.username ?? currentUser.user.githubLogin ?? currentUser.identity.githubLogin;
  const data = await loadOnboardingData(currentUser.user.id, username, undefined, getCloudUrl());

  return (
    <main className="shell onboarding-layout">
      <CloudNav active="account" note={t('title')} signInReturnTo="/onboarding" />

      <header className="onboarding-header">
        <div>
          <p className="eyebrow">{t('title')}</p>
          <h1>{t('headline')}</h1>
          <p className="lead">
            {t('description')} @{username}
          </p>
        </div>
        <Link className="button secondary" href="/account/settings">
          {t('accountSettings')}
        </Link>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="onboarding-grid">
        <section className="onboarding-panel" aria-labelledby="device-heading">
          <div className="panel-heading">
            <h2 id="device-heading">{t('device')}</h2>
            <span className={`status-badge ${data.device ? 'active' : 'revoked'}`}>
              {data.device ? t('connected') : t('missing')}
            </span>
          </div>
          <dl className="onboarding-facts">
            <div>
              <dt>{t('name')}</dt>
              <dd>{data.device?.name ?? t('noActiveCliDevice')}</dd>
            </div>
            <div>
              <dt>{t('host')}</dt>
              <dd>{data.device?.hostname ?? t('unknown')}</dd>
            </div>
            <div>
              <dt>{t('cli')}</dt>
              <dd>{data.device?.cliVersion ?? t('unknown')}</dd>
            </div>
            <div>
              <dt>{t('lastSeen')}</dt>
              <dd>{formatDate(data.device?.lastSeenAt, t('notSeenYet'))}</dd>
            </div>
          </dl>
        </section>

        <section className="onboarding-panel" aria-labelledby="sync-heading">
          <div className="panel-heading">
            <h2 id="sync-heading">{t('firstSync')}</h2>
            <span className={`status-badge ${data.usage.hasUsage ? 'active' : 'revoked'}`}>
              {data.usage.hasUsage ? t('received') : t('pending')}
            </span>
          </div>
          <dl className="onboarding-facts">
            <div>
              <dt>{t('latestSync')}</dt>
              <dd>{formatDate(data.usage.latestSyncAt, t('notSeenYet'))}</dd>
            </div>
            <div>
              <dt>{t('tokens7d')}</dt>
              <dd>{formatNumber(data.usage.totalTokens7d)}</dd>
            </div>
            <div>
              <dt>{t('requests7d')}</dt>
              <dd>{formatNumber(data.usage.requestCount7d)}</dd>
            </div>
          </dl>
        </section>

        <section className="onboarding-panel" aria-labelledby="arena-heading">
          <div className="panel-heading">
            <h2 id="arena-heading">{t('arena')}</h2>
            <span className={`status-badge ${data.arena.joined ? 'active' : 'revoked'}`}>
              {data.arena.joined ? t('joined') : t('notJoined')}
            </span>
          </div>
          <p className="help">{t('arenaHelp')}</p>
          {data.arena.joined ? (
            <form action={leaveArenaFromOnboarding}>
              <button className="button secondary" type="submit">
                {t('leaveArena')}
              </button>
            </form>
          ) : (
            <form action={joinArenaFromOnboarding}>
              <button className="button primary" type="submit">
                {t('joinArena')}
              </button>
            </form>
          )}
        </section>

        <section className="onboarding-panel" aria-labelledby="profile-heading">
          <div className="panel-heading">
            <h2 id="profile-heading">{t('profile')}</h2>
            <Link className="button secondary" href={data.links.profile as Route}>
              {t('open')}
            </Link>
          </div>
          <div className="link-copy-list">
            <div>
              <span>{t('profile')}</span>
              <code>{data.links.profile}</code>
              <CopyLinkButton value={data.links.profile} />
            </div>
            <div>
              <span>{t('card')}</span>
              <code>{data.links.card}</code>
              <CopyLinkButton value={data.links.card} />
            </div>
            {Object.entries(data.links.badges).map(([type, href]) => (
              <div key={type}>
                <span>{type}</span>
                <code>{href}</code>
                <CopyLinkButton value={href} />
              </div>
            ))}
          </div>
        </section>

        <section className="onboarding-panel" aria-labelledby="automatic-sync-heading">
          <div className="panel-heading">
            <h2 id="automatic-sync-heading">{t('automaticSync')}</h2>
            <span className={`status-badge ${data.automaticSync.enabled ? 'active' : 'revoked'}`}>
              {data.automaticSync.enabled ? t('enabled') : t('notEnabledYet')}
            </span>
          </div>
          {data.automaticSync.enabled ? (
            <dl className="onboarding-facts">
              <div>
                <dt>{t('reported')}</dt>
                <dd>{data.automaticSync.reportedAt ?? t('recently')}</dd>
              </div>
            </dl>
          ) : (
            <>
              <p className="help">{t('automaticSyncHelp')}</p>
              <div className="command-stack">
                <code>nowcoding daemon install</code>
                <code>nowcoding daemon start</code>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
