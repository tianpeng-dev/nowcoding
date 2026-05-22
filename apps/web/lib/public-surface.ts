import { formatTimeSaved } from '@nowcoding/core/engagement';
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
}

export function toNowResponse(
  activity: NowActivityInfo | null,
  privacy: NowPrivacy,
  now?: Date,
): NowResponse | null {
  if (!activity) return null;
  return now ? toPublicNowResponse(activity, privacy, now) : toPublicNowResponse(activity, privacy);
}

export function buildProfileSummary(input: ProfileSummaryInput): ProfileSummary {
  const totalTokens = input.stats?.totalTokens ?? 0n;
  const liveStatus = input.now?.status ?? 'inactive';
  const showCost = input.showCost ?? true;
  const hasNowActivity =
    (input.now?.todayTokens ?? 0) > 0 ||
    (liveStatus !== 'inactive' && liveStatus !== 'private') ||
    Boolean(input.now?.lastActiveAt);
  return {
    isEmpty: totalTokens === 0n && !hasNowActivity && !input.streak?.lastActiveDate,
    tokenLabel: formatSafeTokens(totalTokens),
    costLabel: showCost ? formatCostFromString(input.stats?.estimatedCostUsd ?? '0') : 'hidden',
    live: formatLiveStatus(liveStatus),
    streakLabel: `${input.streak?.current ?? 0}d`,
    topModel: input.stats?.topModel ?? 'unknown',
    topSource: input.stats?.topSource ?? 'unknown',
    timeSavedLabel: formatTimeSaved(input.stats?.timeSavedMinutes ?? 0),
    peakActivityLabel: input.stats?.peakActivity?.label ?? 'No pattern yet',
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

export function formatSafeTokens(value: bigint | number): string {
  try {
    return formatTokens(value);
  } catch (error) {
    if (error instanceof RangeError) return 'too many';
    throw error;
  }
}

export function formatCost(value: number | null): string {
  if (value === null) return 'hidden';
  if (!Number.isFinite(value)) return '$0.00 estimated';
  return `$${value.toFixed(2)} estimated`;
}

export function formatCostFromString(value: string | null): string {
  if (value === null) return 'hidden';
  const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value);
  if (!match) return '$0.00 estimated';

  const whole = BigInt(match[1] ?? '0');
  const fractionMicros = BigInt((match[2] ?? '').padEnd(6, '0'));
  const cents = whole * 100n + (fractionMicros + 5000n) / 10000n;
  const dollars = cents / 100n;
  const centsRemainder = cents % 100n;
  return `$${dollars}.${centsRemainder.toString().padStart(2, '0')} estimated`;
}

export function formatLiveStatus(status: LiveStatus): { label: string; tone: SurfaceTone } {
  const labels = {
    live: 'Coding now',
    recent: 'Active recently',
    idle: 'Idle today',
    inactive: 'Inactive',
    private: 'Live hidden',
  } satisfies Record<LiveStatus, string>;
  return { label: labels[status], tone: status };
}

export function buildLivePresenceLabel(input: LivePresenceLabelInput): string {
  const source = input.currentSource ? formatSourceLabel(input.currentSource) : null;
  switch (input.status) {
    case 'live':
      return source ? `Coding now with ${source}` : 'Coding now';
    case 'recent':
      return source ? `Recently coding with ${source}` : 'Recently coding';
    case 'idle':
      return source ? `Taking a break from ${source}` : 'Taking a break';
    case 'private':
      return 'Live status private';
    case 'inactive':
      return 'Away from coding';
  }
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
