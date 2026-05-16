import { deriveLiveStatus } from '@nowcoding/core/activity';
import { type NowResponse, nowResponseSchema } from '@nowcoding/core/schemas';
import type { NowActivityInfo } from '@nowcoding/db';

export interface NowPrivacy {
  showLive: boolean;
  showCost: boolean;
}

export function resolveHeartbeatLastSeenAt(observedAt: string | undefined, now = new Date()): Date {
  if (!observedAt) return now;
  const parsed = new Date(observedAt);
  return parsed.getTime() > now.getTime() ? now : parsed;
}

export function toPublicNowResponse(
  activity: NowActivityInfo,
  privacy: NowPrivacy,
  now: Date = new Date(activity.generatedAt),
): NowResponse {
  const showLive = privacy.showLive;
  return nowResponseSchema.parse({
    status: showLive ? deriveLiveStatus(activity.lastActiveAt, now) : 'private',
    lastActiveAt: showLive ? (activity.lastActiveAt?.toISOString() ?? null) : null,
    currentSource: showLive ? activity.currentSource : null,
    currentModel: showLive ? activity.currentModel : null,
    todayTokens: activity.todayTokens,
    todayEstimatedCostUsd: privacy.showCost ? activity.todayEstimatedCostUsd : null,
    generatedAt: activity.generatedAt,
  });
}
