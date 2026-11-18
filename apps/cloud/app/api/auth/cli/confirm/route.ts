import { getCloudUrl, normalizeUserCode, verifyGitHubIdentitySession } from '@nowcoding/cloud-core';
import { getDb } from '@nowcoding/cloud-db';
import { type NextRequest, NextResponse } from 'next/server';
import { GITHUB_IDENTITY_COOKIE, confirmCliAuthFlow, reserveGitHubUser } from '../../_shared';
import { getCliAuthConfirmation } from './_confirmation';

function redirectWithStatus(status: 'success' | 'invalid' | 'expired') {
  return NextResponse.redirect(new URL(`/login/device?status=${status}`, getCloudUrl()));
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const wantsJson = contentType.includes('application/json');
  const identity = verifyGitHubIdentitySession(
    request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value ?? '',
  );

  if (!identity) {
    if (wantsJson) {
      return NextResponse.json({ error: 'github_login_required' }, { status: 401 });
    }

    return redirectWithStatus('expired');
  }

  const { userCode, joinArena } = await getCliAuthConfirmation(request);
  const normalizedUserCode = typeof userCode === 'string' ? normalizeUserCode(userCode) : null;

  if (!normalizedUserCode) {
    if (wantsJson) {
      return NextResponse.json({ error: 'invalid_user_code' }, { status: 400 });
    }

    return redirectWithStatus('invalid');
  }

  const db = getDb();
  const user = await reserveGitHubUser(db, identity);
  const confirmed = await confirmCliAuthFlow(db, normalizedUserCode, user, joinArena);

  if (!confirmed) {
    if (wantsJson) {
      return NextResponse.json({ error: 'flow_not_found' }, { status: 404 });
    }

    return redirectWithStatus('invalid');
  }

  if (wantsJson) {
    return NextResponse.json({ status: 'confirmed' });
  }

  return redirectWithStatus('success');
}
