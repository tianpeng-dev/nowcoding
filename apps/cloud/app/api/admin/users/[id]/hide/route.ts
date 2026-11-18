import { isAdminGithubLogin, isUuid, verifyGitHubIdentitySession } from '@nowcoding/cloud-core';
import { getDb, users } from '@nowcoding/cloud-db';
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

  if (!isUuid(id)) {
    return adminJson({ error: 'invalid_user_id' }, 400);
  }

  const [hiddenUser] = await getDb()
    .update(users)
    .set({ hiddenAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id, hiddenAt: users.hiddenAt });

  if (!hiddenUser) {
    return adminJson({ error: 'user_not_found' }, 404);
  }

  return adminJson({
    ok: true,
    user: {
      id: hiddenUser.id,
      hiddenAt: hiddenUser.hiddenAt?.toISOString() ?? null,
    },
  });
}
