import {
  estimateTimeSavedMinutes,
  highlightedMilestone,
  peakActivityWindow,
} from '@nowcoding/core';
import { and, desc, gte, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { buckets } from '../schema/buckets';

export type Period = '1d' | '7d' | '30d' | 'all';

export function periodStart(period: Period, now: Date = new Date()): Date {
  const ms = { '1d': 1, '7d': 7, '30d': 30 }[period as '1d' | '7d' | '30d'];
  if (ms === undefined) return new Date(0);
  return new Date(now.getTime() - ms * 24 * 60 * 60 * 1000);
}

export interface PeriodStats {
  period: Period;
  totalTokens: bigint;
  inputTokens: bigint;
  outputTokens: bigint;
  cachedInputTokens: bigint;
  reasoningOutputTokens: bigint;
  estimatedCostUsd: string;
  topModel: string | null;
  topSource: string | null;
  modelDistribution: { model: string; tokens: bigint }[];
  sourceDistribution: { source: string; tokens: bigint }[];
  sparkline: { date: string; tokens: bigint }[];
  timeSavedMinutes: number;
  peakActivity: { startHour: number; endHour: number; label: string } | null;
  milestone: string | null;
  generatedAt: string;
}

function toBigInt(value: bigint | number | string | null | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) return BigInt(value);
  return 0n;
}

function toSafeNumber(value: bigint): number {
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}

function bucketInteractionCount(row: {
  requestCount: bigint | number | string | null;
  totalTokens: bigint | number | string | null;
}): number {
  const count = toBigInt(row.requestCount);
  if (count > 0n) return toSafeNumber(count);

  return toBigInt(row.totalTokens) > 0n ? 1 : 0;
}

function utcDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function utcHour(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return date.getUTCHours();
}

export async function getPeriodStats(db: Database, period: Period): Promise<PeriodStats> {
  const start = periodStart(period);
  const where = period === 'all' ? undefined : gte(buckets.bucketStart, start);

  const totals = await db
    .select({
      totalTokens: sql<bigint>`coalesce(sum(${buckets.totalTokens}), 0)`,
      inputTokens: sql<bigint>`coalesce(sum(${buckets.inputTokens}), 0)`,
      outputTokens: sql<bigint>`coalesce(sum(${buckets.outputTokens}), 0)`,
      cachedInputTokens: sql<bigint>`coalesce(sum(${buckets.cachedInputTokens}), 0)`,
      reasoningOutputTokens: sql<bigint>`coalesce(sum(${buckets.reasoningOutputTokens}), 0)`,
      estimatedCostUsd: sql<string>`coalesce(sum(${buckets.costUsd}), 0)::text`,
    })
    .from(buckets)
    .where(where ? and(where) : undefined);

  const byModel = await db
    .select({
      model: buckets.model,
      tokens: sql<bigint>`coalesce(sum(${buckets.totalTokens}), 0)`.as('tokens'),
    })
    .from(buckets)
    .where(where ? and(where) : undefined)
    .groupBy(buckets.model)
    .orderBy(desc(sql`tokens`));

  const bySource = await db
    .select({
      source: buckets.source,
      tokens: sql<bigint>`coalesce(sum(${buckets.totalTokens}), 0)`.as('tokens'),
    })
    .from(buckets)
    .where(where ? and(where) : undefined)
    .groupBy(buckets.source)
    .orderBy(desc(sql`tokens`));

  const sparkline = await db
    .select({
      date: sql<string>`to_char(${buckets.bucketStart} at time zone 'UTC', 'YYYY-MM-DD')`.as(
        'date',
      ),
      tokens: sql<bigint>`coalesce(sum(${buckets.totalTokens}), 0)`.as('tokens'),
    })
    .from(buckets)
    .where(where ? and(where) : undefined)
    .groupBy(sql`date`)
    .orderBy(sql`date`);

  const engagementRows = await db
    .select({
      source: buckets.source,
      bucketStart: buckets.bucketStart,
      totalTokens: buckets.totalTokens,
      requestCount: buckets.requestCount,
    })
    .from(buckets)
    .where(where ? and(where) : undefined);

  const head = totals[0] ?? {
    totalTokens: 0n,
    inputTokens: 0n,
    outputTokens: 0n,
    cachedInputTokens: 0n,
    reasoningOutputTokens: 0n,
    estimatedCostUsd: '0',
  };

  const activeDates = new Set<string>();
  const distinctSources = new Set<string>();
  const hourlyActivity = Array.from({ length: 24 }, () => 0);
  let requestCount = 0n;

  for (const row of engagementRows) {
    activeDates.add(utcDateKey(row.bucketStart));
    distinctSources.add(row.source);
    requestCount += toBigInt(row.requestCount);

    const hour = utcHour(row.bucketStart);
    hourlyActivity[hour] = (hourlyActivity[hour] ?? 0) + bucketInteractionCount(row);
  }

  const totalTokens = BigInt(head.totalTokens ?? 0);
  const outputTokens = BigInt(head.outputTokens ?? 0);
  const reasoningOutputTokens = BigInt(head.reasoningOutputTokens ?? 0);
  const activeDays = activeDates.size;
  const timeSavedMinutes = estimateTimeSavedMinutes({
    outputTokens: outputTokens + reasoningOutputTokens,
    requestCount,
    activeDays,
  });
  const peakActivity = peakActivityWindow(hourlyActivity);
  const milestone = highlightedMilestone({
    totalTokens,
    timeSavedMinutes,
    activeDays30d: activeDays,
    distinctSources30d: distinctSources.size,
    peakActivityStartHour: peakActivity?.startHour ?? null,
    peakActivityActiveDays30d: activeDays,
  });

  return {
    period,
    totalTokens,
    inputTokens: BigInt(head.inputTokens ?? 0),
    outputTokens,
    cachedInputTokens: BigInt(head.cachedInputTokens ?? 0),
    reasoningOutputTokens,
    estimatedCostUsd: String(head.estimatedCostUsd ?? '0'),
    topModel: byModel[0]?.model ?? null,
    topSource: bySource[0]?.source ?? null,
    modelDistribution: byModel.map((r) => ({ model: r.model, tokens: BigInt(r.tokens ?? 0) })),
    sourceDistribution: bySource.map((r) => ({ source: r.source, tokens: BigInt(r.tokens ?? 0) })),
    sparkline: sparkline.map((r) => ({ date: r.date, tokens: BigInt(r.tokens ?? 0) })),
    timeSavedMinutes,
    peakActivity,
    milestone,
    generatedAt: new Date().toISOString(),
  };
}
