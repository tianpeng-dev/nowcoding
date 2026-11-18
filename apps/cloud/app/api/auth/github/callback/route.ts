import { randomBytes } from 'node:crypto';
import {
  exchangeGitHubCode,
  fetchGitHubUser,
  getCloudUrl,
  verifyGitHubOAuthState,
} from '@nowcoding/cloud-core';
import { getDb } from '@nowcoding/cloud-db';
import { type NextRequest, NextResponse } from 'next/server';
import {
  browserSessionCookieOptions,
  createBrowserSessionCookieValue,
} from '../../../../../lib/browser-session';
import {
  CLI_STATUS_COOKIE,
  GITHUB_IDENTITY_COOKIE,
  completeCliAuthFlowByToken,
  reserveGitHubUser,
} from '../../_shared';

const STATE_COOKIE = 'nc_github_oauth_state';

function createCliStatusNonce(): string {
  return `nc_status_${randomBytes(32).toString('base64url')}`;
}

function redirectTo(returnTo: string): NextResponse {
  return NextResponse.redirect(new URL(returnTo, getCloudUrl()));
}

function cliFlowTokenFromReturnTo(returnTo: string): string | null {
  const returnUrl = new URL(returnTo, getCloudUrl());

  if (returnUrl.pathname !== '/login/device') {
    return null;
  }

  return returnUrl.searchParams.get('flow');
}

function clearStateCookie(response: NextResponse): void {
  response.cookies.set(STATE_COOKIE, '', {
    maxAge: 0,
    path: '/api/auth/github',
  });
}

function clearCliStatusCookie(response: NextResponse): void {
  response.cookies.set(CLI_STATUS_COOKIE, '', {
    maxAge: 0,
    path: '/',
  });
}

function setBrowserIdentityCookie(
  response: NextResponse,
  githubUser: {
    id: number | string;
    login: string;
    name: string | null;
    avatar_url: string | null;
  },
): void {
  response.cookies.set(
    GITHUB_IDENTITY_COOKIE,
    createBrowserSessionCookieValue({
      githubId: String(githubUser.id),
      githubLogin: githubUser.login,
      displayName: githubUser.name,
      avatarUrl: githubUser.avatar_url,
    }),
    browserSessionCookieOptions(),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: 'invalid_oauth_state' }, { status: 400 });
  }

  const verifiedState = verifyGitHubOAuthState(state);

  if (!verifiedState) {
    return NextResponse.json({ error: 'invalid_oauth_state' }, { status: 400 });
  }

  try {
    const redirectUri = `${getCloudUrl()}/api/auth/github/callback`;
    const accessToken = await exchangeGitHubCode(code, redirectUri);
    const githubUser = await fetchGitHubUser(accessToken);
    const cliFlowToken = cliFlowTokenFromReturnTo(verifiedState.returnTo);

    if (cliFlowToken !== null) {
      const db = getDb();
      const user = await reserveGitHubUser(db, {
        githubId: String(githubUser.id),
        githubLogin: githubUser.login,
        displayName: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      const statusNonce = createCliStatusNonce();
      const completed = await completeCliAuthFlowByToken(db, cliFlowToken, user, { statusNonce });

      const response = redirectTo(
        completed ? '/login/device?status=confirmed' : '/login/device?status=invalid',
      );
      clearCliStatusCookie(response);
      if (completed) {
        setBrowserIdentityCookie(response, githubUser);
        response.cookies.set(CLI_STATUS_COOKIE, statusNonce, {
          httpOnly: true,
          maxAge: 10 * 60,
          path: '/',
          sameSite: 'lax',
          secure: getCloudUrl().startsWith('https://'),
        });
      }
      clearStateCookie(response);

      return response;
    }

    const response = redirectTo(verifiedState.returnTo || '/');
    setBrowserIdentityCookie(response, githubUser);
    clearStateCookie(response);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub OAuth failed';

    return new NextResponse(message, { status: 500 });
  }
}
