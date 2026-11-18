import { createGitHubOAuthState, getCloudUrl, isSafeReturnPath } from '@nowcoding/cloud-core';
import { type NextRequest, NextResponse } from 'next/server';

const STATE_COOKIE = 'nc_github_oauth_state';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new NextResponse('GITHUB_CLIENT_ID is required', { status: 500 });
  }

  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? '/';

  if (!isSafeReturnPath(returnTo)) {
    return NextResponse.json({ error: 'invalid_return_to' }, { status: 400 });
  }

  const cloudUrl = getCloudUrl();
  const redirectUri = `${cloudUrl}/api/auth/github/callback`;
  const state = createGitHubOAuthState(returnTo);
  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', clientId);
  githubUrl.searchParams.set('redirect_uri', redirectUri);
  githubUrl.searchParams.set('scope', 'read:user');
  githubUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(githubUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/api/auth/github',
    sameSite: 'lax',
    secure: cloudUrl.startsWith('https://'),
  });

  return response;
}
