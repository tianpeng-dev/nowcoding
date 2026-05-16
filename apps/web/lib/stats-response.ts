import { applyCostPrivacy } from '@nowcoding/core/cost';
import { type StatsResponse, statsResponseSchema } from '@nowcoding/core/schemas';
import type { PeriodStats } from '@nowcoding/db';

type LegacyPeriod = PeriodStats['period'];
type PublicStreak = StatsResponse['streak'];

const EMPTY_STREAK: PublicStreak = { current: 0, longest: 0, lastActiveDate: null };

export function toPublicStatsResponse(
  stats: PeriodStats,
  showCost: boolean,
  streak: PublicStreak = EMPTY_STREAK,
): StatsResponse {
  const totalTokens = toNumber(stats.totalTokens);
  const cost = applyCostPrivacy(showCost ? toCostNumber(stats.estimatedCostUsd) : null, showCost);
  const response = {
    period: toPublicPeriod(stats.period),
    totalTokens,
    inputTokens: toNumber(stats.inputTokens),
    outputTokens: toNumber(stats.outputTokens),
    sessionCount: 0,
    activeSeconds: 0,
    estimatedCostUsd: cost.estimatedCostUsd,
    costLabel: cost.costLabel,
    topModel: topItem(stats.topModel, stats.modelDistribution, 'model', totalTokens),
    topSource: topItem(stats.topSource, stats.sourceDistribution, 'source', totalTokens),
    topProject: null,
    modelDistribution: stats.modelDistribution.map((row) => ({
      name: row.model,
      tokens: toNumber(row.tokens),
      share: share(row.tokens, totalTokens),
    })),
    sourceDistribution: stats.sourceDistribution.map((row) => ({
      name: row.source,
      tokens: toNumber(row.tokens),
      share: share(row.tokens, totalTokens),
    })),
    streak,
    sparkline: stats.sparkline.map((point) => toNumber(point.tokens)),
    generatedAt: stats.generatedAt,
  };

  return statsResponseSchema.parse(response);
}

function toPublicPeriod(period: LegacyPeriod): StatsResponse['period'] {
  return period === '1d' ? 'today' : period;
}

function topItem<
  TKey extends 'model' | 'source',
  TRow extends Record<TKey, string> & { tokens: bigint },
>(name: string | null, rows: TRow[], key: TKey, totalTokens: number) {
  if (!name) return null;
  const row = rows.find((item) => item[key] === name);
  return {
    name,
    share: share(row?.tokens ?? 0n, totalTokens),
  };
}

function share(tokens: bigint, totalTokens: number): number {
  if (totalTokens <= 0) return 0;
  return Number((toNumber(tokens) / totalTokens).toFixed(6));
}

function toNumber(value: bigint): number {
  if (value < 0n) {
    throw new RangeError('Stats token value must be non-negative');
  }
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Stats token value exceeds Number.MAX_SAFE_INTEGER');
  }
  return Number(value);
}

function toCostNumber(value: string): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return 0;

  let whole = BigInt(match[1] ?? '0');
  const fraction = match[2] ?? '';
  let micros = BigInt(fraction.slice(0, 6).padEnd(6, '0'));

  if (fraction.length > 6 && Number(fraction[6]) >= 5) {
    micros += 1n;
    if (micros === 1_000_000n) {
      whole += 1n;
      micros = 0n;
    }
  }

  const maxSafeUsd = BigInt(Number.MAX_SAFE_INTEGER);
  if (whole > maxSafeUsd || (whole === maxSafeUsd && micros > 0n)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(`${whole.toString()}.${micros.toString().padStart(6, '0')}`);
}
