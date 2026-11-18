import { accountSecurityEvents, getDb } from '@nowcoding/cloud-db';
import { and, desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../lib/browser-session';

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

  const events = await getDb()
    .select({
      id: accountSecurityEvents.id,
      userId: accountSecurityEvents.userId,
      deviceId: accountSecurityEvents.deviceId,
      eventType: accountSecurityEvents.eventType,
      metadata: accountSecurityEvents.metadata,
      createdAt: accountSecurityEvents.createdAt,
    })
    .from(accountSecurityEvents)
    .where(and(eq(accountSecurityEvents.userId, currentUser.user.id)))
    .orderBy(desc(accountSecurityEvents.createdAt))
    .limit(50);

  const publicEvents = events.map((event) => {
    const { ipHash: _ipHash, ...publicEvent } = event as typeof event & {
      ipHash?: string | null;
    };

    return publicEvent;
  });

  return NextResponse.json({ events: publicEvents });
}
