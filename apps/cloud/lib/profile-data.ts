import { getDb, usageBuckets, usageSessions, users } from '@nowcoding/cloud-db';
import {
  type PeakActivityWindow,
  estimateTimeSavedMinutes,
  formatTimeSaved,
  highlightedMilestone,
  peakActivityWindow,
} from '@nowcoding/core';
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

export type PublicProfileUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
};

export type ProfileStats = {
  period: string;
  totalTokens: string;
  estimatedCostUsd: string | null;
  topModel: string | null;
  topSource: string | null;
  streak: number;
  timeSavedMinutes: number;
  peakActivity: PeakActivityWindow | null;
  milestone: string | null;
  sparkline: { date: string; totalTokens: string }[];
  generatedAt: string;
};

export type ProfileNow = {
  status: 'active' | 'idle' | 'offline';
  lastActiveAt: string | null;
  currentSource: string | null;
  currentModel: string | null;
  todayTokens: string;
  todayEstimatedCostUsd: null;
  generatedAt: string;
};

export type HeatmapCell = {
  date: string;
  totalTokens: string;
};

export type ProfileHeatmap = {
  year: number;
  timezone: string;
  cells: HeatmapCell[];
  generatedAt: string;
};

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const DEFAULT_PERIOD = '7d';
const DEFAULT_PERIOD_DAYS = 7;

export function buildPublicCost(_value: unknown): null {
  return null;
}

export function tokenTotalToString(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('unsafe_token_total');
    }

    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      throw new Error('unsafe_token_total');
    }

    return trimmed;
  }

  return '0';
}

export function formatTokenTotal(value: string): string {
  return BigInt(tokenTotalToString(value)).toLocaleString('en-US');
}

export function formatCloudTimeSaved(minutes: number): string {
  return formatTimeSaved(minutes);
}

type ProfileMilestoneInput = {
  totalTokens?: unknown;
  currentStreak?: number;
  activeDays30d?: number;
  timeSavedMinutes?: number;
  distinctSources30d?: number;
  peakActivityStartHour?: number | null;
  peakActivityActiveDays30d?: number;
};

export function selectProfileMilestone(input: ProfileMilestoneInput): string | null {
  const normalized = {
    ...input,
  } as Omit<ProfileMilestoneInput, 'totalTokens'> & { totalTokens?: bigint };

  if (input.totalTokens !== undefined) {
    normalized.totalTokens = BigInt(tokenTotalToString(input.totalTokens));
  }

  return highlightedMilestone(normalized);
}

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysAfter(days: number, now: Date): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function previousDateKey(dateKey: string): string {
  return daysAgo(1, new Date(`${dateKey}T00:00:00.000Z`))
    .toISOString()
    .slice(0, 10);
}

export function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

type SparklineInputRow = {
  bucketStart?: Date;
  date?: string;
  totalTokens: unknown;
};

export function buildProfileSparkline(
  rows: SparklineInputRow[],
  timezone: string,
  now = new Date(),
): { date: string; totalTokens: string }[] {
  const totalsByDate = new Map<string, bigint>();

  for (const row of rows) {
    const date = row.date ?? (row.bucketStart ? localDateKey(row.bucketStart, timezone) : null);
    if (!date) {
      continue;
    }
    totalsByDate.set(
      date,
      (totalsByDate.get(date) ?? 0n) + BigInt(tokenTotalToString(row.totalTokens)),
    );
  }

  const today = localDateKey(now, timezone);
  const dates: string[] = [];
  let cursor = today;

  for (let index = 0; index < 7; index += 1) {
    dates.push(cursor);
    cursor = previousDateKey(cursor);
  }

  return dates.reverse().map((date) => ({
    date,
    totalTokens: (totalsByDate.get(date) ?? 0n).toString(),
  }));
}

export function localHourOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);
  const hour = Number(parts.find((item) => item.type === 'hour')?.value ?? 0);

  return hour === 24 ? 0 : hour;
}

export function isLocalDateInYear(dateKey: string, year: number): boolean {
  return dateKey.startsWith(`${year}-`);
}

export function getCurrentStreakFromLocalDates(
  localDates: string[],
  timezone: string,
  now = new Date(),
): number {
  const activeDays = new Set(localDates);

  if (activeDays.size === 0) {
    return 0;
  }

  const [latest] = Array.from(activeDays).sort().reverse();
  const today = localDateKey(now, timezone);
  const yesterday = previousDateKey(today);

  if (latest !== today && latest !== yesterday) {
    return 0;
  }

  let cursor = latest;
  let streak = 0;

  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

function normalizePeriod(period: string | null): string {
  return period && (period in PERIOD_DAYS || period === 'all') ? period : DEFAULT_PERIOD;
}

function periodStart(period: string, now: Date): Date | null {
  if (period === 'all') {
    return null;
  }

  return daysAgo(PERIOD_DAYS[period] ?? DEFAULT_PERIOD_DAYS, now);
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function normalizeHeatmapYear(year: string | null): number {
  const parsed = year ? Number(year) : currentYear();

  if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 9999) {
    return currentYear();
  }

  return parsed;
}

export async function getPublicProfileUser(username: string): Promise<PublicProfileUser | null> {
  const [user] = await getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.hiddenAt)))
    .limit(1);

  if (!user?.username) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone ?? 'UTC',
  };
}

