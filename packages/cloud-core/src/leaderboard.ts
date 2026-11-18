import type { LeaderboardMetric } from '@nowcoding/core/cloud';

export type LeaderboardScoreInput = {
  metric: LeaderboardMetric;
  totalTokens: number;
  costUsd: number;
  activeSeconds: number;
  currentStreak: number;
  timeSavedMinutes: number;
};

export type AcceptedBucketActiveSecondsInput = {
  buckets: readonly {
    matchesScope: boolean;
    requestCount?: unknown;
  }[];
  secondsPerRequest?: number;
  maxSecondsPerBucket?: number;
};

export type RankableLeaderboardRow = {
  score: number;
  userId: string;
};

export type LeaderboardSnapshotCleanupMode = 'delete_existing' | 'delete_older';

function bucketActivityWeight(requestCount: unknown): number {
  const value =
    typeof requestCount === 'bigint'
      ? Number(requestCount)
      : typeof requestCount === 'number'
        ? requestCount
        : typeof requestCount === 'string'
          ? Number(requestCount)
          : 0;

  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function estimateAcceptedBucketActiveSeconds({
  buckets,
  secondsPerRequest = 60,
  maxSecondsPerBucket = 3600,
}: AcceptedBucketActiveSecondsInput): number {
  let activeSeconds = 0;

  for (const bucket of buckets) {
    if (!bucket.matchesScope) {
      continue;
    }

    // Sessions do not carry model data, so scoped active_time uses accepted
    // bucket activity only: request count when present, bucket presence when not.
    activeSeconds += Math.min(
      bucketActivityWeight(bucket.requestCount) * secondsPerRequest,
      maxSecondsPerBucket,
    );
  }

  return activeSeconds;
}

export function rankLeaderboardRows<T extends RankableLeaderboardRow>(
  rows: readonly T[],
): (T & { rank: number })[] {
  let previousScore: number | null = null;
  let previousRank = 0;

  return [...rows]
    .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
    .map((row, index) => {
      const rank = previousScore === row.score ? previousRank : index + 1;

      previousScore = row.score;
      previousRank = rank;

      return { ...row, rank };
    });
}

export function leaderboardSnapshotCleanupMode(
  generatedRowCount: number,
): LeaderboardSnapshotCleanupMode {
  return generatedRowCount > 0 ? 'delete_older' : 'delete_existing';
}

export function scoreLeaderboardRow(input: LeaderboardScoreInput): number {
  switch (input.metric) {
    case 'estimated_cost':
      return input.costUsd;
    case 'active_time':
      return input.activeSeconds;
    case 'streak':
      return input.currentStreak;
    case 'time_saved':
      return input.timeSavedMinutes;
    case 'tokens':
      return input.totalTokens;
  }

  const exhaustive: never = input.metric;
  return exhaustive;
}
