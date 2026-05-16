import { buildYearHeatmapCells, toLocalDateKey } from '@nowcoding/core/heatmap';
import type { HeatmapResponse } from '@nowcoding/core/schemas';
import { and, gte, lt } from 'drizzle-orm';
import type { Database } from '../client';
import { buckets } from '../schema/buckets';

export interface HeatmapQueryOptions {
  year: number;
  timezone?: string;
  now?: Date;
}

export type HeatmapInfo = HeatmapResponse;

const COST_MICRO_UNITS = 1_000_000n;
const MAX_SAFE_TOKEN_TOTAL = BigInt(Number.MAX_SAFE_INTEGER);

export async function getHeatmap(db: Database, options: HeatmapQueryOptions): Promise<HeatmapInfo> {
  assertHeatmapYear(options.year);
  const timezone = options.timezone ?? 'UTC';
  toLocalDateKey(new Date(Date.UTC(options.year, 0, 1)), timezone);
  const rangeStart = new Date(Date.UTC(options.year, 0, 1) - 36 * 60 * 60 * 1000);
  const rangeEnd = new Date(Date.UTC(options.year + 1, 0, 1) + 36 * 60 * 60 * 1000);
  const rows = await db
    .select({
      bucketStart: buckets.bucketStart,
      totalTokens: buckets.totalTokens,
      costUsd: buckets.costUsd,
    })
    .from(buckets)
    .where(and(gte(buckets.bucketStart, rangeStart), lt(buckets.bucketStart, rangeEnd)));

  const aggregates = new Map<string, { tokens: bigint; estimatedCostMicros: bigint }>();
  for (const row of rows) {
    const date = toLocalDateKey(row.bucketStart, timezone);
    if (!date.startsWith(`${options.year}-`)) continue;
    const current = aggregates.get(date) ?? { tokens: 0n, estimatedCostMicros: 0n };
    current.tokens += toBigInt(row.totalTokens ?? 0n, 'Heatmap token total');
    current.estimatedCostMicros += costUsdToMicros(row.costUsd ?? '0');
    aggregates.set(date, current);
  }

  const heatmapAggregates = new Map<string, { tokens: number; estimatedCostUsd: number }>();
  for (const [date, aggregate] of aggregates) {
    if (aggregate.tokens > MAX_SAFE_TOKEN_TOTAL) {
      throw new RangeError(`Daily heatmap token total for ${date} exceeds Number.MAX_SAFE_INTEGER`);
    }
    heatmapAggregates.set(date, {
      tokens: Number(aggregate.tokens),
      estimatedCostUsd: Number(aggregate.estimatedCostMicros) / Number(COST_MICRO_UNITS),
    });
  }

  return {
    year: options.year,
    timezone,
    cells: buildYearHeatmapCells(options.year, heatmapAggregates),
    generatedAt: (options.now ?? new Date()).toISOString(),
  };
}

function assertHeatmapYear(year: number): void {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new RangeError('Heatmap year must be an integer between 1970 and 9999');
  }
}

function toBigInt(value: bigint | number | string, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${label} must be a safe integer`);
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new RangeError(`${label} must be an integer`);
  }
  return BigInt(value);
}

function costUsdToMicros(value: string | number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{0,6}))?$/.exec(String(value));
  if (!match) {
    throw new RangeError(
      'Heatmap cost_usd must be a decimal value with at most 6 fractional digits',
    );
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2] ?? '0');
  const fraction = BigInt((match[3] ?? '').padEnd(6, '0'));
  return sign * (whole * COST_MICRO_UNITS + fraction);
}
