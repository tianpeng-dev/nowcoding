import { toLocalDateKey } from './heatmap';

export interface StreakResult {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

export function computeStreak(
  activeDays: Iterable<string>,
  today: Date = new Date(),
  timezone = 'UTC',
): StreakResult {
  return computeStreakFromLocalDays(activeDays, toLocalDateKey(today, timezone));
}

export function computeStreakFromInstants(
  activeInstants: Iterable<Date>,
  timezone = 'UTC',
  now: Date = new Date(),
): StreakResult {
  const activeDays = [...activeInstants].map((instant) => toLocalDateKey(instant, timezone));
  return computeStreakFromLocalDays(activeDays, toLocalDateKey(now, timezone));
}

export function computeStreakFromLocalDays(
  activeDays: Iterable<string>,
  todayKey: string,
): StreakResult {
  assertDateKey(todayKey, 'Streak today key');

  const set = new Set<string>();
  for (const day of activeDays) {
    assertDateKey(day, 'Streak active day key');
    set.add(day);
  }
  if (set.size === 0) return { current: 0, longest: 0, lastActiveDate: null };

  const sortedAscending = [...set].sort();
  const sortedDescending = [...sortedAscending].reverse();
  const last = sortedDescending[0] ?? null;
  const yesterdayKey = shiftDayKey(todayKey, -1);

  let current = 0;
  if (last === todayKey || last === yesterdayKey) {
    let cursor = last;
    while (set.has(cursor)) {
      current++;
      cursor = shiftDayKey(cursor, -1);
    }
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sortedAscending) {
    run = previous !== null && shiftDayKey(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, lastActiveDate: last };
}

function shiftDayKey(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function assertDateKey(day: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new RangeError(`${label} must be a real YYYY-MM-DD calendar date`);
  }

  const date = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new RangeError(`${label} must be a real YYYY-MM-DD calendar date`);
  }
}