export async function getProfileStats(
  user: PublicProfileUser,
  requestedPeriod: string | null,
  now = new Date(),
): Promise<ProfileStats> {
  const period = normalizePeriod(requestedPeriod);
  const start = periodStart(period, now);
  const bucketWhere = start
    ? and(eq(usageBuckets.userId, user.id), gte(usageBuckets.bucketStart, start))
    : eq(usageBuckets.userId, user.id);

  const [totals] = await getDb()
    .select({
      totalTokens: sql<string>`coalesce(sum(${usageBuckets.totalTokens}), 0)::text`,
      completionTokens: sql<string>`coalesce(sum(${usageBuckets.completionTokens}), 0)::text`,
      requestCount: sql<string>`coalesce(sum(${usageBuckets.requestCount}), 0)::text`,
      costUsd: sql<string>`coalesce(sum(${usageBuckets.costUsd}), 0)::text`,
    })
    .from(usageBuckets)
    .where(bucketWhere);

  const [allTimeTotals] = await getDb()
    .select({
      totalTokens: sql<string>`coalesce(sum(${usageBuckets.totalTokens}), 0)::text`,
    })
    .from(usageBuckets)
    .where(eq(usageBuckets.userId, user.id));

  const periodActivityRows = await getDb()
    .select({
      bucketStart: usageBuckets.bucketStart,
      requestCount: usageBuckets.requestCount,
      totalTokens: usageBuckets.totalTokens,
    })
    .from(usageBuckets)
    .where(bucketWhere);

  const thirtyDayActivityRows = await getDb()
    .select({
      bucketStart: usageBuckets.bucketStart,
      source: usageBuckets.source,
    })
    .from(usageBuckets)
    .where(and(eq(usageBuckets.userId, user.id), gte(usageBuckets.bucketStart, daysAgo(30, now))));

  const sparklineRows = await getDb()
    .select({
      bucketStart: usageBuckets.bucketStart,
      totalTokens: usageBuckets.totalTokens,
    })
    .from(usageBuckets)
    .where(
      and(
        eq(usageBuckets.userId, user.id),
        gte(usageBuckets.bucketStart, daysAgo(8, now)),
        lt(usageBuckets.bucketStart, daysAfter(1, now)),
      ),
    )
    .orderBy(usageBuckets.bucketStart);

  const [topModel] = await getDb()
    .select({
      model: usageBuckets.model,
      totalTokens: sql<string>`coalesce(sum(${usageBuckets.totalTokens}), 0)::text`,
    })
    .from(usageBuckets)
    .where(bucketWhere)
    .groupBy(usageBuckets.model)
    .orderBy(desc(sql`sum(${usageBuckets.totalTokens})`))
    .limit(1);

  const [topSource] = await getDb()
    .select({
      source: usageBuckets.source,
      totalTokens: sql<string>`coalesce(sum(${usageBuckets.totalTokens}), 0)::text`,
    })
    .from(usageBuckets)
    .where(bucketWhere)
    .groupBy(usageBuckets.source)
    .orderBy(desc(sql`sum(${usageBuckets.totalTokens})`))
    .limit(1);

  const hourCounts = Array.from({ length: 24 }, () => 0);
  const activeDayKeys = new Set<string>();

  for (const row of periodActivityRows) {
    activeDayKeys.add(localDateKey(row.bucketStart, user.timezone));
    const hour = localHourOfDay(row.bucketStart, user.timezone);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      continue;
    }
    const requestCount = BigInt(tokenTotalToString(row.requestCount));
    const totalTokens = BigInt(tokenTotalToString(row.totalTokens));
    const interactionCount = requestCount > 0n ? requestCount : totalTokens > 0n ? 1n : 0n;
    hourCounts[hour] =
      (hourCounts[hour] ?? 0) +
      (interactionCount > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(interactionCount));
  }

  const activeDays30d = new Set(
    thirtyDayActivityRows.map((row) => localDateKey(row.bucketStart, user.timezone)),
  ).size;
  const distinctSources30d = new Set(thirtyDayActivityRows.map((row) => row.source)).size;
  const streak = await getProfileStreak(user, now);
  const timeSavedMinutes = estimateTimeSavedMinutes({
    outputTokens: BigInt(tokenTotalToString(totals?.completionTokens)),
    requestCount: BigInt(tokenTotalToString(totals?.requestCount)),
    activeDays: activeDayKeys.size,
  });
  const peakActivity = peakActivityWindow(hourCounts);

  return {
    period,
    totalTokens: tokenTotalToString(totals?.totalTokens),
    estimatedCostUsd: buildPublicCost(totals?.costUsd),
    topModel: topModel?.model ?? null,
    topSource: topSource?.source ?? null,
    streak,
    timeSavedMinutes,
    peakActivity,
    milestone: selectProfileMilestone({
      totalTokens: allTimeTotals?.totalTokens,
      currentStreak: streak,
      timeSavedMinutes,
      activeDays30d,
      distinctSources30d,
      peakActivityStartHour: peakActivity?.startHour ?? null,
      peakActivityActiveDays30d: activeDays30d,
    }),
    sparkline: buildProfileSparkline(sparklineRows, user.timezone, now),
    generatedAt: now.toISOString(),
  };
}

