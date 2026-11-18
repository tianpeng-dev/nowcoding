import { devices, getDb } from '@nowcoding/cloud-db';
import { and, desc, eq, isNull } from 'drizzle-orm';
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

  const deviceRows = await getDb()
    .select({
      id: devices.id,
      userId: devices.userId,
      name: devices.name,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
      confirmedAt: devices.confirmedAt,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
      revokedReason: devices.revokedReason,
      hostname: devices.hostname,
      platform: devices.platform,
      cliVersion: devices.cliVersion,
    })
    .from(devices)
    .where(and(eq(devices.userId, currentUser.user.id), isNull(devices.revokedAt)))
    .orderBy(desc(devices.updatedAt))
    .limit(100);

  return NextResponse.json({ devices: deviceRows });
}
