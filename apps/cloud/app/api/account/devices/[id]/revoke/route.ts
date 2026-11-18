import { devices, getDb } from '@nowcoding/cloud-db';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteBrowserMutation } from '../../../../../../lib/browser-mutation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../../../lib/browser-session';
import {
  ipHashFromHeaders,
  writeAccountSecurityEvent,
} from '../../../../../../lib/security-events';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;
  const db = getDb();
  const now = new Date();
  const ipHash = await ipHashFromHeaders(request.headers);
  const result = await db.transaction(async (tx) => {
    const [revokedDevice] = await tx
      .update(devices)
      .set({
        revokedAt: now,
        updatedAt: now,
        revokedReason: 'user_revoked',
      })
      .where(
        and(eq(devices.id, id), eq(devices.userId, currentUser.user.id), isNull(devices.revokedAt)),
      )
      .returning({
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
      });

    if (!revokedDevice) {
      const [existingDevice] = await tx
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
        .where(and(eq(devices.id, id), eq(devices.userId, currentUser.user.id)))
        .limit(1);

      return existingDevice?.revokedAt ? { alreadyRevoked: true, device: existingDevice } : null;
    }

    await writeAccountSecurityEvent(
      {
        userId: currentUser.user.id,
        deviceId: revokedDevice.id,
        eventType: 'device_revoked',
        ipHash,
      },
      tx,
    );

    return { alreadyRevoked: false, device: revokedDevice };
  });

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    alreadyRevoked: result.alreadyRevoked,
    device: result.device,
  });
}
