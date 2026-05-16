import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  computeStreakFromInstants,
  computeStreakFromLocalDays,
} from '../src/streak';

describe('computeStreak', () => {
  it('empty input → zero', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0, lastActiveDate: null });
  });

  it('today + 6 prior days → current=7, longest=7', () => {
    const today = new Date('2026-05-08T12:00:00Z');
    const days = [
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ];
    expect(computeStreak(days, today)).toEqual({
      current: 7,
      longest: 7,
      lastActiveDate: '2026-05-08',
    });
  });

  it('last active = yesterday → current still counts', () => {
    const today = new Date('2026-05-08T12:00:00Z');
    expect(computeStreak(['2026-05-06', '2026-05-07'], today)).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-07',
    });
  });

  it('last active = 2 days ago → current=0', () => {
    const today = new Date('2026-05-08T12:00:00Z');
    expect(computeStreak(['2026-05-05', '2026-05-06'], today)).toEqual({
      current: 0,
      longest: 2,
      lastActiveDate: '2026-05-06',
    });
  });

  it('non-contiguous days → longest only counts contiguous run', () => {
    const today = new Date('2026-05-08T12:00:00Z');
    expect(computeStreak(['2026-05-01', '2026-05-02', '2026-05-04', '2026-05-08'], today)).toEqual({
      current: 1,
      longest: 2,
      lastActiveDate: '2026-05-08',
    });
  });
});

describe('computeStreakFromInstants', () => {
  it('uses owner timezone day boundaries', () => {
    const now = new Date('2026-05-14T02:00:00.000Z');
    const instants = [new Date('2026-05-12T16:30:00.000Z'), new Date('2026-05-13T16:30:00.000Z')];

    expect(computeStreakFromInstants(instants, 'Asia/Shanghai', now)).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-14',
    });
    expect(computeStreakFromInstants(instants, 'UTC', now)).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-13',
    });
  });

  it('recomputes longest streak when a historical missing day is backfilled', () => {
    const now = new Date('2026-05-14T12:00:00.000Z');
    const beforeBackfill = [
      new Date('2026-05-10T10:00:00.000Z'),
      new Date('2026-05-11T10:00:00.000Z'),
      new Date('2026-05-13T10:00:00.000Z'),
      new Date('2026-05-14T10:00:00.000Z'),
    ];
    const afterBackfill = [...beforeBackfill, new Date('2026-05-12T10:00:00.000Z')];

    expect(computeStreakFromInstants(beforeBackfill, 'UTC', now)).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-14',
    });
    expect(computeStreakFromInstants(afterBackfill, 'UTC', now)).toEqual({
      current: 5,
      longest: 5,
      lastActiveDate: '2026-05-14',
    });
  });
});

describe('computeStreakFromLocalDays', () => {
  it('rejects invalid today keys before computing', () => {
    expect(() => computeStreakFromLocalDays(['2026-05-13'], '2026-02-30')).toThrow(RangeError);
    expect(() => computeStreakFromLocalDays(['2026-05-13'], '2026-5-13')).toThrow(RangeError);
  });

  it('rejects invalid active day keys before sorting', () => {
    expect(() => computeStreakFromLocalDays(['2026-05-13', '2026-02-30'], '2026-05-14')).toThrow(
      RangeError,
    );
    expect(() => computeStreakFromLocalDays(['not-a-date'], '2026-05-14')).toThrow(RangeError);
  });
});
