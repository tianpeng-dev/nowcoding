import type { HeatmapCell } from './schemas';

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapDayAggregate {
  tokens: number;
  estimatedCostUsd: number | null;
}

export function heatmapLevel(tokens: number): HeatmapLevel {
  if (!Number.isFinite(tokens) || tokens < 0) {
    throw new RangeError('Heatmap token value must be a non-negative finite number');
  }
  if (tokens <= 0) return 0;
  if (tokens < 50_000) return 1;
  if (tokens < 250_000) return 2;
  if (tokens < 1_000_000) return 3;
  return 4;
}

export function toLocalDateKey(date: Date, timezone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new RangeError(`Unable to format local date for timezone ${timezone}`);
  }
  return `${year}-${month}-${day}`;
}

export function buildYearHeatmapCells(
  year: number,
  aggregates: Map<string, HeatmapDayAggregate>,
): HeatmapCell[] {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new RangeError('Heatmap year must be an integer between 1970 and 9999');
  }

  const cells: HeatmapCell[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    const date = cursor.toISOString().slice(0, 10);
    const aggregate = aggregates.get(date);
    const tokens = aggregate?.tokens ?? 0;
    cells.push({
      date,
      tokens,
      estimatedCostUsd: aggregate?.estimatedCostUsd ?? null,
      level: heatmapLevel(tokens),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}
