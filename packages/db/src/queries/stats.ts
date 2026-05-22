import {
  estimateTimeSavedMinutes,
  highlightedMilestone,
  peakActivityWindow,
} from '@nowcoding/core';
import { toLocalDateKey } from '@nowcoding/core/heatmap';
import { and, desc, gte, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { buckets } from '../schema/buckets';
import { sessions } from '../schema/sessions';

export type Period = '1d' | '7d' | '30d' | 'all';

export interface PeriodStatsOptions {
  now?: Date;
  timezone?: string;
}

export function periodStart(period: Period, now: Date = new Date(), timezone?: string): Date {
  if (period === '1d' && timezone) return startOfLocalDayUtc(now, timezone);
  const ms = { '1d': 1, '7d': 7, '30d': 30 }[period as '1d' | '7d' | '30d'];
  if (ms === undefined) return new Date(0);
  return new Date(now.getTime() - ms * 24 * 60 * 60 * 1000);
}

export interface PeriodStats {
  period: Period;
  totalTokens: bigint;
  inputTokens: bigint;
  outputTokens: bigint;
  sessionCount: number;
  activeSeconds: number;
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

function startOfLocalDayUtc(now: Date, timezone: string): Date {
  const [year, month, day] = toLocalDateKey(now, timezone).split('-').map(Number);
  if (!year || !month || !day) {
    throw new RangeError(`Unable to compute local day start for timezone ${timezone}`);
  }

  const localMidnightUtcGuess = Date.UTC(year, month - 1, day);
  const firstOffset = timezoneOffsetMs(new Date(localMidnightUtcGuess), timezone);
  const candidate = new Date(localMidnightUtcGuess - firstOffset);
  const secondOffset = timezoneOffsetMs(candidate, timezone);
  return new Date(localMidnightUtcGuess - secondOffset);
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((item) => item.type === type)?.value;
    if (!part) throw new RangeError(`Unable to compute timezone offset for ${timezone}`);
    return Number(part);
  };
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour') % 24,
    value('minute'),
    value('second'),
  );
  return asUtc - date.getTime();
}

export async function getPeriodStats(
  db: Database,
  period: Period,
  options: PeriodStatsOptions = {},
): Promise<PeriodStats> {
  const start = periodStart(period, options.now ?? new Date(), options.timezone);
  const where = period === 'all' ? undefined : gte(buckets.bucketStart, start);
  const sessionWhere = period === 'all' ? undefined : gte(sessions.lastMessageAt, start);

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

  const activeSecondsExpression =
    period === 'all'
      ? sql`greatest(${sessions.activeSeconds}, 0)`
      : sql`case
          when ${sessions.firstMessageAt} >= ${start}
            then greatest(${sessions.activeSeconds}, 0)
          else least(
            greatest(${sessions.activeSeconds}, 0),
            greatest(0, floor(extract(epoch from (${sessions.lastMessageAt} - ${start}))))
          )
        end`;

  const sessionTotals = await db
    .select({
      sessionCount: sql<number>`count(*)::int`,
      activeSeconds: sql<number>`coalesce(sum(${activeSecondsExpression}), 0)::int`,
    })
    .from(sessions)
    .where(sessionWhere ? and(sessionWhere) : undefined);

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
    sessionCount: Number(sessionTotals[0]?.sessionCount ?? 0),
    activeSeconds: Number(sessionTotals[0]?.activeSeconds ?? 0),
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
