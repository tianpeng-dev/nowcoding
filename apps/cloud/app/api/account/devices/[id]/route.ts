import { devices, getDb } from '@nowcoding/cloud-db';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteBrowserMutation } from '../../../../../lib/browser-mutation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
} from '../../../../../lib/browser-session';
import { ipHashFromHeaders, writeAccountSecurityEvent } from '../../../../../lib/security-events';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

async function deviceNameFromRequest(request: NextRequest): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  return name.length >= 1 && name.length <= 80 ? name : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const name = await deviceNameFromRequest(request);

  if (!name) {
    return NextResponse.json({ error: 'invalid_device_name' }, { status: 400 });
  }

  const { id } = await context.params;
  const db = getDb();
  const now = new Date();
  const ipHash = await ipHashFromHeaders(request.headers);
  const device = await db.transaction(async (tx) => {
    const [updatedDevice] = await tx
      .update(devices)
      .set({ name, updatedAt: now })
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

    if (!updatedDevice) {
      return null;
    }

    await writeAccountSecurityEvent(
      {
        userId: currentUser.user.id,
        deviceId: updatedDevice.id,
        eventType: 'device_renamed',
        metadata: { name },
        ipHash,
      },
      tx,
    );

    return updatedDevice;
  });

  if (!device) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ device });
}
