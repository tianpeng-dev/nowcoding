import { ModelPie } from '@/components/ModelPie';
import { SourceBars } from '@/components/SourceBars';
import { SparklineChart } from '@/components/SparklineChart';
import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { toPublicStatsResponse } from '@/lib/stats-response';
import { buildUsageDashboardView } from '@/lib/usage-dashboard';
import { type Period, getDb, getPeriodStats } from '@nowcoding/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PERIOD_TABS = [
  { label: 'Today', value: 'today', dbPeriod: '1d' },
  { label: '7d', value: '7d', dbPeriod: '7d' },
  { label: '30d', value: '30d', dbPeriod: '30d' },
  { label: 'All', value: 'all', dbPeriod: 'all' },
] as const;

type PublicPeriod = (typeof PERIOD_TABS)[number]['value'];

async function loadUsageData(period: Period) {
  const env = getEnv();
  const owner = getOwnerProfile();
  const privacy = getServerPrivacy();
  if (!env.DATABASE_URL) {
    return { status: 'missing-database' as const, stats: null, privacy };
  }

  try {
    const db = getDb(env.DATABASE_URL);
    const stats = await getPeriodStats(db, period, { timezone: owner.timezone });
    return { status: 'ready' as const, stats, privacy };
  } catch (e) {
    console.error('[usage] data load failed:', e);
    return { status: 'load-failed' as const, stats: null, privacy };
  }
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedPeriod = normalizePeriod(params?.period);
  const activeTab = PERIOD_TABS.find((tab) => tab.value === selectedPeriod) ?? PERIOD_TABS[1];
  const data = await loadUsageData(activeTab.dbPeriod);
  const publicStats = data.stats ? toPublicStatsResponse(data.stats, data.privacy.showCost) : null;
  const view = publicStats ? buildUsageDashboardView(publicStats) : null;
  const hasActivity = (publicStats?.totalTokens ?? 0) > 0;

  const sparkline = (data.stats?.sparkline ?? []).map((point) => ({
    date: point.date,
    tokens: toChartNumber(point.tokens),
  }));
  const models = (data.stats?.modelDistribution ?? []).map((model) => ({
    model: model.model,
    tokens: toChartNumber(model.tokens),
  }));
  const sources = (data.stats?.sourceDistribution ?? []).map((source) => ({
    source: source.source,
    tokens: toChartNumber(source.tokens),
  }));
  const costCard = view?.cards.find((card) => card.label === 'Estimated cost');

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Analytics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Usage details</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">
          A deeper breakdown behind your public NowCoding presence.
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Usage period">
        {PERIOD_TABS.map((tab) => {
          const isActive = tab.value === activeTab.value;
          return (
            <Link
              key={tab.value}
              href={`/usage?period=${tab.value}`}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          View public presence
        </Link>
      </div>

      {!hasActivity ? (
        <EmptyState status={data.status} />
      ) : (
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view?.cards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr,0.6fr]">
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">Tokens</h2>
              <div className="mt-4">
                <SparklineChart data={sparkline} />
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">Cost</h2>
              <div className="mt-4 flex h-48 flex-col justify-center">
                {costCard ? (
                  <>
                    <div className="text-3xl font-semibold">{costCard.value}</div>
                    <p className="mt-2 text-sm text-neutral-500">{costCard.detail}</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Cost is hidden for this profile.</p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">Models</h2>
              <div className="mt-4">
                <ModelPie data={models} />
              </div>
            </section>
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">Sources</h2>
              <div className="mt-4">
                <SourceBars data={sources} />
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

function normalizePeriod(value: string | string[] | undefined): PublicPeriod {
  const period = Array.isArray(value) ? value[0] : value;
  if (period === 'today' || period === '7d' || period === '30d' || period === 'all') {
    return period;
  }
  return '7d';
}

function toChartNumber(value: bigint): number {
  if (value < 0n) return 0;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold" title={value}>
        {value}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{detail}</div>
    </div>
  );
}

function EmptyState({
  status,
}: {
  status: 'missing-database' | 'load-failed' | 'ready';
}) {
  const message =
    status === 'missing-database'
      ? 'Connect DATABASE_URL to show private usage analytics for this profile.'
      : status === 'load-failed'
        ? 'Usage analytics could not be loaded right now.'
        : 'No coding activity exists for this period yet.';

  return (
    <section className="mt-6 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
      {message}
    </section>
  );
}
