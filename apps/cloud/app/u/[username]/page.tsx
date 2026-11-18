import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '../../../i18n/navigation';
import {
  formatCloudTimeSaved,
  formatTokenTotal,
  getProfileHeatmap,
  getProfileNow,
  getProfileStats,
  getPublicProfileUser,
} from '../../../lib/profile-data';
import { buildOfficialProfileUrls } from '../../../lib/profile-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ username: string }>;
};

function formatLastActive(value: string | null): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function badgeLabel(type: string): string {
  return type === 'live' ? 'live' : type.toUpperCase();
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  const user = await getPublicProfileUser(username);
  const t = await getTranslations('profile');

  if (!user) {
    notFound();
  }

  const [stats, now, heatmap] = await Promise.all([
    getProfileStats(user, '7d'),
    getProfileNow(user),
    getProfileHeatmap(user, new Date().getUTCFullYear()),
  ]);
  const urls = buildOfficialProfileUrls(user.username);
  const displayName = user.displayName ?? user.username;
  const isLive = now.status === 'active';
  const statusLabel =
    now.currentSource && now.status !== 'offline'
      ? `${now.status} on ${now.currentSource}`
      : now.status;
  const peakActivity = stats.peakActivity?.label ?? t('notEnoughData');
  const heatmapWeeks = Array.from(
    { length: 52 },
    (_, week) => `week-${String(week + 1).padStart(2, '0')}`,
  );

  return (
    <main className="shell profile-shell">
      <nav className="nav" aria-label={t('primaryNavigation')}>
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>
            <span className="brand-name">NowCoding Cloud</span>
            <span className="brand-note">{t('title')}</span>
          </span>
        </Link>
        <div className="nav-links">
          <Link className="button secondary" href="/leaderboard">
            {t('arena')}
          </Link>
          <a className="button primary" href={urls.card}>
            {t('svgCard')}
          </a>
        </div>
      </nav>

      <header className="profile-hero">
        <div className="profile-id">
          {user.avatarUrl ? (
            <img alt="" height={92} src={user.avatarUrl} width={92} />
          ) : (
            <span className="profile-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <p className="eyebrow">{t('title')}</p>
            <h1>{displayName}</h1>
            <p className="profile-handle">@{user.username}</p>
          </div>
        </div>
        <span className={`profile-status ${isLive ? 'active' : ''}`}>
          <span className="dot" />
          {statusLabel}
        </span>
      </header>

      <section className="profile-main">
        <div className="profile-panel card-preview-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('readmeCard')}</p>
              <h2>{t('headline')}</h2>
            </div>
            <a className="button secondary" href={urls.card}>
              {t('openSvg')}
            </a>
          </div>
          <img
            alt={`${displayName} NowCoding activity card`}
            className="profile-card-preview"
            src={urls.card}
          />
        </div>

        <aside className="profile-panel profile-side">
          <div>
            <p className="eyebrow">{t('now')}</p>
            <dl className="profile-facts">
              <div>
                <dt>{t('lastActive')}</dt>
                <dd>{formatLastActive(now.lastActiveAt) || t('noRecentActivity')}</dd>
              </div>
              <div>
                <dt>{t('source')}</dt>
                <dd>{now.currentSource ?? t('unknown')}</dd>
              </div>
              <div>
                <dt>{t('model')}</dt>
                <dd>{now.currentModel ?? stats.topModel ?? t('unknown')}</dd>
              </div>
              <div>
                <dt>{t('topSource')}</dt>
                <dd>{stats.topSource ?? t('noUsageYet')}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="eyebrow">{t('share')}</p>
            <div className="badge-grid">
              <a href={urls.card}>{t('githubReadme')}</a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `See what ${displayName} is coding with AI right now`,
                )}&url=${encodeURIComponent(urls.profile)}`}
              >
                X / Twitter
              </a>
              <a href={urls.profile}>{t('profileLink')}</a>
              <a href={urls.card}>{t('svgCard')}</a>
            </div>
          </div>

          <div>
            <p className="eyebrow">{t('badges')}</p>
            <div className="badge-grid">
              {Object.entries(urls.badges).map(([type, url]) => (
                <a href={url} key={type}>
                  {badgeLabel(type)}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section aria-label={t('activityProof')}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('activityProof')}</p>
            <h2>{t('activityProofHeadline')}</h2>
          </div>
        </div>
        <div className="profile-grid" aria-label={t('profileStats')}>
          <div className="profile-metric primary">
            <span className="metric-label">{t('tokens7d')}</span>
            <strong>{formatTokenTotal(stats.totalTokens)}</strong>
            <span>{stats.milestone ?? t('buildingMomentum')}</span>
          </div>
          <div className="profile-metric">
            <span className="metric-label">{t('today')}</span>
            <strong>{formatTokenTotal(now.todayTokens)}</strong>
            <span>{now.currentModel ?? t('unknownModel')}</span>
          </div>
          <div className="profile-metric">
            <span className="metric-label">{t('streak')}</span>
            <strong>{stats.streak.toLocaleString('en-US')}d</strong>
            <span>
              {t('activeDays', {
                count: heatmap.cells.length.toLocaleString('en-US'),
              })}
            </span>
          </div>
          <div className="profile-metric">
            <span className="metric-label">{t('timeSaved')}</span>
            <strong>{formatCloudTimeSaved(stats.timeSavedMinutes)}</strong>
            <span>{peakActivity}</span>
          </div>
        </div>
      </section>

      <section className="profile-panel heatmap-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('heatmapEyebrow', { year: heatmap.year })}</p>
            <h2>
              {t('activeDays', {
                count: heatmap.cells.length.toLocaleString('en-US'),
              })}
            </h2>
          </div>
          <span className="pill">{heatmap.timezone}</span>
        </div>
        <div className="heatmap-strip" aria-label={t('heatmapLabel', { year: heatmap.year })}>
          {heatmapWeeks.map((weekKey, index) => {
            const active = heatmap.cells.length > index;

            return (
              <span className={active ? 'heatmap-cell active' : 'heatmap-cell'} key={weekKey} />
            );
          })}
        </div>
      </section>
    </main>
  );
}
