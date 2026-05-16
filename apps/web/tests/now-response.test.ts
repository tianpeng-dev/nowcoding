import { describe, expect, it } from 'vitest';
import { resolveHeartbeatLastSeenAt, toPublicNowResponse } from '../lib/now-response';

const baseActivity = {
  lastActiveAt: new Date('2026-05-13T12:00:00.000Z'),
  currentSource: 'claude-code',
  currentModel: 'claude-sonnet-4-6',
  todayTokens: 12_345,
  todayEstimatedCostUsd: 1.25,
  generatedAt: '2026-05-13T12:04:00.000Z',
};

describe('public now response', () => {
  it('shows live activity when showLive is true', () => {
    expect(
      toPublicNowResponse(
        baseActivity,
        { showLive: true, showCost: true },
        new Date(baseActivity.generatedAt),
      ),
    ).toEqual({
      status: 'live',
      lastActiveAt: '2026-05-13T12:00:00.000Z',
      currentSource: 'claude-code',
      currentModel: 'claude-sonnet-4-6',
      todayTokens: 12_345,
      todayEstimatedCostUsd: 1.25,
      generatedAt: '2026-05-13T12:04:00.000Z',
    });
  });

  it('hides live activity when showLive is false', () => {
    expect(
      toPublicNowResponse(
        baseActivity,
        { showLive: false, showCost: true },
        new Date(baseActivity.generatedAt),
      ),
    ).toMatchObject({
      status: 'private',
      lastActiveAt: null,
      currentSource: null,
      currentModel: null,
      todayEstimatedCostUsd: 1.25,
    });
  });

  it('hides cost when showCost is false', () => {
    expect(
      toPublicNowResponse(
        baseActivity,
        { showLive: true, showCost: false },
        new Date(baseActivity.generatedAt),
      ),
    ).toMatchObject({
      status: 'live',
      todayTokens: 12_345,
      todayEstimatedCostUsd: null,
    });
  });
});

describe('heartbeat lastSeenAt resolution', () => {
  it('uses server time when observedAt is missing', () => {
    const now = new Date('2026-05-14T12:00:00.000Z');

    expect(resolveHeartbeatLastSeenAt(undefined, now)).toBe(now);
  });

  it('keeps past client observedAt values', () => {
    const now = new Date('2026-05-14T12:00:00.000Z');

    expect(resolveHeartbeatLastSeenAt('2026-05-14T11:59:00.000Z', now).toISOString()).toBe(
      '2026-05-14T11:59:00.000Z',
    );
  });

  it('clamps future client observedAt values to server time', () => {
    const now = new Date('2026-05-14T12:00:00.000Z');

    expect(resolveHeartbeatLastSeenAt('2026-05-15T12:00:00.000Z', now)).toBe(now);
  });
});
