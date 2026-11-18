import { getDb, usageSessions, users } from '@nowcoding/cloud-db';
import { desc, eq, isNull } from 'drizzle-orm';
import { getProfileStreak, localDateKey } from './profile-data';

export type LiveBuilderRow = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  state: 'live' | 'recent';
  source: string | null;
  project: string | null;
  streak: number;
  lastActiveAt: string;
  profileHref: string;
};

const LIVE_WINDOW_MS = 15 * 60 * 1000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function feedState(lastActiveAt: Date, now: Date): 'live' | 'recent' | null {
  const ageMs = now.getTime() - lastActiveAt.getTime();

  if (ageMs < 0 || ageMs <= LIVE_WINDOW_MS) {
    return 'live';
  }

  if (ageMs <= RECENT_WINDOW_MS) {
    return 'recent';
  }

  return null;
}

export async function loadLiveBuilderRows(now = new Date(), limit = 12): Promise<LiveBuilderRow[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
      source: usageSessions.source,
      lastActiveAt: usageSessions.lastMessageAt,
    })
    .from(usageSessions)
    .innerJoin(users, eq(users.id, usageSessions.userId))
    .where(isNull(users.hiddenAt))
    .orderBy(desc(usageSessions.lastMessageAt))
    .limit(Math.max(1, Math.min(limit * 3, 50)));

  const seen = new Set<string>();
  const builders: LiveBuilderRow[] = [];

  for (const row of rows) {
    if (!row.username || seen.has(row.username)) {
      continue;
    }

    const state = feedState(row.lastActiveAt, now);
    if (!state) {
      continue;
    }

    seen.add(row.username);
    const timezone = row.timezone ?? 'UTC';
    const streak = await getProfileStreak(
      {
        id: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        timezone,
      },
      now,
    );

    builders.push({
      username: row.username,
      displayName: row.displayName ?? row.username,
      avatarUrl: row.avatarUrl,
      state,
      source: row.source,
      project: null,
      streak,
      lastActiveAt: localDateKey(row.lastActiveAt, timezone),
      profileHref: `/u/${encodeURIComponent(row.username)}`,
    });

    if (builders.length >= limit) {
      break;
    }
  }

  return builders;
}

export function assertNoPrivateFeedFields(row: LiveBuilderRow): void {
  const maybePrivateValues = [row.project].filter(Boolean);

  if (maybePrivateValues.some((value) => value?.includes('/') || value?.includes('\\'))) {
    throw new Error('private_feed_field');
  }
}
