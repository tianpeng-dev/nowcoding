import { type NextRequest, NextResponse } from 'next/server';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../lib/browser-session';

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentBrowserUserFromCookie(
    request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user: currentUser.user });
}
