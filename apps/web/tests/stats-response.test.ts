import { describe, expect, it } from 'vitest';
import { toPublicStatsResponse } from '../lib/stats-response';

const baseStats = {
  period: '7d' as const,
  totalTokens: 1000n,
  inputTokens: 600n,
  outputTokens: 400n,
  cachedInputTokens: 0n,
  reasoningOutputTokens: 0n,
  estimatedCostUsd: '1.25',
  topModel: 'claude-sonnet-4-6',
  topSource: 'claude-code',
  modelDistribution: [{ model: 'claude-sonnet-4-6', tokens: 1000n }],
  sourceDistribution: [{ source: 'claude-code', tokens: 1000n }],
  sparkline: [{ date: '2026-05-13', tokens: 1000n }],
  timeSavedMinutes: 0,
  peakActivity: null,
  milestone: null,
  generatedAt: '2026-05-13T12:00:00.000Z',
};

describe('public stats response', () => {
  it('shows estimated cost when showCost is true', () => {
    expect(
      toPublicStatsResponse(baseStats, true, {
        current: 3,
        longest: 7,
        lastActiveDate: '2026-05-13',
      }),
    ).toMatchObject({
      period: '7d',
      totalTokens: 1000,
      inputTokens: 600,
      outputTokens: 400,
      estimatedCostUsd: 1.25,
      costLabel: 'estimated',
      topModel: { name: 'claude-sonnet-4-6', share: 1 },
      topSource: { name: 'claude-code', share: 1 },
      topProject: null,
      modelDistribution: [{ name: 'claude-sonnet-4-6', tokens: 1000, share: 1 }],
      sourceDistribution: [{ name: 'claude-code', tokens: 1000, share: 1 }],
      sparkline: [1000],
      streak: { current: 3, longest: 7, lastActiveDate: '2026-05-13' },
    });
  });

  it('hides estimated cost when showCost is false', () => {
    expect(toPublicStatsResponse(baseStats, false)).toMatchObject({
      estimatedCostUsd: null,
      costLabel: 'hidden',
    });
  });

  it('converts decimal cost strings without unsafe Number coercion', () => {
    expect(
      toPublicStatsResponse({ ...baseStats, estimatedCostUsd: '1.2345674' }, true),
    ).toMatchObject({
      estimatedCostUsd: 1.234567,
      costLabel: 'estimated',
    });

    expect(
      toPublicStatsResponse({ ...baseStats, estimatedCostUsd: '1.2345675' }, true),
    ).toMatchObject({
      estimatedCostUsd: 1.234568,
      costLabel: 'estimated',
    });
  });

  it('keeps malformed or very large cost strings finite', () => {
    expect(toPublicStatsResponse({ ...baseStats, estimatedCostUsd: 'NaN' }, true)).toMatchObject({
      estimatedCostUsd: 0,
      costLabel: 'estimated',
    });

    const response = toPublicStatsResponse(
      { ...baseStats, estimatedCostUsd: '999999999999999999999999.999999' },
      true,
    );

    expect(response.estimatedCostUsd).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isFinite(response.estimatedCostUsd)).toBe(true);
  });

  it('maps the legacy 1d query period to the public today period', () => {
    expect(toPublicStatsResponse({ ...baseStats, period: '1d' }, true).period).toBe('today');
  });

  it('rejects bigint token totals that cannot be represented safely as numbers', () => {
    expect(() =>
      toPublicStatsResponse({ ...baseStats, totalTokens: 9007199254740993n }, true),
    ).toThrow(RangeError);
  });
});
