import { describe, expect, it } from 'vitest';
import { buildUsageDashboardView } from '../lib/usage-dashboard';

const baseStats = {
  period: '7d' as const,
  totalTokens: 125_400,
  inputTokens: 75_000,
  outputTokens: 50_400,
  sessionCount: 6,
  activeSeconds: 9_300,
  estimatedCostUsd: 12.345,
  costLabel: 'estimated' as const,
  topModel: { name: 'claude-sonnet-4-6', share: 0.72 },
  topSource: { name: 'claude-code', share: 0.9 },
  topProject: null,
  modelDistribution: [{ name: 'claude-sonnet-4-6', tokens: 125_400, share: 0.72 }],
  sourceDistribution: [{ name: 'claude-code', tokens: 125_400, share: 0.9 }],
  streak: { current: 3, longest: 9, lastActiveDate: '2026-05-20' },
  sparkline: [1000, 2000, 3000],
  generatedAt: '2026-05-20T12:00:00.000Z',
};

describe('usage dashboard view', () => {
  it('builds secondary usage cards from public stats', () => {
    expect(buildUsageDashboardView(baseStats)).toEqual({
      title: 'Usage details',
      description: 'A deeper breakdown behind your public NowCoding presence.',
      period: '7d',
      cards: [
        { label: 'Tokens', value: '125.4K', detail: '7d total' },
        { label: 'Estimated cost', value: '$12.35', detail: 'estimated' },
        { label: 'Active time', value: '2h 35m', detail: '6 sessions' },
        { label: 'Top model', value: 'claude-sonnet-4-6', detail: '72% share' },
      ],
    });
  });

  it('hides cost when cost is private and falls back when no model is present', () => {
    const view = buildUsageDashboardView({
      ...baseStats,
      estimatedCostUsd: null,
      costLabel: 'hidden',
      topModel: null,
      activeSeconds: 40,
      sessionCount: 0,
    });

    expect(view.cards).toEqual([
      { label: 'Tokens', value: '125.4K', detail: '7d total' },
      { label: 'Estimated cost', value: 'Hidden', detail: 'hidden' },
      { label: 'Active time', value: '0m', detail: '0 sessions' },
      { label: 'Top model', value: 'None', detail: '0% share' },
    ]);
  });
});
