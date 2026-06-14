import { ModelPie } from '@/components/ModelPie';
import { SourceBars } from '@/components/SourceBars';
import { SparklineChart } from '@/components/SparklineChart';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { toPublicStatsResponse } from '@/lib/stats-response';
import { type UsageDashboardMessages, buildUsageDashboardView } from '@/lib/usage-dashboard';
import { type Period, getDb, getPeriodStats } from '@nowcoding/db';
import { getTranslations } from 'next-intl/server';

const PERIOD_TABS = [
  { labelKey: 'periods.today', value: 'today', dbPeriod: '1d' },
  { labelKey: 'periods.sevenDays', value: '7d', dbPeriod: '7d' },
  { labelKey: 'periods.thirtyDays', value: '30d', dbPeriod: '30d' },
  { labelKey: 'periods.all', value: 'all', dbPeriod: 'all' },
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

export async function UsagePageContent({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const [t, dashboardT] = await Promise.all([
    getTranslations({ locale, namespace: 'usage' }),
    getTranslations({ locale, namespace: 'usageDashboard' }),
  ]);
  const dashboardMessages = buildUsageDashboardMessages(dashboardT);
  const params = await searchParams;
  const selectedPeriod = normalizePeriod(params?.period);
  const activeTab = PERIOD_TABS.find((tab) => tab.value === selectedPeriod) ?? PERIOD_TABS[1];
  const data = await loadUsageData(activeTab.dbPeriod);
  const publicStats = data.stats ? toPublicStatsResponse(data.stats, data.privacy.showCost) : null;
  const view = publicStats
    ? buildUsageDashboardView(publicStats, { locale, messages: dashboardMessages })
    : null;
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
  const cardsByKey = new Map((view?.cards ?? []).map((card) => [card.key, card]));
  const tokenCard = cardsByKey.get('tokens');
  const costCard = cardsByKey.get('estimatedCost');
  const activeTimeCard = cardsByKey.get('activeTime');
  const topModelCard = cardsByKey.get('topModel');
  const metricCards = [
    {
      key: tokenCard?.key ?? 'tokens',
      label: tokenCard?.label ?? t('cards.tokens'),
      value: tokenCard?.value ?? '0',
      detail: tokenCard?.detail ?? t('totalDetail', { period: t(activeTab.labelKey) }),
    },
    {
      key: costCard?.key ?? 'estimatedCost',
      label: costCard?.label ?? t('cards.estimatedCost'),
      value: costCard?.value ?? t('hidden'),
      detail: costCard?.detail ?? '',
    },
    {
      key: activeTimeCard?.key ?? 'activeTime',
      label: activeTimeCard?.label ?? t('cards.activeTime'),
      value: activeTimeCard?.value ?? '0m',
      detail:
        activeTimeCard?.detail ?? t('sessionsDetail', { count: publicStats?.sessionCount ?? 0 }),
    },
    {
      key: topModelCard?.key ?? 'topModel',
      label: topModelCard?.label ?? t('cards.topModel'),
      value: topModelCard?.value ?? t('none'),
      detail:
        topModelCard?.detail ??
        t('shareDetail', {
          share: publicStats?.topModel ? `${Math.round(publicStats.topModel.share * 100)}%` : '0%',
        }),
    },
  ];
  const chartLabels = {
    activityEmpty: t('charts.activityEmpty'),
    modelsEmpty: t('charts.modelsEmpty'),
    sourcesEmpty: t('charts.sourcesEmpty'),
    valueLabel: t('charts.valueLabel'),
  };

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{t('pageHeadline')}</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">{t('pageDescription')}</p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t('periodAria')}>
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
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          {t('viewPublicPresence')}
        </Link>
      </div>

      {!hasActivity ? (
        <EmptyState
          messages={{
            loadFailed: t('empty.loadFailed'),
            missingDatabase: t('empty.missingDatabase'),
            ready: t('empty.ready'),
          }}
          status={data.status}
        />
      ) : (
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCards.map((card) => (
              <MetricCard
                key={card.key}
                detail={card.detail}
                label={card.label}
                value={card.value}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr,0.6fr]">
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">
                {t('sections.tokens')}
              </h2>
              <div className="mt-4">
                <SparklineChart
                  data={sparkline}
                  emptyLabel={chartLabels.activityEmpty}
                  valueLabel={chartLabels.valueLabel}
                />
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">
                {t('sections.cost')}
              </h2>
              <div className="mt-4 flex h-48 flex-col justify-center">
                {costCard ? (
                  <>
                    <div className="text-3xl font-semibold">{costCard.value}</div>
                    <p className="mt-2 text-sm text-neutral-500">{costCard.detail}</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">{t('costHidden')}</p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">
                {t('sections.models')}
              </h2>
              <div className="mt-4">
                <ModelPie
                  data={models}
                  emptyLabel={chartLabels.modelsEmpty}
                  valueLabel={chartLabels.valueLabel}
                />
              </div>
            </section>
            <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-wide text-neutral-500">
                {t('sections.sources')}
              </h2>
              <div className="mt-4">
                <SourceBars
                  data={sources}
                  emptyLabel={chartLabels.sourcesEmpty}
                  valueLabel={chartLabels.valueLabel}
                />
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

function buildUsageDashboardMessages(
  t: Awaited<ReturnType<typeof getTranslations>>,
): UsageDashboardMessages {
  return {
    title: t('title'),
    description: t('description'),
    cards: {
      tokens: t('cards.tokens'),
      estimatedCost: t('cards.estimatedCost'),
      activeTime: t('cards.activeTime'),
      topModel: t('cards.topModel'),
    },
    totalDetail: t('totalDetail'),
    sessionsDetail: t('sessionsDetail'),
    shareDetail: t('shareDetail'),
    none: t('none'),
    hidden: t('hidden'),
    costLabels: {
      estimated: t('costLabels.estimated'),
      hidden: t('costLabels.hidden'),
    },
  };
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
  messages,
  status,
}: {
  messages: Record<'loadFailed' | 'missingDatabase' | 'ready', string>;
  status: 'missing-database' | 'load-failed' | 'ready';
}) {
  const message =
    status === 'missing-database'
      ? messages.missingDatabase
      : status === 'load-failed'
        ? messages.loadFailed
        : messages.ready;

  return (
    <section className="mt-6 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
      {message}
    </section>
  );
}
