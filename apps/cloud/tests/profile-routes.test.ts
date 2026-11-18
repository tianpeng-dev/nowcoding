import { describe, expect, test } from 'vitest';
import { clampLabel, formatCompactTokenTotal } from '../lib/card-labels';
import {
  buildProfileSparkline,
  buildPublicCost,
  formatCloudTimeSaved,
  getCurrentStreakFromLocalDates,
  isLocalDateInYear,
  localDateKey,
  localHourOfDay,
  selectProfileMilestone,
  tokenTotalToString,
} from '../lib/profile-data';
import { buildOfficialProfileUrls } from '../lib/profile-urls';

describe('buildOfficialProfileUrls', () => {
  test('builds official profile, card, and badge URLs', () => {
    expect(buildOfficialProfileUrls('peng')).toEqual({
      profile: 'https://nowcoding.cc/u/peng',
      card: 'https://nowcoding.cc/u/peng/card.svg',
      badges: {
        today: 'https://nowcoding.cc/u/peng/badge/today.svg',
        week: 'https://nowcoding.cc/u/peng/badge/week.svg',
        total: 'https://nowcoding.cc/u/peng/badge/total.svg',
        model: 'https://nowcoding.cc/u/peng/badge/model.svg',
        streak: 'https://nowcoding.cc/u/peng/badge/streak.svg',
        live: 'https://nowcoding.cc/u/peng/badge/live.svg',
      },
    });
  });
});

describe('public profile data helpers', () => {
  test('hides public cost until explicit consent exists', () => {
    expect(buildPublicCost('12.345678')).toBeNull();
  });

  test('keeps large token totals as exact strings', () => {
    expect(tokenTotalToString('90071992547409931234')).toBe('90071992547409931234');
    expect(tokenTotalToString(BigInt('90071992547409931234'))).toBe('90071992547409931234');
  });

  test('formats cloud time saved via engagement helper', () => {
    expect(formatCloudTimeSaved(38)).toBe('~38 min');
    expect(formatCloudTimeSaved(124 * 60)).toBe('~124 hrs');
  });

  test('selects token milestone from exact token totals', () => {
    expect(selectProfileMilestone({ totalTokens: '100000000000' })).toBe('100B TOKENS');
  });

  test('builds fixed seven-day sparklines with zero-filled missing days', () => {
    expect(
      buildProfileSparkline(
        [
          {
            bucketStart: new Date('2026-05-09T00:00:00.000Z'),
            totalTokens: '12',
          },
          {
            bucketStart: new Date('2026-05-11T12:00:00.000Z'),
            totalTokens: 34,
          },
          {
            bucketStart: new Date('2026-05-11T18:00:00.000Z'),
            totalTokens: 6n,
          },
          {
            bucketStart: new Date('2026-05-15T23:00:00.000Z'),
            totalTokens: '78',
          },
        ],
        'UTC',
        new Date('2026-05-15T12:00:00.000Z'),
      ),
    ).toEqual([
      { date: '2026-05-09', totalTokens: '12' },
      { date: '2026-05-10', totalTokens: '0' },
      { date: '2026-05-11', totalTokens: '40' },
      { date: '2026-05-12', totalTokens: '0' },
      { date: '2026-05-13', totalTokens: '0' },
      { date: '2026-05-14', totalTokens: '0' },
      { date: '2026-05-15', totalTokens: '78' },
    ]);
  });

  test('computes local date keys in the requested timezone', () => {
    const date = new Date('2026-01-01T02:00:00.000Z');

    expect(localDateKey(date, 'America/Los_Angeles')).toBe('2025-12-31');
    expect(localDateKey(date, 'Asia/Shanghai')).toBe('2026-01-01');
  });

  test('computes local hours for non-UTC profile activity', () => {
    const date = new Date('2026-05-15T23:30:00.000Z');

    expect(localHourOfDay(date, 'UTC')).toBe(23);
    expect(localHourOfDay(date, 'Asia/Shanghai')).toBe(7);
  });

  test('filters heatmap dates to the requested local year', () => {
    expect(isLocalDateInYear('2026-12-31', 2026)).toBe(true);
    expect(isLocalDateInYear('2027-01-01', 2026)).toBe(false);
  });

  test('returns zero for stale streaks', () => {
    expect(
      getCurrentStreakFromLocalDates(
        ['2026-01-01', '2025-12-31'],
        'UTC',
        new Date('2026-01-10T12:00:00.000Z'),
      ),
    ).toBe(0);
  });

  test('counts current streak anchored to local today or yesterday', () => {
    expect(
      getCurrentStreakFromLocalDates(
        ['2026-01-09', '2026-01-08', '2026-01-06'],
        'UTC',
        new Date('2026-01-10T12:00:00.000Z'),
      ),
    ).toBe(2);
  });
});

describe('official profile card helpers', () => {
  test('clamps labels within the requested bound', () => {
    expect(clampLabel('abcdefghijklmnop', 10)).toBe('abcdefg...');
    expect(clampLabel('abcdefghijklmnop', 10)).toHaveLength(10);
    expect(clampLabel('abcdef', 3)).toBe('abc');
  });

  test('shortens huge token totals for card layout', () => {
    const full = '123456789012345678901234';
    const compact = formatCompactTokenTotal(full);

    expect(compact.length).toBeLessThan(full.length);
    expect(compact).toBe('123,456,789P');
  });
});
