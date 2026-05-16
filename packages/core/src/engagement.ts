export interface TimeSavedInput {
  outputTokens: number | bigint;
  requestCount?: number | bigint | null;
  activeDays: number;
}

export interface PeakActivityWindow {
  startHour: number;
  endHour: number;
  label: string;
}

export interface MilestoneInput {
  totalTokens?: number | bigint;
  currentStreak?: number;
  activeDays30d?: number;
  timeSavedMinutes?: number;
  distinctSources30d?: number;
  peakActivityStartHour?: number | null;
  peakActivityActiveDays30d?: number;
}

const TOKEN_MILESTONES: Array<[bigint, string]> = [
  [100_000_000_000n, '100B TOKENS'],
  [50_000_000_000n, '50B TOKENS'],
  [25_000_000_000n, '25B TOKENS'],
  [10_000_000_000n, '10B TOKENS'],
  [5_000_000_000n, '5B TOKENS'],
  [2_000_000_000n, '2B TOKENS'],
  [1_000_000_000n, '1B TOKENS'],
  [500_000_000n, '500M TOKENS'],
  [250_000_000n, '250M TOKENS'],
  [100_000_000n, '100M TOKENS'],
  [50_000_000n, '50M TOKENS'],
  [10_000_000n, '10M TOKENS'],
];

const STREAK_MILESTONES: Array<[number, string]> = [
  [100, '100 DAY STREAK'],
  [30, '30 DAY STREAK'],
  [14, '14 DAY STREAK'],
  [7, '7 DAY STREAK'],
];

const ACTIVE_DAY_MILESTONES: Array<[number, string]> = [
  [30, '30 ACTIVE DAYS'],
  [20, '20 ACTIVE DAYS'],
  [10, '10 ACTIVE DAYS'],
];

const TIME_SAVED_MILESTONES: Array<[number, string]> = [
  [60_000, '1K HOURS SAVED'],
  [30_000, '500H SAVED'],
  [6_000, '100H SAVED'],
];

const TOOL_MILESTONES: Array<[number, string]> = [
  [10, '10 TOOL COLLECTOR'],
  [5, '5 TOOL POLYGLOT'],
  [3, '3 TOOL EXPLORER'],
];

function toSafeNumber(value: number | bigint | null | undefined): number {
  if (typeof value === 'bigint') {
    return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
  }
  return Number.isFinite(value ?? 0) ? Number(value ?? 0) : 0;
}

function toNonnegativeSafeNumber(value: number | bigint | null | undefined): number {
  return Math.max(0, toSafeNumber(value));
}

function toNonnegativeBigInt(value: number | bigint | undefined): bigint {
  if (typeof value === 'bigint') return value > 0n ? value : 0n;
  if (!Number.isFinite(value ?? 0) || (value ?? 0) <= 0) return 0n;
  return BigInt(Math.floor(value ?? 0));
}

function bestThreshold<T extends number | bigint>(
  value: T,
  thresholds: Array<[T, string]>,
): string | null {
  for (const [threshold, label] of thresholds) {
    if (value >= threshold) return label;
  }
  return null;
}

export function estimateTimeSavedMinutes(input: TimeSavedInput): number {
  const outputTokens = toNonnegativeSafeNumber(input.outputTokens);
  const normalizedRequestCount = toNonnegativeSafeNumber(input.requestCount);
  const requestCount =
    input.requestCount === undefined || input.requestCount === null || normalizedRequestCount === 0
      ? outputTokens > 0
        ? 1
        : 0
      : normalizedRequestCount;
  const rawMinutes = (outputTokens / 1000) * 6 + requestCount * 2;
  const activeDays = Math.floor(toNonnegativeSafeNumber(input.activeDays));
  const cap = activeDays * 16 * 60;

  return Math.round(Math.min(rawMinutes, cap));
}

export function formatTimeSaved(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '~0 hrs';
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  return `~${Math.round(minutes / 60).toLocaleString('en-US')} hrs`;
}

export function peakActivityWindow(hours: number[]): PeakActivityWindow | null {
  const normalized = Array.from({ length: 24 }, (_, index) => {
    const value = hours[index] ?? 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  });

  if (normalized.every((value) => value === 0)) return null;

  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start < 24; start += 1) {
    const score =
      (normalized[start] ?? 0) +
      (normalized[(start + 1) % 24] ?? 0) +
      (normalized[(start + 2) % 24] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const endHour = (bestStart + 3) % 24;

  return {
    startHour: bestStart,
    endHour,
    label: `${String(bestStart).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00`,
  };
}

export function highlightedMilestone(input: MilestoneInput): string | null {
  const streak = bestThreshold(input.currentStreak ?? 0, STREAK_MILESTONES);
  if (streak) return streak;

  const timeSaved = bestThreshold(input.timeSavedMinutes ?? 0, TIME_SAVED_MILESTONES);
  if (timeSaved) return timeSaved;

  const tokens = bestThreshold(toNonnegativeBigInt(input.totalTokens), TOKEN_MILESTONES);
  if (tokens) return tokens;

  const rhythm = bestThreshold(input.activeDays30d ?? 0, ACTIVE_DAY_MILESTONES);
  if (rhythm) return rhythm;

  const tools = bestThreshold(input.distinctSources30d ?? 0, TOOL_MILESTONES);
  if (tools) return tools;

  const start = input.peakActivityStartHour;
  const activeDays = input.peakActivityActiveDays30d ?? 0;
  if (activeDays >= 5 && start !== null && start !== undefined) {
    if (start >= 22 || start <= 2) return 'NIGHT OWL';
    if (start >= 5 && start <= 9) return 'EARLY BIRD';
  }

  return null;
}
