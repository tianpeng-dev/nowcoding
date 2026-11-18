import { getCloudUrl } from '@nowcoding/cloud-core';
import { type NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteBrowserMutation } from '../../../../lib/browser-mutation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../lib/browser-session';
import { CLI_STATUS_COOKIE } from '../_shared';

export async function POST(request: NextRequest) {
  const forbidden = rejectCrossSiteBrowserMutation(request);

  if (forbidden) {
    return forbidden;
  }

  await getCurrentBrowserUserFromCookie(request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value);

  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  const response = acceptsHtml
    ? NextResponse.redirect(new URL('/', request.url), { status: 303 })
    : NextResponse.json({ ok: true });
  response.cookies.set(GITHUB_IDENTITY_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: getCloudUrl().startsWith('https://'),
  });
  response.cookies.set(CLI_STATUS_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: getCloudUrl().startsWith('https://'),
  });

  return response;
}
