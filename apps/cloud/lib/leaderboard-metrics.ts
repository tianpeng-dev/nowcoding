import { estimateTimeSavedMinutes } from '@nowcoding/core';
import type { LeaderboardMetric } from '@nowcoding/core/cloud';
export const METRICS = [
  'estimated_cost',
  'tokens',
  'active_time',
  'streak',
  'time_saved',
] as const satisfies readonly LeaderboardMetric[];

export function leaderboardJobMetrics(): readonly LeaderboardMetric[] {
  return METRICS;
}

export function scoreNumber(value: unknown): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
  completionTokens,
  requestCount,
  activeDays,
}: {
  completionTokens: unknown;
  requestCount: unknown;
  activeDays: unknown;
}): number {
  return estimateTimeSavedMinutes({
    outputTokens: scoreNumber(completionTokens),
    requestCount: scoreNumber(requestCount),
    activeDays: scoreNumber(activeDays),
  });
}
