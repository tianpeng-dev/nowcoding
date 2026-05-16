import { describe, expect, it } from 'vitest';
import { toPublicHeatmapResponse } from '../lib/heatmap-response';

const baseHeatmap = {
  year: 2026,
  timezone: 'Asia/Shanghai',
  cells: [{ date: '2026-01-01', tokens: 50_000, estimatedCostUsd: 0.5, level: 2 as const }],
  generatedAt: '2026-05-13T12:00:00.000Z',
};

describe('public heatmap response', () => {
  it('shows cost when showCost is true', () => {
    expect(toPublicHeatmapResponse(baseHeatmap, true)).toEqual(baseHeatmap);
  });

  it('hides cost when showCost is false', () => {
    expect(toPublicHeatmapResponse(baseHeatmap, false).cells[0]).toMatchObject({
      date: '2026-01-01',
      tokens: 50_000,
      estimatedCostUsd: null,
      level: 2,
    });
  });
});
