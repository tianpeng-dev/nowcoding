import { getDb, leaderboardEntries, users } from '@nowcoding/cloud-db';
import { leaderboardQuerySchema } from '@nowcoding/core/cloud';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/navigation';
import CloudNav from '../components/cloud-nav';

export const dynamic = 'force-dynamic';

type LeaderboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LeaderboardEntry = {
  rank: number;
  username: string;
  avatarUrl: string | null;
  publicValue: string;
};

function firstSearchParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function loadLeaderboard(params: Record<string, string | string[] | undefined>): Promise<{
  range: string;
  scope: string;
  metric: string;
  entries: LeaderboardEntry[];
}> {
  const parsed = leaderboardQuerySchema.parse({
    range: firstSearchParam(params.range) ?? undefined,
    scope: firstSearchParam(params.scope) ?? undefined,
    metric: firstSearchParam(params.metric) ?? undefined,
  });
  const db = getDb();
  const [latest] = await db
    .select({
      generatedAt: sql<string>`max(${leaderboardEntries.generatedAt})::text`,
    })
    .from(leaderboardEntries)
    .where(
      and(
        eq(leaderboardEntries.range, parsed.range),
        eq(leaderboardEntries.scope, parsed.scope),
        eq(leaderboardEntries.metric, parsed.metric),
        isNull(leaderboardEntries.excludedAt),
      ),
    );
  const generatedAt = latest?.generatedAt ? new Date(latest.generatedAt) : null;
  const rows = generatedAt
    ? await db
        .select({
          rank: leaderboardEntries.rank,
          username: users.username,
          avatarUrl: users.avatarUrl,
          publicValue: leaderboardEntries.publicValue,
        })
        .from(leaderboardEntries)
        .innerJoin(users, eq(users.id, leaderboardEntries.userId))
        .where(
          and(
            eq(leaderboardEntries.range, parsed.range),
            eq(leaderboardEntries.scope, parsed.scope),
            eq(leaderboardEntries.metric, parsed.metric),
            eq(leaderboardEntries.generatedAt, generatedAt),
            isNull(leaderboardEntries.excludedAt),
            isNull(users.hiddenAt),
            isNotNull(users.username),
          ),
        )
        .orderBy(leaderboardEntries.rank, desc(leaderboardEntries.score))
        .limit(100)
    : [];

  return {
    ...parsed,
    entries: rows.map((row) => ({
      rank: row.rank ?? 0,
      username: row.username ?? 'unknown',
      avatarUrl: row.avatarUrl,
      publicValue: row.publicValue ?? '',
    })),
  };
}

function leaderboardHref(range: string, metric: string, scope: string): string {
  const params = new URLSearchParams({ range, metric, scope });
  return `/leaderboard?${params.toString()}`;
}

function metricLabel(metric: string, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (metric === 'active_time') {
    return t('metricActiveTime');
  }

  if (metric === 'streak') {
    return t('metricStreak');
  }

  if (metric === 'time_saved') {
    return t('metricTimeSaved');
  }

  return t('metricTokens');
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const [leaderboard, t] = await Promise.all([
    loadLeaderboard(params),
    getTranslations('leaderboard'),
  ]);
  const defaultLeaderboardUrl = '/api/leaderboard?range=30d&scope=all&metric=tokens';

  return (
    <main className="shell">
      <CloudNav active="arena" note={t('tableLabel')} signInReturnTo="/leaderboard" />

      <header className="page-head">
        <div>
          <p className="eyebrow">{t('title')}</p>
          <h1>{t('headline')}</h1>
          <p className="lead">{t('description')}</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/onboarding">
            {t('joinArena')}
          </Link>
          <a className="button secondary" href={defaultLeaderboardUrl}>
            {t('openJson')}
          </a>
        </div>
      </header>

      <section className="table-shell" aria-label={t('tableLabel')}>
        <div className="table-toolbar">
          <div className="tabs">
            {['30d', '7d', '1d'].map((range) => (
              <Link
                className={`tab ${leaderboard.range === range ? 'active' : ''}`}
                href={leaderboardHref(range, leaderboard.metric, leaderboard.scope) as Route}
                key={range}
              >
                {range.toUpperCase()}
              </Link>
            ))}
            {['tokens', 'active_time', 'streak', 'time_saved'].map((metric) => (
              <Link
                className={`tab ${leaderboard.metric === metric ? 'active' : ''}`}
                href={leaderboardHref(leaderboard.range, metric, leaderboard.scope) as Route}
                key={metric}
              >
                {metricLabel(metric, t)}
              </Link>
            ))}
          </div>
          <span className="pill">{t('optInDiscovery')}</span>
        </div>
        {leaderboard.entries.length > 0 ? (
          <div className="leaderboard-list">
            {leaderboard.entries.map((entry) => (
              <Link
                className="leaderboard-row"
                href={`/u/${encodeURIComponent(entry.username)}`}
                key={`${entry.rank}-${entry.username}`}
              >
                <span className="rank">#{entry.rank}</span>
                {entry.avatarUrl ? (
                  <img alt="" height="40" src={entry.avatarUrl} width="40" />
                ) : (
                  <span className="avatar-fallback">
                    {entry.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="leaderboard-user">
                  <strong>{entry.username}</strong>
                  <span>{leaderboard.scope}</span>
                </span>
                <span className="leaderboard-score">{entry.publicValue}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyDescription')}</p>
            <a className="button primary" href="/login/device">
              {t('confirmCliDevice')}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
