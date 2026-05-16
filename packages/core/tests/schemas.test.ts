import { describe, expect, it } from 'vitest';
import {
  PRICE_VERSION,
  heartbeatRequestSchema,
  heatmapResponseSchema,
  nowResponseSchema,
  statsResponseSchema,
} from '../src/schemas';

describe('public API schemas', () => {
  it('parses a heartbeat request and defaults project to unknown', () => {
    const parsed = heartbeatRequestSchema.parse({
      source: 'claude-code',
      model: 'claude-3-5-sonnet',
      observedAt: '2026-05-13T09:00:00.000Z',
    });

    expect(parsed).toEqual({
      source: 'claude-code',
      model: 'claude-3-5-sonnet',
      project: 'unknown',
      observedAt: '2026-05-13T09:00:00.000Z',
    });
  });

  it('accepts stats responses with cost hidden', () => {
    expect(
      statsResponseSchema.parse({
        period: 'today',
        totalTokens: 1200,
        inputTokens: 700,
        outputTokens: 500,
        sessionCount: 2,
        activeSeconds: 3600,
        estimatedCostUsd: null,
        costLabel: 'hidden',
        topModel: { name: 'claude-3-5-sonnet', share: 1 },
        topSource: { name: 'claude-code', share: 1 },
        topProject: { name: 'unknown', share: 1 },
        modelDistribution: [{ name: 'claude-3-5-sonnet', tokens: 1200, share: 1 }],
        sourceDistribution: [{ name: 'claude-code', tokens: 1200, share: 1 }],
        streak: { current: 3, longest: 9, lastActiveDate: '2026-05-13' },
        sparkline: [0, 1200],
        generatedAt: '2026-05-13T09:00:00.000Z',
      }),
    ).toMatchObject({
      period: 'today',
      costLabel: 'hidden',
      estimatedCostUsd: null,
    });
  });

  it('accepts now responses for live activity', () => {
    expect(
      nowResponseSchema.parse({
        status: 'live',
        lastActiveAt: '2026-05-13T09:00:00.000Z',
        currentSource: 'claude-code',
        currentModel: 'claude-3-5-sonnet',
        todayTokens: 1200,
        todayEstimatedCostUsd: 0.042,
        generatedAt: '2026-05-13T09:01:00.000Z',
      }),
    ).toMatchObject({ status: 'live', todayEstimatedCostUsd: 0.042 });
  });

  it('accepts heatmap responses with level 0 through 4', () => {
    const parsed = heatmapResponseSchema.parse({
      year: 2026,
      timezone: 'Asia/Shanghai',
      cells: [
        { date: '2026-05-12', tokens: 0, estimatedCostUsd: null, level: 0 },
        { date: '2026-05-13', tokens: 4000, estimatedCostUsd: 0.22, level: 4 },
      ],
      generatedAt: '2026-05-13T09:00:00.000Z',
    });

    expect(parsed.cells.map((cell) => cell.level)).toEqual([0, 4]);
  });

  it('rejects heatmap cells with impossible calendar dates', () => {
    expect(() =>
      heatmapResponseSchema.parse({
        year: 2026,
        timezone: 'Asia/Shanghai',
        cells: [{ date: '2026-99-99', tokens: 0, estimatedCostUsd: null, level: 0 }],
        generatedAt: '2026-05-13T09:00:00.000Z',
      }),
    ).toThrow();
  });

  it('exports the v1 price version', () => {
    expect(PRICE_VERSION).toBe('2026-05-13-v1');
  });
});
