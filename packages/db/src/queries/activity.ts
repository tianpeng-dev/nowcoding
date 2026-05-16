import { toLocalDateKey } from '@nowcoding/core/heatmap';
import { and, desc, gte, lt } from 'drizzle-orm';
import type { Database } from '../client';
import { buckets } from '../schema/buckets';
import { heartbeats } from '../schema/heartbeats';
import { sessions } from '../schema/sessions';

const COST_MICRO_UNITS = 1_000_000n;
const MAX_SAFE_TOKEN_TOTAL = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_SAFE_COST_MICROS = BigInt(Number.MAX_SAFE_INTEGER);
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEZONE_RANGE_PADDING_MS = 36 * 60 * 60 * 1000;

export interface RecordHeartbeatInput {
  source: string;
  model: string | null;
  project: string;
  hostname: string;
  lastSeenAt: Date;
}

export interface NowActivityQueryOptions {
  timezone?: string;
  now?: Date;
}

export interface NowActivityInfo {
  lastActiveAt: Date | null;
  currentSource: string | null;
  currentModel: string | null;
  todayTokens: number;
  todayEstimatedCostUsd: number;
  generatedAt: string;
}

export async function recordHeartbeat(db: Database, input: RecordHeartbeatInput): Promise<void> {
  await db.insert(heartbeats).values(input);
}

export async function getNowActivity(
  db: Database,
  options: NowActivityQueryOptions = {},
): Promise<NowActivityInfo> {
  const timezone = options.timezone ?? 'UTC';
  const now = options.now ?? new Date();
  const todayKey = toLocalDateKey(now, timezone);
  const utcDayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rangeStart = new Date(utcDayStartMs - TIMEZONE_RANGE_PADDING_MS);
  const rangeEnd = new Date(utcDayStartMs + DAY_MS + TIMEZONE_RANGE_PADDING_MS);

  const [latestHeartbeatRows, latestBucketRows, latestSessionRows, todayRows] = await Promise.all([
    db
      .select({
        at: heartbeats.lastSeenAt,
        source: heartbeats.source,
        model: heartbeats.model,
      })
      .from(heartbeats)
      .orderBy(desc(heartbeats.lastSeenAt))
      .limit(1),
    db
      .select({
        at: buckets.bucketStart,
        source: buckets.source,
        model: buckets.model,
      })
      .from(buckets)
      .orderBy(desc(buckets.bucketStart))
      .limit(1),
    db
      .select({
        at: sessions.lastMessageAt,
        source: sessions.source,
      })
      .from(sessions)
      .orderBy(desc(sessions.lastMessageAt))
      .limit(1),
    db
      .select({
        bucketStart: buckets.bucketStart,
        totalTokens: buckets.totalTokens,
        costUsd: buckets.costUsd,
      })
      .from(buckets)
      .where(and(gte(buckets.bucketStart, rangeStart), lt(buckets.bucketStart, rangeEnd))),
  ]);

  const latest = pickLatest([
    latestHeartbeatRows[0]
      ? {
          at: latestHeartbeatRows[0].at,
          source: latestHeartbeatRows[0].source,
          model: latestHeartbeatRows[0].model ?? null,
        }
      : null,
    latestBucketRows[0] ?? null,
    latestSessionRows[0]
      ? {
          at: latestSessionRows[0].at,
          source: latestSessionRows[0].source,
          model: null,
        }
      : null,
  ]);

  let tokens = 0n;
  let costMicros = 0n;
  for (const row of todayRows) {
    if (toLocalDateKey(row.bucketStart, timezone) !== todayKey) continue;
    tokens += toBigInt(row.totalTokens ?? 0n, 'Today token total');
    costMicros += parseUsdMicros(String(row.costUsd ?? '0'));
  }

  if (tokens > MAX_SAFE_TOKEN_TOTAL) {
    throw new RangeError('Today token total exceeds Number.MAX_SAFE_INTEGER');
  }
  if (costMicros > MAX_SAFE_COST_MICROS || costMicros < -MAX_SAFE_COST_MICROS) {
    throw new RangeError('Today estimated cost total exceeds Number.MAX_SAFE_INTEGER micros');
  }

  return {
    lastActiveAt: latest?.at ?? null,
    currentSource: latest?.source ?? null,
    currentModel: latest?.model ?? null,
    todayTokens: Number(tokens),
    todayEstimatedCostUsd: Number(costMicros) / Number(COST_MICRO_UNITS),
    generatedAt: now.toISOString(),
  };
}

function pickLatest(
  rows: Array<{ at: Date; source: string; model: string | null } | null>,
): { at: Date; source: string; model: string | null } | null {
  return (
    rows
      .filter((row): row is { at: Date; source: string; model: string | null } => row !== null)
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null
  );
}

function parseUsdMicros(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{0,6}))?$/.exec(value);
  if (!match) {
    throw new RangeError('Cost USD must be a decimal value with at most 6 fractional digits');
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2] ?? '0');
  const fraction = BigInt((match[3] ?? '').padEnd(6, '0'));
  return sign * (whole * COST_MICRO_UNITS + fraction);
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
