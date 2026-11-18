import { hashSecret } from '@nowcoding/cloud-core';
import { devices, getDb } from '@nowcoding/cloud-db';
import { and, eq, isNull } from 'drizzle-orm';

export type AuthenticatedDevice = {
  id: string;
  userId: string;
};

export function deviceBearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  const token = match?.[1]?.trim();

  return token?.startsWith('nc_dev_') ? token : null;
}

export async function authenticateDeviceRequest(
  authorization: string | null,
): Promise<AuthenticatedDevice | null> {
  const token = deviceBearerToken(authorization);

  if (!token) {
    return null;
  }

  const tokenHash = await hashSecret(token);
  const [device] = await getDb()
    .select({
      id: devices.id,
      userId: devices.userId,
    })
    .from(devices)
    .where(and(eq(devices.tokenHash, tokenHash), isNull(devices.revokedAt)))
    .limit(1);

  if (!device?.userId) {
    return null;
  }

  return {
    id: device.id,
    userId: device.userId,
  };
}
