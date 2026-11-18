import { getCloudUrl } from '@nowcoding/cloud-core';
import { type Database, devices, getDb, usageBuckets } from '@nowcoding/cloud-db';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { readArenaConsentForUser } from './arena-consent';
import { PROFILE_BADGE_TYPES, type ProfileBadgeType } from './profile-urls';

export type OnboardingLinks = {
  profile: string;
  card: string;
  badges: Record<ProfileBadgeType, string>;
};

export type OnboardingUsageSummary = {
  hasUsage: boolean;
  totalTokens7d: number;
  requestCount7d: number;
  latestSyncAt: Date | null;
};

export type OnboardingDevice = {
  id: string;
  name: string | null;
  hostname: string | null;
  platform: string | null;
  cliVersion: string | null;
  confirmedAt: Date | null;
  lastSeenAt: Date | null;
  updatedAt: Date | null;
  clientInfo: Record<string, unknown> | null;
};

export type AutomaticSyncStatus = {
  enabled: boolean;
  skippedReason: string | null;
  reportedAt: string | null;
};

function numericSummaryValue(value: unknown): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function validReportedAt(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildOnboardingLinks(cloudUrl: string, username: string): OnboardingLinks {
  const baseUrl = cloudUrl.replace(/\/+$/, '');
  const encodedUsername = encodeURIComponent(username);
  const profile = `${baseUrl}/u/${encodedUsername}`;

  return {
    profile,
    card: `${profile}/card.svg`,
    badges: Object.fromEntries(
      PROFILE_BADGE_TYPES.map((type) => [type, `${profile}/badge/${type}.svg`]),
    ) as Record<ProfileBadgeType, string>,
  };
}

export async function summarizeUsageForOnboarding(
  db: Pick<Database, 'select'>,
  userId: string,
  now = new Date(),
): Promise<OnboardingUsageSummary> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      totalTokens7d: sql<string>`coalesce(sum(${usageBuckets.totalTokens}), 0)::text`,
      requestCount7d: sql<string>`coalesce(sum(${usageBuckets.requestCount}), 0)::text`,
      latestSyncAt: sql<Date | null>`max(${usageBuckets.bucketStart})`,
    })
    .from(usageBuckets)
    .where(and(eq(usageBuckets.userId, userId), gte(usageBuckets.bucketStart, sevenDaysAgo)))
    .limit(1);

  const totalTokens7d = numericSummaryValue(row?.totalTokens7d);
  const requestCount7d = numericSummaryValue(row?.requestCount7d);
  const latestSyncAt = row?.latestSyncAt ?? null;

  return {
    hasUsage: totalTokens7d > 0 || requestCount7d > 0 || latestSyncAt instanceof Date,
    totalTokens7d,
    requestCount7d,
    latestSyncAt,
  };
}

export function extractAutomaticSyncStatus(clientInfo: unknown): AutomaticSyncStatus {
  const automaticSync =
    clientInfo &&
    typeof clientInfo === 'object' &&
    !Array.isArray(clientInfo) &&
    'automaticSync' in clientInfo
      ? (clientInfo as { automaticSync?: unknown }).automaticSync
      : null;

  if (!automaticSync || typeof automaticSync !== 'object' || Array.isArray(automaticSync)) {
    return { enabled: false, skippedReason: null, reportedAt: null };
  }

  const status = automaticSync as {
    enabled?: unknown;
    skippedReason?: unknown;
    reportedAt?: unknown;
  };

  return {
    enabled: status.enabled === true,
    skippedReason: typeof status.skippedReason === 'string' ? status.skippedReason : null,
    reportedAt: validReportedAt(status.reportedAt),
  };
}

export async function loadLatestOnboardingDevice(
  db: Pick<Database, 'select'>,
  userId: string,
): Promise<OnboardingDevice | null> {
  const latestDeviceTimestamp = sql<Date>`coalesce(${devices.updatedAt}, ${devices.createdAt})`;
  const [device] = await db
    .select({
      id: devices.id,
      name: devices.name,
      hostname: devices.hostname,
      platform: devices.platform,
      cliVersion: devices.cliVersion,
      confirmedAt: devices.confirmedAt,
      lastSeenAt: devices.lastSeenAt,
      updatedAt: devices.updatedAt,
      clientInfo: devices.clientInfo,
    })
    .from(devices)
    .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
    .orderBy(desc(latestDeviceTimestamp))
    .limit(1);

  return device ?? null;
}

export async function loadOnboardingData(
  userId: string,
  username: string,
  db: Database = getDb(),
  cloudUrl = getCloudUrl(),
) {
  const [device, usage, arena] = await Promise.all([
    loadLatestOnboardingDevice(db, userId),
    summarizeUsageForOnboarding(db, userId),
    readArenaConsentForUser(db, userId),
  ]);

  return {
    device,
    usage,
    arena,
    automaticSync: extractAutomaticSyncStatus(device?.clientInfo ?? null),
    links: buildOnboardingLinks(cloudUrl, username),
  };
}
