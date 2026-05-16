import { describe, expect, it } from 'vitest';
import { buildOgProfileViewData } from '../lib/og-profile';

const owner = {
  displayName: 'Peng',
  bio: 'Building with AI tools',
  githubHandle: 'peng',
};

const stats = {
  period: '7d' as const,
  totalTokens: 1234567n,
  inputTokens: 700000n,
  outputTokens: 534567n,
  cachedInputTokens: 0n,
  reasoningOutputTokens: 0n,
  estimatedCostUsd: '12.345678',
  topModel: 'claude-sonnet-4-6',
  topSource: 'claude-code',
  modelDistribution: [{ model: 'claude-sonnet-4-6', tokens: 1234567n }],
  sourceDistribution: [{ source: 'claude-code', tokens: 1234567n }],
  sparkline: [{ date: '2026-05-14', tokens: 1234567n }],
  timeSavedMinutes: 0,
  peakActivity: null,
  milestone: null,
  generatedAt: '2026-05-14T12:00:00.000Z',
};

const now = {
  status: 'live' as const,
  lastActiveAt: '2026-05-14T11:59:00.000Z',
  currentSource: 'claude-code',
  currentModel: 'claude-sonnet-4-6',
  todayTokens: 1234,
  todayEstimatedCostUsd: 0.123456,
  generatedAt: '2026-05-14T12:00:00.000Z',
};

describe('OG profile view data', () => {
  it('builds profile labels from public stats and live activity', () => {
    const view = buildOgProfileViewData({
      owner,
      stats,
      now,
      streak: { current: 3, longest: 5, lastActiveDate: '2026-05-14' },
      showCost: true,
      type: 'profile',
    });

    expect(view).toMatchObject({
      title: 'Peng',
      subtitle: 'Building with AI tools',
      statusLabel: 'Coding now',
      statusTone: 'live',
      footerSuffix: null,
      isEmpty: false,
      emptyMessage: null,
    });
    expect(view.metrics).toEqual([
      { label: '7-day tokens', value: '1.2M' },
      { label: 'Live', value: 'Coding now', tone: 'live' },
      { label: 'Streak', value: '3d' },
      { label: 'Top model', value: 'claude-sonnet-4-6' },
      { label: 'Top source', value: 'claude-code' },
      { label: 'Estimated cost', value: '$12.35 estimated' },
    ]);
  });

  it('hides cost and unavailable top dimensions when privacy or data requires it', () => {
    const view = buildOgProfileViewData({
      owner,
      stats: { ...stats, topModel: null, topSource: 'unknown' },
      now: {
        ...now,
        status: 'private',
        lastActiveAt: null,
        currentSource: null,
        currentModel: null,
      },
      streak: { current: 0, longest: 5, lastActiveDate: '2026-05-14' },
      showCost: false,
      type: 'profile.png',
    });

    expect(view.statusLabel).toBe('Live hidden');
    expect(view.metrics).toEqual([
      { label: '7-day tokens', value: '1.2M' },
      { label: 'Live', value: 'Live hidden', tone: 'private' },
      { label: 'Streak', value: '0d' },
    ]);
  });

  it('marks empty public activity and keeps old non-profile type suffixes renderable', () => {
    const view = buildOgProfileViewData({
      owner: { displayName: 'Peng' },
      stats: null,
      now: null,
      streak: null,
      showCost: true,
      type: 'legacy-card.png',
    });

    expect(view).toMatchObject({
      subtitle: 'Public NowCoding profile',
      footerSuffix: 'legacy-card',
      isEmpty: true,
      emptyMessage: 'No public coding activity yet',
    });
    expect(view.metrics).toContainEqual({ label: 'Estimated cost', value: '$0.00 estimated' });
  });

  it('clamps public strings for fixed-size OG rendering', () => {
    const view = buildOgProfileViewData({
      owner: {
        displayName: 'Peng'.repeat(30),
        bio: 'Building '.repeat(30),
        githubHandle: 'peng',
      },
      stats: {
        ...stats,
        topModel: 'claude-sonnet-4-6-with-an-unusually-long-provider-suffix',
        topSource: 'claude-code-with-an-unusually-long-source-suffix',
      },
      now,
      streak: { current: 3, longest: 5, lastActiveDate: '2026-05-14' },
      showCost: true,
      type: 'legacy-card-with-an-unusually-long-type-name.png',
    });

    expect(view.title.length).toBeLessThanOrEqual(42);
    expect(view.title.endsWith('…')).toBe(true);
    expect(view.subtitle.length).toBeLessThanOrEqual(96);
    expect(view.footerSuffix?.length).toBeLessThanOrEqual(24);
    const topModel = view.metrics.find((metric) => metric.label === 'Top model')?.value ?? '';
    const topSource = view.metrics.find((metric) => metric.label === 'Top source')?.value ?? '';
    expect(topModel.length).toBeLessThanOrEqual(34);
    expect(topModel.endsWith('…')).toBe(true);
    expect(topSource.length).toBeLessThanOrEqual(34);
    expect(topSource.endsWith('…')).toBe(true);
  });
});
