import { isAdminGithubLogin, isUuid, verifyGitHubIdentitySession } from '@nowcoding/cloud-core';
import { devices, getDb, usageBuckets, usageSessions } from '@nowcoding/cloud-db';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { GITHUB_IDENTITY_COOKIE } from '../../../auth/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function adminJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    headers: NO_STORE_HEADERS,
    status,
  });
}

function authorizeAdmin(request: NextRequest): NextResponse | null {
  const identity = verifyGitHubIdentitySession(
    request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value ?? '',
  );

  if (!identity) {
    return adminJson({ error: 'github_login_required' }, 401);
  }

  if (!isAdminGithubLogin(identity.githubLogin, process.env.ADMIN_GITHUB_LOGINS ?? '')) {
    return adminJson({ error: 'admin_forbidden' }, 403);
  }

  return null;
}

function countValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const unauthorized = authorizeAdmin(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { userId } = await context.params;

  if (!isUuid(userId)) {
    return adminJson({ error: 'invalid_user_id' }, 400);
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const [[bucketSummary], [sessionSummary], [lastDevice]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(usageBuckets)
      .where(and(eq(usageBuckets.userId, userId), gte(usageBuckets.bucketStart, since))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(usageSessions)
      .where(and(eq(usageSessions.userId, userId), gte(usageSessions.lastMessageAt, since))),
    db
      .select({
        id: devices.id,
        name: devices.name,
        lastSeenAt: devices.lastSeenAt,
      })
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(desc(devices.lastSeenAt))
      .limit(1),
  ]);

  return adminJson({
    userId,
    windowDays: 7,
    buckets: {
      count: countValue(bucketSummary?.count),
    },
    sessions: {
      count: countValue(sessionSummary?.count),
    },
    lastDeviceSeen: lastDevice
      ? {
          id: lastDevice.id,
          name: lastDevice.name,
          lastSeenAt: lastDevice.lastSeenAt?.toISOString() ?? null,
        }
      : null,
    moderationEvents: [],
  });
}
