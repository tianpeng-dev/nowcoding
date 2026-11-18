import {
  estimateAcceptedBucketActiveSeconds,
  leaderboardSnapshotCleanupMode,
  rankLeaderboardRows,
  scoreLeaderboardRow,
} from '@nowcoding/cloud-core';
import { arenaConsents, getDb, leaderboardEntries, usageBuckets, users } from '@nowcoding/cloud-db';
import { type LeaderboardMetric, formatPublicLeaderboardValue } from '@nowcoding/core/cloud';
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  METRICS,
  estimateAcceptedBucketTimeSavedMinutesForLeaderboard,
  scoreNumber,
} from '../../../../lib/leaderboard-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RANGES = ['1d', '7d', '30d'] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
};
type RangeName = (typeof RANGES)[number];
type ScopeAggregate = {
  userId: string;
  totalTokens: number;
  costUsd: number;
  activeSeconds: number;
  currentStreak: number;
  timeSavedMinutes: number;
};
type BucketRow = {
  userId: string;
  source: string;
  model: string;
  bucketStart: Date;
  completionTokens: unknown;
  totalTokens: unknown;
  costUsd: unknown;
  requestCount: unknown;
};
function bearerSecret(authorization: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  return match?.[1]?.trim() || null;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  return (
    bearerSecret(request.headers.get('authorization')) === cronSecret ||
    request.nextUrl.searchParams.get('secret') === cronSecret
  );
}

function normalizeScopePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'unknown';
}

function modelFamily(model: string): string {
  return normalizeScopePart(model.split(/[/: -]+/)[0] ?? 'unknown');
}

function rangeStart(range: RangeName, now: Date): Date {
  return new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
}

function previousDateKey(dateKey: string): string {
  return new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function currentUtcStreak(dateKeys: Set<string>, now: Date): number {
  if (dateKeys.size === 0) {
    return 0;
  }

  const [latest] = Array.from(dateKeys).sort().reverse();
  const today = now.toISOString().slice(0, 10);
  const yesterday = previousDateKey(today);

  if (latest !== today && latest !== yesterday) {
    return 0;
  }

  let cursor = latest;
  let streak = 0;

  while (dateKeys.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

function bucketMatchesScope(row: BucketRow, scope: string): boolean {
  if (scope === 'all') {
    return true;
  }

  const [kind, value] = scope.split(':');

  if (kind === 'source') {
    return normalizeScopePart(row.source) === value;
  }

  if (kind === 'model_family') {
    return modelFamily(row.model) === value;
  }

  return false;
}

function aggregateScope(bucketRows: BucketRow[], scope: string, now: Date): ScopeAggregate[] {
  const byUser = new Map<
    string,
    ScopeAggregate & {
      activeDateKeys: Set<string>;
      outputTokens: number;
      requestCount: number;
    }
  >();

  for (const row of bucketRows) {
    if (!bucketMatchesScope(row, scope)) {
      continue;
    }

    const aggregate = byUser.get(row.userId) ?? {
      userId: row.userId,
      totalTokens: 0,
      costUsd: 0,
      activeSeconds: 0,
      currentStreak: 0,
      timeSavedMinutes: 0,
      activeDateKeys: new Set<string>(),
      outputTokens: 0,
      requestCount: 0,
    };

    aggregate.totalTokens += scoreNumber(row.totalTokens);
    aggregate.costUsd += scoreNumber(row.costUsd);
    aggregate.outputTokens += scoreNumber(row.completionTokens);
    aggregate.requestCount += scoreNumber(row.requestCount);
    aggregate.activeSeconds += estimateAcceptedBucketActiveSeconds({
      buckets: [{ matchesScope: true, requestCount: row.requestCount }],
    });
    aggregate.activeDateKeys.add(row.bucketStart.toISOString().slice(0, 10));
    byUser.set(row.userId, aggregate);
  }

  return Array.from(byUser.values()).map(
    ({ activeDateKeys, outputTokens, requestCount, ...aggregate }) => ({
      ...aggregate,
      currentStreak: currentUtcStreak(activeDateKeys, now),
      timeSavedMinutes: estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
        completionTokens: outputTokens,
        requestCount,
        activeDays: activeDateKeys.size,
      }),
    }),
  );
}

async function currentScopes(): Promise<string[]> {
  const rows = await getDb()
    .select({
      source: usageBuckets.source,
      model: usageBuckets.model,
    })
    .from(usageBuckets);

  const scopes = new Set<string>(['all']);

  for (const row of rows) {
    scopes.add(`source:${normalizeScopePart(row.source)}`);
    scopes.add(`model_family:${modelFamily(row.model)}`);
  }

  return Array.from(scopes).sort((a, b) => {
    if (a === 'all') {
      return -1;
    }
    if (b === 'all') {
      return 1;
    }
    return a.localeCompare(b);
  });
}

async function rangeRows(range: RangeName, now: Date) {
  const start = rangeStart(range, now);
  const db = getDb();
  const bucketRows = await db
    .select({
      userId: usageBuckets.userId,
      source: usageBuckets.source,
      model: usageBuckets.model,
      bucketStart: usageBuckets.bucketStart,
      completionTokens: usageBuckets.completionTokens,
      totalTokens: usageBuckets.totalTokens,
      costUsd: usageBuckets.costUsd,
      requestCount: usageBuckets.requestCount,
    })
    .from(usageBuckets)
    .innerJoin(users, eq(users.id, usageBuckets.userId))
    .innerJoin(arenaConsents, eq(arenaConsents.userId, usageBuckets.userId))
    .where(
      and(
        eq(arenaConsents.joined, true),
        isNull(users.hiddenAt),
        isNull(usageBuckets.excludedFromArenaAt),
        gte(usageBuckets.bucketStart, start),
      ),
    );
  return { bucketRows };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const generatedAt = now;
  const db = getDb();
  const scopes = await currentScopes();
  let inserted = 0;

  for (const range of RANGES) {
    const { bucketRows } = await rangeRows(range, now);

    for (const scope of scopes) {
      const aggregates = aggregateScope(bucketRows, scope, now);

      for (const metric of METRICS) {
        const rankedRows = rankLeaderboardRows(
          aggregates
            .map((aggregate) => ({
              ...aggregate,
              score: scoreLeaderboardRow({ ...aggregate, metric }),
            }))
            .filter((row) => row.score > 0),
        ).map((row) => ({
          range,
          scope,
          metric,
          userId: row.userId,
          score: row.score.toString(),
          publicValue: formatPublicLeaderboardValue({
            metric,
            value: row.score,
          }),
          rank: row.rank,
          generatedAt,
        }));

        const cleanupMode = leaderboardSnapshotCleanupMode(rankedRows.length);

        if (cleanupMode === 'delete_older') {
          await db.insert(leaderboardEntries).values(rankedRows);
          inserted += rankedRows.length;

          await db
            .delete(leaderboardEntries)
            .where(
              and(
                eq(leaderboardEntries.range, range),
                eq(leaderboardEntries.scope, scope),
                eq(leaderboardEntries.metric, metric),
                lt(leaderboardEntries.generatedAt, generatedAt),
              ),
            );
        } else {
          await db
            .delete(leaderboardEntries)
            .where(
              and(
                eq(leaderboardEntries.range, range),
                eq(leaderboardEntries.scope, scope),
                eq(leaderboardEntries.metric, metric),
              ),
            );
        }
      }
    }
  }

  return NextResponse.json({
    generatedAt: generatedAt.toISOString(),
    ranges: RANGES,
    scopes: scopes.length,
    metrics: METRICS,
    inserted,
  });
}
