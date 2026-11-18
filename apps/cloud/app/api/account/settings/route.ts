import { hashSecret } from '@nowcoding/cloud-core';
import { devices, getDb } from '@nowcoding/cloud-db';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_ACCOUNT_SETTINGS, deviceBearerToken } from '../../../../lib/account-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthenticatedDevice = {
  id: string;
};

async function authenticateDevice(
  authorization: string | null,
): Promise<AuthenticatedDevice | null> {
  const token = deviceBearerToken(authorization);

  if (!token) {
    return null;
  }

  const tokenHash = await hashSecret(token);
  const [device] = await getDb()
    .select({ id: devices.id, userId: devices.userId })
    .from(devices)
    .where(and(eq(devices.tokenHash, tokenHash), isNull(devices.revokedAt)))
    .limit(1);

  if (!device?.userId) {
    return null;
  }

  return { id: device.id };
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  const device = await authenticateDevice(request.headers.get('authorization'));

  if (!device) {
    return jsonNoStore({ error: 'unauthorized' }, 401);
  }

  return jsonNoStore(DEFAULT_ACCOUNT_SETTINGS);
}
