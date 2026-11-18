import { hashSecret } from '@nowcoding/cloud-core';
import { cliAuthFlows, devices, getDb, users } from '@nowcoding/cloud-db';
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { CLI_STATUS_COOKIE } from '../../_shared';

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const statusNonce = request.cookies.get(CLI_STATUS_COOKIE)?.value;

  if (!statusNonce?.startsWith('nc_status_')) {
    return unauthorized();
  }

  const now = new Date();
  const statusNonceHash = await hashSecret(statusNonce);
  const db = getDb();
  const [flow] = await db
    .select({
      userId: cliAuthFlows.userId,
      deviceId: cliAuthFlows.deviceId,
      deviceName: cliAuthFlows.deviceName,
      joinArena: cliAuthFlows.joinArena,
      claimedAt: cliAuthFlows.claimedAt,
    })
    .from(cliAuthFlows)
    .where(
      and(
        eq(cliAuthFlows.statusNonceHash, statusNonceHash),
        gt(cliAuthFlows.statusExpiresAt, now),
        isNotNull(cliAuthFlows.completedAt),
        isNotNull(cliAuthFlows.userId),
      ),
    )
    .limit(1);

  if (!flow?.userId) {
    return unauthorized();
  }

  const [user] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, flow.userId))
    .limit(1);

  const [device] = flow.deviceId
    ? await db
        .select({ name: devices.name })
        .from(devices)
        .where(eq(devices.id, flow.deviceId))
        .limit(1)
    : [];

  return NextResponse.json({
    status: flow.claimedAt ? 'claimed' : 'confirmed',
    account: {
      username: user?.username ?? 'unknown',
      displayName: user?.displayName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
    },
    device: {
      id: flow.deviceId,
      name: device?.name ?? flow.deviceName ?? 'NowCoding CLI',
      claimed: Boolean(flow.claimedAt),
    },
    arenaJoined: flow.joinArena ?? false,
  });
}
