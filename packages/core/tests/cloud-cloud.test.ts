import { describe, expect, it } from 'vitest';
import { formatPublicLeaderboardValue } from '../src/cloud';

describe('formatPublicLeaderboardValue', () => {
  it('formats time saved as minutes under an hour and rounded hours otherwise', () => {
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 38 })).toBe('38m');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 90 })).toBe('2h');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 124 * 60 })).toBe('124h');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: 74_400 })).toBe('1,240h');
  });

  it('normalizes nonfinite and negative time saved values to zero minutes', () => {
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: -5 })).toBe('0m');
    expect(formatPublicLeaderboardValue({ metric: 'time_saved', value: Number.NaN })).toBe('0m');
    expect(
      formatPublicLeaderboardValue({
        metric: 'time_saved',
        value: Number.POSITIVE_INFINITY,
      }),
    ).toBe('0m');
  });
});
