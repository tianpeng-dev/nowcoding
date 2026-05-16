import { describe, expect, it } from 'vitest';
import {
  estimateTimeSavedMinutes,
  formatTimeSaved,
  highlightedMilestone,
  peakActivityWindow,
} from '../src/engagement';

describe('estimateTimeSavedMinutes', () => {
  it('uses output tokens and request count with an active-day cap', () => {
    expect(
      estimateTimeSavedMinutes({
        outputTokens: 10_000,
        requestCount: 5,
        activeDays: 1,
      }),
    ).toBe(70);

    expect(
      estimateTimeSavedMinutes({
        outputTokens: 1_000_000,
        requestCount: 10_000,
        activeDays: 1,
      }),
    ).toBe(960);
  });

  it('treats missing request counts as one when output exists', () => {
    expect(estimateTimeSavedMinutes({ outputTokens: 1_000, activeDays: 1 })).toBe(8);
    expect(estimateTimeSavedMinutes({ outputTokens: 0, activeDays: 1 })).toBe(0);
  });

  it('treats zero request counts as one when output exists', () => {
    expect(
      estimateTimeSavedMinutes({
        outputTokens: 1_000,
        requestCount: 0,
        activeDays: 1,
      }),
    ).toBe(8);
  });

  it('normalizes nonfinite active days to zero saved minutes', () => {
    expect(
      estimateTimeSavedMinutes({
        outputTokens: 1_000,
        requestCount: 1,
        activeDays: Number.NaN,
      }),
    ).toBe(0);

    expect(
      estimateTimeSavedMinutes({
        outputTokens: 1_000,
        requestCount: 1,
        activeDays: Number.POSITIVE_INFINITY,
      }),
    ).toBe(0);
  });

  it('does not produce negative saved minutes for negative token or request counts', () => {
    expect(
      estimateTimeSavedMinutes({
        outputTokens: -1_000,
        requestCount: 5,
        activeDays: 1,
      }),
    ).toBe(10);

    expect(
      estimateTimeSavedMinutes({
        outputTokens: 1_000,
        requestCount: -5,
        activeDays: 1,
      }),
    ).toBe(8);

    expect(
      estimateTimeSavedMinutes({
        outputTokens: -1_000,
        requestCount: -5,
        activeDays: 1,
      }),
    ).toBe(0);
  });

  it('formats labels as estimated values', () => {
    expect(formatTimeSaved(0)).toBe('~0 hrs');
    expect(formatTimeSaved(38)).toBe('~38 min');
    expect(formatTimeSaved(90)).toBe('~2 hrs');
    expect(formatTimeSaved(7_440)).toBe('~124 hrs');
  });
});

describe('peakActivityWindow', () => {
  it('finds the strongest three-hour window with wraparound formatting', () => {
    const hours = Array.from({ length: 24 }, () => 0);
    hours[23] = 4;
    hours[0] = 5;
    hours[1] = 3;

    expect(peakActivityWindow(hours)).toEqual({
      startHour: 23,
      endHour: 2,
      label: '23:00 - 02:00',
    });
  });

  it('returns null for empty histograms', () => {
    expect(peakActivityWindow(Array.from({ length: 24 }, () => 0))).toBeNull();
  });
});

describe('highlightedMilestone', () => {
  it('prefers streak over time saved and token milestones', () => {
    expect(
      highlightedMilestone({
        totalTokens: 600_000_000,
        currentStreak: 14,
        activeDays30d: 20,
        timeSavedMinutes: 500 * 60,
        distinctSources30d: 5,
        peakActivityStartHour: 23,
        peakActivityActiveDays30d: 8,
      }),
    ).toBe('14 DAY STREAK');
  });

  it('supports token milestones from 10M through 100B', () => {
    expect(highlightedMilestone({ totalTokens: 9_999_999 })).toBeNull();
    expect(highlightedMilestone({ totalTokens: 10_000_000 })).toBe('10M TOKENS');
    expect(highlightedMilestone({ totalTokens: 100_000_000_000 })).toBe('100B TOKENS');
  });

  it('prefers time saved over token milestones', () => {
    expect(
      highlightedMilestone({
        totalTokens: 100_000_000_000,
        timeSavedMinutes: 6_000,
      }),
    ).toBe('100H SAVED');
  });

  it('prefers token milestones over live rhythm', () => {
    expect(
      highlightedMilestone({
        totalTokens: 500_000_000,
        activeDays30d: 30,
      }),
    ).toBe('500M TOKENS');
  });

  it('prefers live rhythm over tool diversity', () => {
    expect(
      highlightedMilestone({
        activeDays30d: 20,
        distinctSources30d: 10,
      }),
    ).toBe('20 ACTIVE DAYS');
  });

  it('prefers tool diversity over peak activity personas', () => {
    expect(
      highlightedMilestone({
        distinctSources30d: 5,
        peakActivityStartHour: 23,
        peakActivityActiveDays30d: 8,
      }),
    ).toBe('5 TOOL POLYGLOT');
  });

  it('returns peak activity persona milestones', () => {
    expect(
      highlightedMilestone({
        peakActivityStartHour: 23,
        peakActivityActiveDays30d: 8,
      }),
    ).toBe('NIGHT OWL');

    expect(
      highlightedMilestone({
        peakActivityStartHour: 6,
        peakActivityActiveDays30d: 8,
      }),
    ).toBe('EARLY BIRD');
  });
});
