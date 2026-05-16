import { describe, expect, it } from 'vitest';
import { streakBadgeData } from '../lib/streak-badge';

describe('streak badge data', () => {
  it('formats a zero streak without placeholder text', () => {
    expect(
      streakBadgeData('peng', { current: 0, longest: 0, lastActiveDate: null }, 'light'),
    ).toEqual({
      label: 'peng · streak',
      value: '0d',
      theme: 'light',
    });
  });

  it('formats current streak as compact days', () => {
    expect(
      streakBadgeData('peng', { current: 1, longest: 4, lastActiveDate: '2026-05-13' }, 'dark')
        .value,
    ).toBe('1d');
    expect(
      streakBadgeData('peng', { current: 3, longest: 4, lastActiveDate: '2026-05-13' }, 'dark')
        .value,
    ).toBe('3d');
  });
});
