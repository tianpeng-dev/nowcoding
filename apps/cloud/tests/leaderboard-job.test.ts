import { describe, expect, it } from 'vitest';
import {
  estimateAcceptedBucketTimeSavedMinutesForLeaderboard,
  leaderboardJobMetrics,
} from '../lib/leaderboard-metrics';

describe('leaderboard job time saved metric', () => {
  it('includes time_saved in the generated job metrics', () => {
    expect(leaderboardJobMetrics()).toContain('time_saved');
  });

  it('estimates minutes from accepted bucket completion tokens and requests', () => {
    expect(
      estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
        completionTokens: '10',
        requestCount: '2',
        activeDays: 1,
      }),
    ).toBe(4);
  });

  it('caps estimated minutes by active days', () => {
    expect(
      estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
        completionTokens: 1_000_000,
        requestCount: 0,
        activeDays: 1,
      }),
    ).toBe(16 * 60);
  });

  it('handles zero and invalid inputs safely', () => {
    expect(
      estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
        completionTokens: 0,
        requestCount: 0,
        activeDays: 1,
      }),
    ).toBe(0);
    expect(
      estimateAcceptedBucketTimeSavedMinutesForLeaderboard({
        completionTokens: Number.NaN,
        requestCount: 'not-a-number',
        activeDays: Number.POSITIVE_INFINITY,
      }),
    ).toBe(0);
  });
});
