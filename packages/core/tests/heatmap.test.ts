import { describe, expect, it } from 'vitest';
import { buildYearHeatmapCells, heatmapLevel, toLocalDateKey } from '../src/heatmap';

describe('heatmap helpers', () => {
  it('maps token counts to approved display levels', () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(49_999)).toBe(1);
    expect(heatmapLevel(50_000)).toBe(2);
    expect(heatmapLevel(249_999)).toBe(2);
    expect(heatmapLevel(250_000)).toBe(3);
    expect(heatmapLevel(999_999)).toBe(3);
    expect(heatmapLevel(1_000_000)).toBe(4);
  });

  it('rejects invalid token counts', () => {
    expect(() => heatmapLevel(-1)).toThrow(RangeError);
    expect(() => heatmapLevel(Number.NaN)).toThrow(RangeError);
    expect(() => heatmapLevel(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('uses owner timezone for local date keys', () => {
    const instant = new Date('2026-05-13T16:30:00.000Z');

    expect(toLocalDateKey(instant, 'UTC')).toBe('2026-05-13');
    expect(toLocalDateKey(instant, 'Asia/Shanghai')).toBe('2026-05-14');
    expect(toLocalDateKey(instant, 'America/Los_Angeles')).toBe('2026-05-13');
  });

  it('builds every calendar day in the requested year', () => {
    const cells = buildYearHeatmapCells(
      2026,
      new Map([
        ['2026-01-01', { tokens: 10, estimatedCostUsd: 0.01 }],
        ['2026-12-31', { tokens: 1_000_000, estimatedCostUsd: 2 }],
      ]),
    );

    expect(cells).toHaveLength(365);
    expect(cells[0]).toEqual({
      date: '2026-01-01',
      tokens: 10,
      estimatedCostUsd: 0.01,
      level: 1,
    });
    expect(cells.at(-1)).toEqual({
      date: '2026-12-31',
      tokens: 1_000_000,
      estimatedCostUsd: 2,
      level: 4,
    });
  });

  it('builds leap-year cells and zero-fills missing days', () => {
    const cells = buildYearHeatmapCells(
      2028,
      new Map([['2028-02-29', { tokens: 250_000, estimatedCostUsd: 1.5 }]]),
    );

    expect(cells).toHaveLength(366);
    expect(cells.find((cell) => cell.date === '2028-02-28')).toEqual({
      date: '2028-02-28',
      tokens: 0,
      estimatedCostUsd: null,
      level: 0,
    });
    expect(cells.find((cell) => cell.date === '2028-02-29')).toEqual({
      date: '2028-02-29',
      tokens: 250_000,
      estimatedCostUsd: 1.5,
      level: 3,
    });
  });

  it('rejects invalid heatmap years', () => {
    expect(() => buildYearHeatmapCells(1969, new Map())).toThrow(RangeError);
    expect(() => buildYearHeatmapCells(10_000, new Map())).toThrow(RangeError);
    expect(() => buildYearHeatmapCells(2026.5, new Map())).toThrow(RangeError);
    expect(() => buildYearHeatmapCells(Number.NaN, new Map())).toThrow(RangeError);
  });
});
