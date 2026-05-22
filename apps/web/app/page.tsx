import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { ModelPie } from '@/components/ModelPie';
import { SourceBars } from '@/components/SourceBars';
import { SparklineChart } from '@/components/SparklineChart';
import { badgeEmbedMarkdown } from '@/lib/badges';
import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import {
  buildLivePresenceLabel,
  buildProfileSummary,
  formatSafeTokens,
  toNowResponse,
} from '@/lib/public-surface';
import { toLocalDateKey } from '@nowcoding/core/heatmap';
import { getDb, getHeatmap, getNowActivity, getPeriodStats, getStreak } from '@nowcoding/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData(owner: ReturnType<typeof getOwnerProfile>) {
  const env = getEnv();
  const privacy = getServerPrivacy();
  const empty = {
    stats: null,
    today: null,
    allTime: null,
    streak: null,
    heatmap: null,
    now: null,
    privacy,
    baseUrl: env.NOWCODING_WEBSITE_URL ?? '',
  };
  if (!env.DATABASE_URL) return empty;
  try {
    const db = getDb(env.DATABASE_URL);
    const now = new Date();
    const year = Number(toLocalDateKey(now, owner.timezone).slice(0, 4));
    const [stats, today, allTime, streak, heatmap, activity] = await Promise.all([
      getPeriodStats(db, '7d', { now }),
      getPeriodStats(db, '1d', { now, timezone: owner.timezone }),
      getPeriodStats(db, 'all', { now }),
      getStreak(db, { timezone: owner.timezone, now }),
      getHeatmap(db, { year, timezone: owner.timezone, now }),
      getNowActivity(db, { timezone: owner.timezone, now }),
    ]);
    return {
      stats,
      today,
      allTime,
      streak,
      heatmap,
      now: toNowResponse(activity, privacy, now),
      privacy,
      baseUrl: env.NOWCODING_WEBSITE_URL ?? '',
    };
  } catch (e) {
    console.error('[profile] data load failed:', e);
    return empty;
  }
}

