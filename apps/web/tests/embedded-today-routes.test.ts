import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getEnv: vi.fn(),
  getNowActivity: vi.fn(),
  getOwnerProfile: vi.fn(),
  getPeriodStats: vi.fn(),
  getServerPrivacy: vi.fn(),
  getStreak: vi.fn(),
}));

vi.mock('@nowcoding/db', () => ({
  getDb: mocks.getDb,
  getNowActivity: mocks.getNowActivity,
  getPeriodStats: mocks.getPeriodStats,
  getStreak: mocks.getStreak,
}));

vi.mock('@/lib/env', () => ({
  getEnv: mocks.getEnv,
  getOwnerProfile: mocks.getOwnerProfile,
  getServerPrivacy: mocks.getServerPrivacy,
}));

const periodStats = {
  period: '1d',
  totalTokens: 1000n,
  inputTokens: 700n,
  outputTokens: 300n,
  sessionCount: 1,
  activeSeconds: 120,
  cachedInputTokens: 0n,
  reasoningOutputTokens: 0n,
  estimatedCostUsd: '0.001',
  topModel: 'claude-sonnet-4',
  topSource: 'claude-code',
  modelDistribution: [],
  sourceDistribution: [],
  sparkline: [],
  timeSavedMinutes: 3,
  peakActivity: null,
  milestone: null,
  generatedAt: '2026-05-20T02:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({ id: 'db' });
  mocks.getEnv.mockReturnValue({ DATABASE_URL: 'postgres://example.test/db' });
  mocks.getOwnerProfile.mockReturnValue({
    username: 'peng',
    displayName: 'Peng',
    timezone: 'Asia/Shanghai',
  });
  mocks.getServerPrivacy.mockReturnValue({ showCost: true, showLive: true });
  mocks.getPeriodStats.mockResolvedValue(periodStats);
  mocks.getStreak.mockResolvedValue({ current: 1, longest: 2, lastActiveDate: '2026-05-20' });
  mocks.getNowActivity.mockResolvedValue({
    lastActiveAt: null,
    currentSource: null,
    currentModel: null,
    todayTokens: 1000,
    todayEstimatedCostUsd: 0.001,
    generatedAt: '2026-05-20T02:00:00.000Z',
  });
});

describe('embedded today surfaces', () => {
  it('renders the README card today period with owner timezone boundaries', async () => {
    const { GET } = await import('../app/card.svg/route');

    await GET({
      nextUrl: new URL('https://nowcoding.test/card.svg?period=1d'),
    } as never);

    expect(mocks.getPeriodStats).toHaveBeenCalledWith(
      { id: 'db' },
      '1d',
      expect.objectContaining({
        now: expect.any(Date),
        timezone: 'Asia/Shanghai',
      }),
    );
  });

  it('renders the today badge with owner timezone boundaries', async () => {
    const { GET } = await import('../app/badge/[type]/route');

    await GET({ nextUrl: new URL('https://nowcoding.test/badge/today.svg') } as never, {
      params: Promise.resolve({ type: 'today.svg' }),
    });

    expect(mocks.getPeriodStats).toHaveBeenCalledWith(
      { id: 'db' },
      '1d',
      expect.objectContaining({
        now: expect.any(Date),
        timezone: 'Asia/Shanghai',
      }),
    );
  });
});
