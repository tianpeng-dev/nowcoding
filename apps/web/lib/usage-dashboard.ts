import type { StatsResponse } from '@nowcoding/core/schemas';

export type UsageDashboardCardKey = 'tokens' | 'estimatedCost' | 'activeTime' | 'topModel';

export interface UsageDashboardCard {
  key: UsageDashboardCardKey;
  label: string;
  value: string;
  detail: string;
}

export interface UsageDashboardView {
  title: string;
  description: string;
  period: StatsResponse['period'];
  cards: UsageDashboardCard[];
}

export interface UsageDashboardMessages {
  title: string;
  description: string;
  cards: {
    tokens: string;
    estimatedCost: string;
    activeTime: string;
    topModel: string;
  };
  totalDetail: string;
  sessionsDetail: string;
  shareDetail: string;
  none: string;
  hidden: string;
  costLabels: Record<StatsResponse['costLabel'], string>;
}

export interface UsageDashboardOptions {
  messages?: UsageDashboardMessages;
  locale?: string;
}

export const DEFAULT_USAGE_DASHBOARD_MESSAGES = {
  title: 'Usage details',
  description: 'A deeper breakdown behind your public NowCoding presence.',
  cards: {
    tokens: 'Tokens',
    estimatedCost: 'Estimated cost',
    activeTime: 'Active time',
    topModel: 'Top model',
  },
  totalDetail: '{period} total',
  sessionsDetail: '{count} sessions',
  shareDetail: '{share} share',
  none: 'None',
  hidden: 'Hidden',
  costLabels: {
    estimated: 'estimated',
    hidden: 'hidden',
  },
} as const satisfies UsageDashboardMessages;

export function buildUsageDashboardView(
  stats: StatsResponse,
  options: UsageDashboardOptions = {},
): UsageDashboardView {
  const messages = options.messages ?? DEFAULT_USAGE_DASHBOARD_MESSAGES;
  const locale = options.locale ?? 'en';
  const cards: UsageDashboardCard[] = [
    {
      key: 'tokens',
      label: messages.cards.tokens,
      value: compactNumber(stats.totalTokens, locale),
      detail: interpolate(messages.totalDetail, { period: stats.period }),
    },
    {
      key: 'estimatedCost',
      label: messages.cards.estimatedCost,
      value:
        stats.estimatedCostUsd === null
          ? messages.hidden
          : formatUsd(stats.estimatedCostUsd, locale),
      detail: messages.costLabels[stats.costLabel],
    },
  ];

  cards.push(
    {
      key: 'activeTime',
      label: messages.cards.activeTime,
      value: formatActiveTime(stats.activeSeconds),
      detail: interpolate(messages.sessionsDetail, { count: `${stats.sessionCount}` }),
    },
    {
      key: 'topModel',
      label: messages.cards.topModel,
      value: stats.topModel?.name ?? messages.none,
      detail: interpolate(messages.shareDetail, {
        share: stats.topModel ? formatPercent(stats.topModel.share) : '0%',
      }),
    },
  );

  return {
    title: messages.title,
    description: messages.description,
    period: stats.period,
    cards,
  };
}

export function compactNumber(value: number, locale = 'en'): string {
  return Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatUsd(value: number, locale: string): string {
  return Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatActiveTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}