export default async function ProfilePage() {
  const owner = getOwnerProfile();
  const data = await loadData(owner);
  const stats = data?.stats;
  const summary = buildProfileSummary({
    stats: data?.stats ?? null,
    now: data?.now ?? null,
    streak: data?.streak ?? null,
    showCost: data?.privacy.showCost ?? true,
  });
  const livePresenceLabel = buildLivePresenceLabel({
    status: data?.now?.status ?? 'inactive',
    currentSource: data?.now?.currentSource ?? null,
    currentModel: data?.now?.currentModel ?? null,
  });
  const todayTokens = data?.now ? data.now.todayTokens : (data?.today?.totalTokens ?? 0n);
  const embedBase = data?.baseUrl || 'https://<you>.vercel.app';
  const publicBase = data?.baseUrl?.replace(/\/$/, '') ?? '';
  const cardHref = publicBase ? `${publicBase}/card.svg` : '/card.svg';
  const badgeLinks = [
    { label: 'Live badge', href: publicBase ? `${publicBase}/badge/live.svg` : '/badge/live.svg' },
    {
      label: 'Streak badge',
      href: publicBase ? `${publicBase}/badge/streak.svg` : '/badge/streak.svg',
    },
    { label: 'README card', href: cardHref },
  ];
  const shareLinks = [
    { label: 'GitHub README', href: cardHref },
    { label: 'Personal site', href: cardHref },
  ];

  const sparkline = (stats?.sparkline ?? []).map((p) => ({
    date: p.date,
    tokens: toChartNumber(p.tokens),
  }));
  const models = (stats?.modelDistribution ?? []).map((m) => ({
    model: m.model,
    tokens: toChartNumber(m.tokens),
  }));
  const sources = (stats?.sourceDistribution ?? []).map((s) => ({
    source: s.source,
    tokens: toChartNumber(s.tokens),
  }));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
        <div>
          {owner.avatarUrl ? (
            <img
              src={owner.avatarUrl}
              alt={owner.displayName}
              width={80}
              height={80}
              className="rounded-full"
            />
          ) : (
            <div className="size-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Builder profile
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">{owner.displayName}</h1>
          <p className="mt-2 text-xl font-medium text-neutral-900 dark:text-neutral-100">
            {livePresenceLabel}
          </p>
          {owner.bio ? <p className="mt-2 text-neutral-500">{owner.bio}</p> : null}
          {owner.githubHandle ? (
            <Link
              href={`https://github.com/${owner.githubHandle}`}
              className="mt-3 inline-flex text-sm text-blue-600 hover:underline"
            >
              @{owner.githubHandle}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.35fr,0.65fr]">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500">README card</h2>
            <Link href={cardHref} className="text-sm text-blue-600 hover:underline">
              Open card
            </Link>
          </div>
          <img
            src={cardHref}
            alt={`${owner.displayName} NowCoding README card`}
            className="mt-4 w-full rounded-md border border-neutral-200 dark:border-neutral-800"
          />
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500">Share links</h2>
          <div className="mt-4 grid gap-2">
            {badgeLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <h3 className="text-xs uppercase tracking-wide text-neutral-500">Share</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {shareLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live" value={summary.live.label} tone={summary.live.tone} />
        <Stat label="Streak" value={summary.streakLabel} />
        <Stat label="Time saved" value={summary.timeSavedLabel} />
        <Stat label="Today" value={formatSafeTokens(todayTokens)} unit="tokens" />
      </section>

      {summary.isEmpty ? (
        <section className="mt-8 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          No coding activity yet. Run <code>nowcoding sync</code> or{' '}
          <code>nowcoding heartbeat</code> to populate this profile.
        </section>
      ) : null}

      {data?.heatmap ? (
        <ActivityHeatmap
          cells={data.heatmap.cells}
          year={data.heatmap.year}
          timezone={data.heatmap.timezone}
        />
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Activity proof</h2>
            <p className="mt-1 text-sm text-neutral-500">
              The detailed usage trail behind the public profile.
            </p>
          </div>
          <div className="text-sm text-neutral-500">
            <Link href="/usage" className="text-blue-600 hover:underline">
              Usage details
            </Link>
            <span className="mx-2 text-neutral-300 dark:text-neutral-700">/</span>
            {formatSafeTokens(data?.allTime?.totalTokens ?? 0n)} all-time tokens
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <h3 className="text-sm uppercase tracking-wide text-neutral-500">7-day activity</h3>
          <div className="mt-4">
            <SparklineChart data={sparkline} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="text-sm uppercase tracking-wide text-neutral-500">Models</h3>
            <div className="mt-4">
              <ModelPie data={models} />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="text-sm uppercase tracking-wide text-neutral-500">Sources</h3>
            <div className="mt-4">
              <SourceBars data={sources} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Last 7 days" value={summary.tokenLabel} unit="tokens" />
          <Stat label="Peak activity" value={summary.peakActivityLabel} />
          <Stat label="Estimated cost" value={summary.costLabel} />
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">Embed</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
          {badgeEmbedMarkdown(embedBase, owner.displayName)}
        </pre>
      </section>
    </main>
  );
}

function toChartNumber(value: bigint): number {
  if (value < 0n) return 0;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'live' | 'recent' | 'idle' | 'inactive' | 'private';
}) {
  const toneClass = {
    live: 'border-green-300 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100',
    recent:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    idle: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    inactive:
      'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-transparent dark:text-neutral-50',
    private:
      'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400',
  } satisfies Record<NonNullable<typeof tone>, string>;

  return (
    <div
      className={`rounded-lg border p-4 ${tone ? toneClass[tone] : 'border-neutral-200 dark:border-neutral-800'}`}
    >
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-neutral-500">{unit}</span> : null}
      </div>
    </div>
  );
}
