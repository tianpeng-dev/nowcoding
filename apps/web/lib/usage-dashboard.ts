import type { StatsResponse } from '@nowcoding/core/schemas';

export interface UsageDashboardCard {
  label: string;
  value: string;
  detail: string;
}

export interface UsageDashboardView {
  title: 'Usage details';
  description: 'A deeper breakdown behind your public NowCoding presence.';
  period: StatsResponse['period'];
  cards: UsageDashboardCard[];
}

export function buildUsageDashboardView(stats: StatsResponse): UsageDashboardView {
  const cards: UsageDashboardCard[] = [
    {
      label: 'Tokens',
      value: compactNumber(stats.totalTokens),
      detail: `${stats.period} total`,
    },
    {
      label: 'Estimated cost',
      value: stats.estimatedCostUsd === null ? 'Hidden' : formatUsd(stats.estimatedCostUsd),
      detail: stats.costLabel,
    },
  ];

  cards.push(
    {
      label: 'Active time',
      value: formatActiveTime(stats.activeSeconds),
      detail: `${stats.sessionCount} sessions`,
    },
    {
      label: 'Top model',
      value: stats.topModel?.name ?? 'None',
      detail: stats.topModel ? `${formatPercent(stats.topModel.share)} share` : '0% share',
    },
  );

  return {
    title: 'Usage details',
    description: 'A deeper breakdown behind your public NowCoding presence.',
    period: stats.period,
    cards,
  };
}

export function compactNumber(value: number): string {
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatUsd(value: number): string {
  return Intl.NumberFormat('en-US', {
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
