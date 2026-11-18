import { getDb } from '@nowcoding/cloud-db';
import { type NextRequest, NextResponse } from 'next/server';
import {
  joinArenaForUser,
  leaveArenaForUser,
  readArenaConsentForUser,
} from '../../../../lib/arena-consent';
import { rejectCrossSiteBrowserMutation } from '../../../../lib/browser-mutation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../lib/browser-session';
import { ipHashFromHeaders, writeAccountSecurityEvent } from '../../../../lib/security-events';

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentBrowserUserFromCookie(
    request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return unauthorized();
  }

  const db = getDb();
  const consent = await readArenaConsentForUser(db, currentUser.user.id);

  return NextResponse.json({ arena: consent });
}

export async function POST(request: NextRequest) {
  const forbidden = rejectCrossSiteBrowserMutation(request);

  if (forbidden) {
    return forbidden;
  }

  const currentUser = await getCurrentBrowserUserFromCookie(
    request.cookies.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return unauthorized();
  }

  let body: { joined?: unknown };

  try {
    body = (await request.json()) as { joined?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body?.joined !== 'boolean') {
    return NextResponse.json({ error: 'joined_required' }, { status: 400 });
  }

  const db = getDb();
  const joined = body.joined;

  if (joined) {
    await joinArenaForUser(db, currentUser.user.id);
  } else {
    await leaveArenaForUser(db, currentUser.user.id);
  }

  await writeAccountSecurityEvent(
    {
      userId: currentUser.user.id,
      eventType: joined ? 'arena_joined' : 'arena_left',
      ipHash: await ipHashFromHeaders(request.headers),
    },
    db,
  );

  const consent = await readArenaConsentForUser(db, currentUser.user.id);

  return NextResponse.json({ arena: consent });
}
