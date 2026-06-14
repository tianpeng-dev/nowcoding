import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type PublicSurfaceCopy,
  buildLivePresenceLabel,
  buildProfileSummary,
  formatCost,
  formatCostFromString,
  formatLiveStatus,
  formatSafeTokens,
  formatTokens,
  parseCardPeriod,
  toNowResponse,
} from '../lib/public-surface';

const stats = {
  period: '7d' as const,
  totalTokens: 1234567n,
  inputTokens: 700000n,
  outputTokens: 534567n,
  sessionCount: 4,
  activeSeconds: 3600,
  cachedInputTokens: 0n,
  reasoningOutputTokens: 0n,
  estimatedCostUsd: '12.345678',
  topModel: 'claude-sonnet-4-6',
  topSource: 'claude-code',
  modelDistribution: [{ model: 'claude-sonnet-4-6', tokens: 1234567n }],
  sourceDistribution: [{ source: 'claude-code', tokens: 1234567n }],
  sparkline: [{ date: '2026-05-14', tokens: 1234567n }],
  timeSavedMinutes: 7440,
  peakActivity: { startHour: 23, endHour: 2, label: '23:00 - 02:00' },
  milestone: '30 DAY STREAK',
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

const zhCopy = {
  hidden: '已隐藏',
  estimatedSuffix: '预估',
  invalidCostLabel: '$0.00 预估',
  tooManyTokens: '数量过大',
  unknown: '未知',
  noPatternYet: '暂无规律',
  streakDaySuffix: '天',
  approximatePrefix: '约 ',
  minuteUnit: '分钟',
  hourUnit: '小时',
  numberLocale: 'zh-CN',
  liveStatus: {
    live: '正在编码',
    recent: '最近活跃',
    idle: '今日空闲',
    inactive: '未活跃',
    private: '实时状态已隐藏',
  },
  livePresence: {
    live: '正在编码',
    liveWithSource: '正在使用 {source} 编码',
    recent: '最近在编码',
    recentWithSource: '最近在使用 {source} 编码',
    idle: '正在休息',
    idleWithSource: '暂时离开 {source}',
    private: '实时状态私密',
    inactive: '暂未编码',
  },
} satisfies PublicSurfaceCopy;

afterEach(() => {
  vi.useRealTimers();
});

describe('public surface helpers', () => {
  it('formats compact token and cost labels', () => {
    expect(formatTokens(999n)).toBe('999');
    expect(formatTokens(1234567n)).toBe('1.2M');
    expect(() => formatTokens(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      new RangeError('Token value exceeds Number.MAX_SAFE_INTEGER'),
    );
    expect(formatSafeTokens(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe('too many');
    expect(formatCost(12.345678)).toBe('$12.35 estimated');
    expect(formatCost(null)).toBe('hidden');
  });

  it('formats cost from database decimal strings without unsafe number conversion', () => {
    expect(formatCostFromString('12.345678')).toBe('$12.35 estimated');
    expect(formatCostFromString('12.344999')).toBe('$12.34 estimated');
    expect(formatCostFromString('999999999999999999999999.999999')).toBe(
      '$1000000000000000000000000.00 estimated',
    );
    expect(formatCostFromString('NaN')).toBe('$0.00 estimated');
    expect(formatCostFromString('Infinity')).toBe('$0.00 estimated');
    expect(formatCostFromString(null)).toBe('hidden');
  });

  it('formats public labels with locale-aware copy when supplied', () => {
    expect(formatSafeTokens(BigInt(Number.MAX_SAFE_INTEGER) + 1n, zhCopy)).toBe('数量过大');
    expect(formatCost(12.345678, zhCopy)).toBe('$12.35 预估');
    expect(formatCostFromString(null, zhCopy)).toBe('已隐藏');
    expect(formatLiveStatus('private', zhCopy)).toEqual({
      label: '实时状态已隐藏',
      tone: 'private',
    });
    expect(
      buildLivePresenceLabel({
        status: 'live',
        currentSource: 'claude-code',
        currentModel: 'claude-sonnet-4-6',
        copy: zhCopy,
      }),
    ).toBe('正在使用 Claude Code 编码');
  });

  it('preserves activity generatedAt as the default now response clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T13:00:00.000Z'));

    const activity = {
      lastActiveAt: new Date('2026-05-14T11:56:00.000Z'),
      currentSource: 'claude-code',
      currentModel: 'claude-sonnet-4-6',
      todayTokens: 1234,
      todayEstimatedCostUsd: 0.123456,
      generatedAt: '2026-05-14T12:00:00.000Z',
    };

    expect(toNowResponse(activity, { showLive: true, showCost: true })?.status).toBe('live');
    expect(
      toNowResponse(
        activity,
        { showLive: true, showCost: true },
        new Date('2026-05-14T13:00:00.000Z'),
      )?.status,
    ).toBe('idle');
  });

  it('formats live status labels with private handling', () => {
    expect(formatLiveStatus('live')).toEqual({ label: 'Coding now', tone: 'live' });
    expect(formatLiveStatus('recent')).toEqual({ label: 'Active recently', tone: 'recent' });
    expect(formatLiveStatus('private')).toEqual({ label: 'Live hidden', tone: 'private' });
  });

  it('builds live presence copy for live sessions with source labels', () => {
    expect(
      buildLivePresenceLabel({
        status: 'live',
        currentSource: 'claude-code',
        currentModel: 'claude-sonnet-4-6',
      }),
    ).toBe('Coding now with Claude Code');
  });

  it('builds live presence copy for recent sessions with source labels', () => {
    expect(
      buildLivePresenceLabel({
        status: 'recent',
        currentSource: 'gemini-cli',
        currentModel: 'gemini-2.5-pro',
      }),
    ).toBe('Recently coding with Gemini CLI');
  });

  it('builds live presence copy for inactive sessions', () => {
    expect(
      buildLivePresenceLabel({
        status: 'inactive',
        currentSource: 'claude-code',
        currentModel: null,
      }),
    ).toBe('Away from coding');
  });

  it('normalizes card periods from query strings', () => {
    expect(parseCardPeriod('1d')).toBe('1d');
    expect(parseCardPeriod('30d')).toBe('30d');
    expect(parseCardPeriod('bad')).toBe('7d');
    expect(parseCardPeriod(null)).toBe('7d');
  });

  it('builds profile summary with empty and private state flags', () => {
    expect(buildProfileSummary({ stats: null, now: null, streak: null })).toMatchObject({
      isEmpty: true,
      costLabel: '$0.00 estimated',
    });
    expect(
      buildProfileSummary({ stats: null, now: null, streak: null, showCost: false }),
    ).toMatchObject({
      isEmpty: true,
      costLabel: 'hidden',
    });
    expect(
      buildProfileSummary({
        stats: null,
        now: { ...now, status: 'private', lastActiveAt: null, todayTokens: 0 },
        streak: null,
      }).isEmpty,
    ).toBe(true);
    expect(
      buildProfileSummary({
        stats: null,
        now: { ...now, status: 'private', lastActiveAt: null, todayTokens: 1 },
        streak: null,
      }).isEmpty,
    ).toBe(false);
    expect(
      buildProfileSummary({
        stats: null,
        now: { ...now, status: 'recent', lastActiveAt: null, todayTokens: 0 },
        streak: null,
      }).isEmpty,
    ).toBe(false);
    expect(
      buildProfileSummary({
        stats,
        now: {
          ...now,
          status: 'private',
          lastActiveAt: null,
          currentSource: null,
          currentModel: null,
        },
        streak: { current: 3, longest: 5, lastActiveDate: '2026-05-14' },
      }),
    ).toMatchObject({
      isEmpty: false,
      tokenLabel: '1.2M',
      costLabel: '$12.35 estimated',
      live: { label: 'Live hidden', tone: 'private' },
      streakLabel: '3d',
      topModel: 'claude-sonnet-4-6',
      topSource: 'claude-code',
      timeSavedLabel: '~124 hrs',
      peakActivityLabel: '23:00 - 02:00',
      milestoneLabel: '30 DAY STREAK',
    });
    expect(buildProfileSummary({ stats, now: null, streak: null, showCost: false }).costLabel).toBe(
      'hidden',
    );
    expect(() =>
      buildProfileSummary({
        stats: { ...stats, totalTokens: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
        now: null,
        streak: null,
      }),
    ).not.toThrow();
    expect(
      buildProfileSummary({
        stats: { ...stats, totalTokens: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
        now: null,
        streak: null,
      }).tokenLabel,
    ).toBe('too many');
  });

  it('exposes engagement labels for public profile summaries', () => {
    expect(
      buildProfileSummary({
        stats,
        now: null,
        streak: { current: 30, longest: 30, lastActiveDate: '2026-05-14' },
      }),
    ).toMatchObject({
      timeSavedLabel: '~124 hrs',
      peakActivityLabel: '23:00 - 02:00',
      milestoneLabel: '30 DAY STREAK',
    });

    expect(buildProfileSummary({ stats: null, now: null, streak: null })).toMatchObject({
      timeSavedLabel: '~0 hrs',
      peakActivityLabel: 'No pattern yet',
      milestoneLabel: null,
    });
  });

  it('builds localized profile summary copy without translating model or source ids', () => {
    expect(
      buildProfileSummary({
        stats,
        now,
        streak: { current: 3, longest: 5, lastActiveDate: '2026-05-14' },
        copy: zhCopy,
      }),
    ).toMatchObject({
      costLabel: '$12.35 预估',
      live: { label: '正在编码', tone: 'live' },
      streakLabel: '3天',
      topModel: 'claude-sonnet-4-6',
      topSource: 'claude-code',
      timeSavedLabel: '约 124 小时',
    });
  });
});