export async function getProfileNow(
  user: PublicProfileUser,
  now = new Date(),
): Promise<ProfileNow> {
  const todayKey = localDateKey(now, user.timezone);
  const todayRows = await getDb()
    .select({
      bucketStart: usageBuckets.bucketStart,
      totalTokens: usageBuckets.totalTokens,
    })
    .from(usageBuckets)
    .where(
      and(
        eq(usageBuckets.userId, user.id),
        gte(usageBuckets.bucketStart, daysAgo(2, now)),
        lt(usageBuckets.bucketStart, daysAfter(2, now)),
      ),
    );

  const [lastSession] = await getDb()
    .select({
      lastActiveAt: usageSessions.lastMessageAt,
      currentSource: usageSessions.source,
    })
    .from(usageSessions)
    .where(eq(usageSessions.userId, user.id))
    .orderBy(desc(usageSessions.lastMessageAt))
    .limit(1);

  const [lastBucket] = await getDb()
    .select({
      currentModel: usageBuckets.model,
      currentSource: usageBuckets.source,
      bucketStart: usageBuckets.bucketStart,
    })
    .from(usageBuckets)
    .where(eq(usageBuckets.userId, user.id))
    .orderBy(desc(usageBuckets.bucketStart))
    .limit(1);

  const lastActiveAt = lastSession?.lastActiveAt ?? lastBucket?.bucketStart ?? null;
  const ageMs = lastActiveAt ? now.getTime() - lastActiveAt.getTime() : null;
  const status = ageMs === null ? 'offline' : ageMs <= 15 * 60 * 1000 ? 'active' : 'idle';

  const todayTokens = todayRows
    .filter((row) => localDateKey(row.bucketStart, user.timezone) === todayKey)
    .reduce((total, row) => total + BigInt(tokenTotalToString(row.totalTokens)), 0n)
    .toString();

  return {
    status,
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
    currentSource: lastSession?.currentSource ?? lastBucket?.currentSource ?? null,
    currentModel: lastBucket?.currentModel ?? null,
    todayTokens,
    todayEstimatedCostUsd: buildPublicCost(null),
    generatedAt: now.toISOString(),
  };
}

export async function getProfileHeatmap(
  user: PublicProfileUser,
  year: number,
  now = new Date(),
): Promise<ProfileHeatmap> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await getDb()
    .select({
      bucketStart: usageBuckets.bucketStart,
      totalTokens: usageBuckets.totalTokens,
    })
    .from(usageBuckets)
    .where(
      and(
        eq(usageBuckets.userId, user.id),
        gte(usageBuckets.bucketStart, daysAgo(2, start)),
        lt(usageBuckets.bucketStart, daysAfter(2, end)),
      ),
    )
    .orderBy(usageBuckets.bucketStart);

  const totalsByDate = new Map<string, bigint>();

  for (const row of rows) {
    const date = localDateKey(row.bucketStart, user.timezone);
    totalsByDate.set(
      date,
      (totalsByDate.get(date) ?? 0n) + BigInt(tokenTotalToString(row.totalTokens)),
    );
  }

  return {
    year,
    timezone: user.timezone,
    cells: Array.from(totalsByDate.entries())
      .filter(([date]) => isLocalDateInYear(date, year))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, totalTokens]) => ({
        date,
        totalTokens: totalTokens.toString(),
      })),
    generatedAt: now.toISOString(),
  };
}

export async function getProfileStreak(user: PublicProfileUser, now = new Date()): Promise<number> {
  const rows = await getDb()
    .select({ lastMessageAt: usageSessions.lastMessageAt })
    .from(usageSessions)
    .where(eq(usageSessions.userId, user.id))
    .orderBy(desc(usageSessions.lastMessageAt))
    .limit(2000);

  if (rows.length === 0) {
    return 0;
  }

  return getCurrentStreakFromLocalDates(
    rows.map((row) => localDateKey(row.lastMessageAt, user.timezone)),
    user.timezone,
    now,
  );
}
