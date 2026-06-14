import { describe, expect, it } from 'vitest';
import { type UsageDashboardMessages, buildUsageDashboardView } from '../lib/usage-dashboard';

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

const zhMessages = {
  title: '使用详情',
  description: '公开 NowCoding 状态背后的更深入拆解。',
  cards: {
    tokens: 'Tokens',
    estimatedCost: '预估成本',
    activeTime: '活跃时间',
    topModel: '常用模型',
  },
  totalDetail: '{period} 合计',
  sessionsDetail: '{count} 个会话',
  shareDetail: '占比 {share}',
  none: '无',
  hidden: '已隐藏',
  costLabels: {
    estimated: '预估',
    hidden: '已隐藏',
  },
} satisfies UsageDashboardMessages;

describe('usage dashboard view', () => {
  it('builds secondary usage cards from public stats', () => {
    expect(buildUsageDashboardView(baseStats)).toEqual({
      title: 'Usage details',
      description: 'A deeper breakdown behind your public NowCoding presence.',
      period: '7d',
      cards: [
        { key: 'tokens', label: 'Tokens', value: '125.4K', detail: '7d total' },
        {
          key: 'estimatedCost',
          label: 'Estimated cost',
          value: '$12.35',
          detail: 'estimated',
        },
        { key: 'activeTime', label: 'Active time', value: '2h 35m', detail: '6 sessions' },
        {
          key: 'topModel',
          label: 'Top model',
          value: 'claude-sonnet-4-6',
          detail: '72% share',
        },
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
      { key: 'tokens', label: 'Tokens', value: '125.4K', detail: '7d total' },
      { key: 'estimatedCost', label: 'Estimated cost', value: 'Hidden', detail: 'hidden' },
      { key: 'activeTime', label: 'Active time', value: '0m', detail: '0 sessions' },
      { key: 'topModel', label: 'Top model', value: 'None', detail: '0% share' },
    ]);
  });

  it('builds usage cards with locale-aware copy without translating model ids', () => {
    const view = buildUsageDashboardView(baseStats, {
      locale: 'zh-CN',
      messages: zhMessages,
    });

    expect(view).toMatchObject({
      title: '使用详情',
      description: '公开 NowCoding 状态背后的更深入拆解。',
      period: '7d',
    });
    expect(view.cards).toEqual([
      { key: 'tokens', label: 'Tokens', value: '12.5万', detail: '7d 合计' },
      { key: 'estimatedCost', label: '预估成本', value: 'US$12.35', detail: '预估' },
      { key: 'activeTime', label: '活跃时间', value: '2h 35m', detail: '6 个会话' },
      { key: 'topModel', label: '常用模型', value: 'claude-sonnet-4-6', detail: '占比 72%' },
    ]);
  });
});
