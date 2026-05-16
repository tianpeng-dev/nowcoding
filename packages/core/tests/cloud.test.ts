import { describe, expect, it } from 'vitest';
import {
  arenaConsentSchema,
  deviceTokenSchema,
  formatPublicLeaderboardValue,
  leaderboardMetricSchema,
  leaderboardQuerySchema,
} from '../src/cloud';

describe('cloud arena protocol', () => {
  it('accepts device tokens with the development prefix and rejects live tokens', () => {
    const token = `nc_dev_${'A'.repeat(43)}`;

    expect(deviceTokenSchema.parse(token)).toBe(token);
    expect(() => deviceTokenSchema.parse(`nc_live_${'A'.repeat(32)}`)).toThrow();
  });

  it('accepts arena consent with default public profile fields', () => {
    const acceptedAt = '2026-05-15T09:00:00.000Z';

    expect(
      arenaConsentSchema.parse({
        joined: true,
        acceptedAt,
      }),
    ).toEqual({
      joined: true,
      acceptedAt,
      publicFields: ['username', 'avatarUrl', 'estimatedCost', 'tokens', 'activeTime', 'streak'],
    });
  });

  it('defaults leaderboard query range and scope while accepting token metric filters', () => {
    expect(leaderboardQuerySchema.parse({ metric: 'tokens' })).toEqual({
      range: '30d',
      scope: 'all',
      metric: 'tokens',
    });

    expect(
      leaderboardQuerySchema.parse({
        range: '30d',
        scope: 'source:codex',
        metric: 'tokens',
      }),
    ).toEqual({
      range: '30d',
      scope: 'source:codex',
      metric: 'tokens',
    });
  });

  it('formats public leaderboard values with public caps and units', () => {
    expect(formatPublicLeaderboardValue({ metric: 'tokens', value: 2_100_000_000 })).toBe('2B+');
    expect(formatPublicLeaderboardValue({ metric: 'tokens', value: 1_500_000 })).toBe('1.5M');
    expect(formatPublicLeaderboardValue({ metric: 'estimated_cost', value: 25_000 })).toBe(
      '$20,000+',
    );
    expect(formatPublicLeaderboardValue({ metric: 'estimated_cost', value: 1234.56 })).toBe(
      '$1,234.56',
    );
    expect(formatPublicLeaderboardValue({ metric: 'active_time', value: 5400 })).toBe('1.5h');
    expect(formatPublicLeaderboardValue({ metric: 'active_time', value: 3661 })).toBe('1.0h');
    expect(formatPublicLeaderboardValue({ metric: 'streak', value: 42 })).toBe('42d');
  });

  it('accepts and formats time saved leaderboard values', () => {
    expect(leaderboardMetricSchema.parse('time_saved')).toBe('time_saved');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 124 * 60 })).toBe('124h');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 38 })).toBe('38m');
  });
});
