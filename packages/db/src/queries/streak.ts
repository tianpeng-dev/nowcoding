import { computeStreakFromInstants } from '@nowcoding/core/streak';
import type { Database } from '../client';
import { buckets } from '../schema/buckets';

export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

export interface StreakQueryOptions {
  timezone?: string;
  now?: Date;
}

export async function getStreak(
  db: Database,
  options: StreakQueryOptions | string = {},
): Promise<StreakInfo> {
  const normalized = typeof options === 'string' ? { timezone: options } : options;
  const timezone = normalized.timezone ?? 'UTC';
  const rows = await db.select({ bucketStart: buckets.bucketStart }).from(buckets);

  return computeStreakFromInstants(
    rows.map((row) => row.bucketStart),
    timezone,
    normalized.now ?? new Date(),
  );
}
