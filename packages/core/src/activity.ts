import type { LiveStatus } from './schemas';

export const LIVE_WINDOW_MS = 5 * 60_000;
export const RECENT_WINDOW_MS = 60 * 60_000;
export const IDLE_WINDOW_MS = 24 * 60 * 60_000;

export type PublicLiveStatus = Exclude<LiveStatus, 'private'>;

export function deriveLiveStatus(
  lastActiveAt: Date | null,
  now: Date = new Date(),
): PublicLiveStatus {
  if (!lastActiveAt) return 'inactive';
  const ageMs = Math.max(0, now.getTime() - lastActiveAt.getTime());
  if (ageMs <= LIVE_WINDOW_MS) return 'live';
  if (ageMs <= RECENT_WINDOW_MS) return 'recent';
  if (ageMs <= IDLE_WINDOW_MS) return 'idle';
  return 'inactive';
}
