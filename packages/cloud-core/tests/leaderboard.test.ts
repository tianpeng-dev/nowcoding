import { describe, expect, it } from 'vitest';
import {
  estimateAcceptedBucketActiveSeconds,
  leaderboardSnapshotCleanupMode,
  rankLeaderboardRows,
  scoreLeaderboardRow,
} from '../src/leaderboard';

describe('scoreLeaderboardRow', () => {
  it('scores token, cost, active time, streak, and time saved metrics', () => {
    const row = {
      totalTokens: 123,
      costUsd: 4,
      activeSeconds: 5,
      currentStreak: 6,
      timeSavedMinutes: 78,
    };

    expect(scoreLeaderboardRow({ ...row, metric: 'tokens' })).toBe(123);
    expect(scoreLeaderboardRow({ ...row, metric: 'estimated_cost' })).toBe(4);
    expect(scoreLeaderboardRow({ ...row, metric: 'active_time' })).toBe(5);
    expect(scoreLeaderboardRow({ ...row, metric: 'streak' })).toBe(6);
    expect(scoreLeaderboardRow({ ...row, metric: 'time_saved' })).toBe(78);
  });
});

describe('estimateAcceptedBucketActiveSeconds', () => {
  it('uses only matching accepted bucket activity', () => {
    expect(
      estimateAcceptedBucketActiveSeconds({
        buckets: [
          { matchesScope: true, requestCount: 3 },
          { matchesScope: false, requestCount: 20 },
          { matchesScope: true, requestCount: 0 },
        ],
      }),
    ).toBe(240);
  });
});

describe('rankLeaderboardRows', () => {
  it('uses competition ranks for tied scores', () => {
    expect(
      rankLeaderboardRows([
        { userId: 'b', score: 100 },
        { userId: 'a', score: 100 },
        { userId: 'c', score: 90 },
      ]),
    ).toEqual([
      { userId: 'a', score: 100, rank: 1 },
      { userId: 'b', score: 100, rank: 1 },
      { userId: 'c', score: 90, rank: 3 },
    ]);
  });
});

describe('leaderboardSnapshotCleanupMode', () => {
  it('clears existing board rows when a regeneration produces no rows', () => {
    expect(leaderboardSnapshotCleanupMode(0)).toBe('delete_existing');
    expect(leaderboardSnapshotCleanupMode(2)).toBe('delete_older');
  });
});
