import type { LiveStatus, NowResponse } from '@nowcoding/core/schemas';
import type { NowActivityInfo, Period, PeriodStats, StreakInfo } from '@nowcoding/db';
import { type NowPrivacy, toPublicNowResponse } from './now-response';

export type CardPeriod = Extract<Period, '1d' | '7d' | '30d' | 'all'>;
export type SurfaceTone = 'live' | 'recent' | 'idle' | 'inactive' | 'private';

export interface ProfileSummaryInput {
  stats: PeriodStats | null;
  now: NowResponse | null;
  streak: StreakInfo | null;
  showCost?: boolean;
  copy?: PublicSurfaceCopy;
}

export interface ProfileSummary {
  isEmpty: boolean;
  tokenLabel: string;
  costLabel: string;
  live: { label: string; tone: SurfaceTone };
  streakLabel: string;
  topModel: string;
  topSource: string;
  timeSavedLabel: string;
  peakActivityLabel: string;
  milestoneLabel: string | null;
}

export interface LivePresenceLabelInput {
  status: LiveStatus;
  currentSource: string | null;
  currentModel: string | null;
  copy?: PublicSurfaceCopy;
}

export interface PublicSurfaceCopy {
  hidden: string;
  estimatedSuffix: string;
  invalidCostLabel: string;
  tooManyTokens: string;
  unknown: string;
  noPatternYet: string;
  streakDaySuffix: string;
  approximatePrefix: string;
  minuteUnit: string;
  hourUnit: string;
  numberLocale: string;
  liveStatus: Record<LiveStatus, string>;
  livePresence: {
    live: string;
    liveWithSource: string;
    recent: string;
    recentWithSource: string;
    idle: string;
    idleWithSource: string;
    private: string;
    inactive: string;
  };
}

export const DEFAULT_PUBLIC_SURFACE_COPY = {
  hidden: 'hidden',
  estimatedSuffix: 'estimated',
  invalidCostLabel: '$0.00 estimated',
  tooManyTokens: 'too many',
  unknown: 'unknown',
  noPatternYet: 'No pattern yet',
  streakDaySuffix: 'd',
  approximatePrefix: '~',
  minuteUnit: 'min',
  hourUnit: 'hrs',
  numberLocale: 'en-US',
  liveStatus: {
    live: 'Coding now',
    recent: 'Active recently',
    idle: 'Idle today',
    inactive: 'Inactive',
    private: 'Live hidden',
  },
  livePresence: {
    live: 'Coding now',
    liveWithSource: 'Coding now with {source}',
    recent: 'Recently coding',
    recentWithSource: 'Recently coding with {source}',
    idle: 'Taking a break',
    idleWithSource: 'Taking a break from {source}',
    private: 'Live status private',
    inactive: 'Away from coding',
  },
} as const satisfies PublicSurfaceCopy;

export function toNowResponse(
  activity: NowActivityInfo | null,
  privacy: NowPrivacy,
  now?: Date,
): NowResponse | null {
  if (!activity) return null;
  return now ? toPublicNowResponse(activity, privacy, now) : toPublicNowResponse(activity, privacy);
}

export function buildProfileSummary(input: ProfileSummaryInput): ProfileSummary {
  const copy = input.copy ?? DEFAULT_PUBLIC_SURFACE_COPY;
  const totalTokens = input.stats?.totalTokens ?? 0n;
  const liveStatus = input.now?.status ?? 'inactive';
  const showCost = input.showCost ?? true;
  const hasNowActivity =
    (input.now?.todayTokens ?? 0) > 0 ||
    (liveStatus !== 'inactive' && liveStatus !== 'private') ||
    Boolean(input.now?.lastActiveAt);
  return {
    isEmpty: totalTokens === 0n && !hasNowActivity && !input.streak?.lastActiveDate,
    tokenLabel: formatSafeTokens(totalTokens, copy),
    costLabel: showCost
      ? formatCostFromString(input.stats?.estimatedCostUsd ?? '0', copy)
      : copy.hidden,
    live: formatLiveStatus(liveStatus, copy),
    streakLabel: `${input.streak?.current ?? 0}${copy.streakDaySuffix}`,
    topModel: input.stats?.topModel ?? copy.unknown,
    topSource: input.stats?.topSource ?? copy.unknown,
    timeSavedLabel: formatTimeSavedLabel(input.stats?.timeSavedMinutes ?? 0, copy),
    peakActivityLabel: input.stats?.peakActivity?.label ?? copy.noPatternYet,
    milestoneLabel: input.stats?.milestone ?? null,
  };
}

