import {
  isAdminGithubLogin,
  parsePostgresBigintId,
  verifyGitHubIdentitySession,
} from '@nowcoding/cloud-core';
import { getDb, leaderboardEntries } from '@nowcoding/cloud-db';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { GITHUB_IDENTITY_COOKIE } from '../../../../auth/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
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

export async function POST(request: NextRequest, context: RouteContext) {
  const unauthorized = authorizeAdmin(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const entryId = parsePostgresBigintId(id);

  if (entryId === null) {
    return adminJson({ error: 'invalid_entry_id' }, 400);
  }

  const [excludedEntry] = await getDb()
    .update(leaderboardEntries)
    .set({ excludedAt: new Date() })
    .where(eq(leaderboardEntries.id, entryId))
    .returning({
      id: leaderboardEntries.id,
      excludedAt: leaderboardEntries.excludedAt,
    });

  if (!excludedEntry) {
    return adminJson({ error: 'leaderboard_entry_not_found' }, 404);
  }

  return adminJson({
    ok: true,
    leaderboardEntry: {
      id: excludedEntry.id.toString(),
      excludedAt: excludedEntry.excludedAt?.toISOString() ?? null,
    },
  });
}
