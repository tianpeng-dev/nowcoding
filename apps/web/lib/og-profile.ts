import type { NowResponse } from '@nowcoding/core/schemas';
import type { PeriodStats, StreakInfo } from '@nowcoding/db';
import { buildProfileSummary } from './public-surface';

export interface OgProfileOwner {
  displayName: string;
  bio?: string;
  githubHandle?: string;
}

export interface OgProfileInput {
  owner: OgProfileOwner;
  stats: PeriodStats | null;
  now: NowResponse | null;
  streak: StreakInfo | null;
  showCost: boolean;
  type?: string;
}

export interface OgProfileMetric {
  label: string;
  value: string;
  tone?: 'live' | 'recent' | 'idle' | 'inactive' | 'private';
}

export interface OgProfileViewData {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: NonNullable<OgProfileMetric['tone']>;
  metrics: OgProfileMetric[];
  footerSuffix: string | null;
  isEmpty: boolean;
  emptyMessage: string | null;
}

const MAX_TITLE_LENGTH = 42;
const MAX_SUBTITLE_LENGTH = 96;
const MAX_METRIC_LENGTH = 34;
const MAX_SUFFIX_LENGTH = 24;

export function buildOgProfileViewData(input: OgProfileInput): OgProfileViewData {
  const summary = buildProfileSummary({
    stats: input.stats,
    now: input.now,
    streak: input.streak,
    showCost: input.showCost,
  });
  const type = normalizeType(input.type);
  const topModel = availableValue(summary.topModel);
  const topSource = availableValue(summary.topSource);
  const metrics: OgProfileMetric[] = [
    { label: '7-day tokens', value: summary.tokenLabel },
    { label: 'Live', value: summary.live.label, tone: summary.live.tone },
    { label: 'Streak', value: summary.streakLabel },
  ];

  if (topModel) {
    metrics.push({ label: 'Top model', value: clampText(topModel, MAX_METRIC_LENGTH) });
  }

  if (topSource) {
    metrics.push({ label: 'Top source', value: clampText(topSource, MAX_METRIC_LENGTH) });
  }

  if (input.showCost) {
    metrics.push({ label: 'Estimated cost', value: summary.costLabel });
  }

  return {
    title: clampText(input.owner.displayName, MAX_TITLE_LENGTH) || 'NowCoding',
    subtitle: clampText(
      input.owner.bio ?? publicIdentity(input.owner.githubHandle),
      MAX_SUBTITLE_LENGTH,
    ),
    statusLabel: summary.live.label,
    statusTone: summary.live.tone,
    metrics,
    footerSuffix: type && type !== 'profile' ? clampText(type, MAX_SUFFIX_LENGTH) : null,
    isEmpty: summary.isEmpty,
    emptyMessage: summary.isEmpty ? 'No public coding activity yet' : null,
  };
}

function publicIdentity(githubHandle: string | undefined): string {
  return githubHandle ? `@${githubHandle} on GitHub` : 'Public NowCoding profile';
}

function normalizeType(type: string | undefined): string | null {
  const normalized = type?.replace(/\.png$/, '').trim();
  return normalized ? normalized : null;
}

function availableValue(value: string): string | null {
  return value && value !== 'unknown' ? value : null;
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