export function parseCardPeriod(value: string | null): CardPeriod {
  return value === '1d' || value === '7d' || value === '30d' || value === 'all' ? value : '7d';
}

export function formatTokens(value: bigint | number): string {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError('Token value exceeds Number.MAX_SAFE_INTEGER');
    }
    if (value <= 0n) return '0';
    return formatTokens(Number(value));
  }
  const n = value;
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function formatSafeTokens(
  value: bigint | number,
  copy: PublicSurfaceCopy = DEFAULT_PUBLIC_SURFACE_COPY,
): string {
  try {
    return formatTokens(value);
  } catch (error) {
    if (error instanceof RangeError) return copy.tooManyTokens;
    throw error;
  }
}

export function formatCost(
  value: number | null,
  copy: PublicSurfaceCopy = DEFAULT_PUBLIC_SURFACE_COPY,
): string {
  if (value === null) return copy.hidden;
  if (!Number.isFinite(value)) return copy.invalidCostLabel;
  return `$${value.toFixed(2)} ${copy.estimatedSuffix}`;
}

export function formatCostFromString(
  value: string | null,
  copy: PublicSurfaceCopy = DEFAULT_PUBLIC_SURFACE_COPY,
): string {
  if (value === null) return copy.hidden;
  const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value);
  if (!match) return copy.invalidCostLabel;

  const whole = BigInt(match[1] ?? '0');
  const fractionMicros = BigInt((match[2] ?? '').padEnd(6, '0'));
  const cents = whole * 100n + (fractionMicros + 5000n) / 10000n;
  const dollars = cents / 100n;
  const centsRemainder = cents % 100n;
  return `$${dollars}.${centsRemainder.toString().padStart(2, '0')} ${copy.estimatedSuffix}`;
}

export function formatLiveStatus(
  status: LiveStatus,
  copy: PublicSurfaceCopy = DEFAULT_PUBLIC_SURFACE_COPY,
): { label: string; tone: SurfaceTone } {
  return { label: copy.liveStatus[status], tone: status };
}

export function buildLivePresenceLabel(input: LivePresenceLabelInput): string {
  const copy = input.copy ?? DEFAULT_PUBLIC_SURFACE_COPY;
  const source = input.currentSource ? formatSourceLabel(input.currentSource) : null;
  switch (input.status) {
    case 'live':
      return source
        ? interpolate(copy.livePresence.liveWithSource, { source })
        : copy.livePresence.live;
    case 'recent':
      return source
        ? interpolate(copy.livePresence.recentWithSource, { source })
        : copy.livePresence.recent;
    case 'idle':
      return source
        ? interpolate(copy.livePresence.idleWithSource, { source })
        : copy.livePresence.idle;
    case 'private':
      return copy.livePresence.private;
    case 'inactive':
      return copy.livePresence.inactive;
  }
}

function formatTimeSavedLabel(minutes: number, copy: PublicSurfaceCopy): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return `${copy.approximatePrefix}0 ${copy.hourUnit}`;
  }
  if (minutes < 60) {
    return `${copy.approximatePrefix}${Math.round(minutes).toLocaleString(copy.numberLocale)} ${
      copy.minuteUnit
    }`;
  }
  return `${copy.approximatePrefix}${Math.round(minutes / 60).toLocaleString(copy.numberLocale)} ${
    copy.hourUnit
  }`;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

function formatSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    codex: 'Codex',
    'claude-code': 'Claude Code',
    'gemini-cli': 'Gemini CLI',
    opencode: 'OpenCode',
    'qwen-code': 'Qwen Code',
    'kimi-code': 'Kimi Code',
    cline: 'Cline',
    'roo-code': 'Roo Code',
  };
  return labels[source] ?? source;
}
