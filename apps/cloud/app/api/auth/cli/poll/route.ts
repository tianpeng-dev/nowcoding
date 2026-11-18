import { createDeviceToken, getCloudUrl, hashSecret } from '@nowcoding/cloud-core';
import { type Database, cliAuthFlows, devices, getDb, users } from '@nowcoding/cloud-db';
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { joinArenaForUser } from '../../../../../lib/arena-consent';
import { ipHashFromHeaders, writeAccountSecurityEvent } from '../../../../../lib/security-events';

class DeviceTokenUnavailableError extends Error {
  constructor() {
    super('device_token_unavailable');
  }
}

type CompletedCliAuthFlow = typeof cliAuthFlows.$inferSelect & {
  userId: string;
};

async function recordDeviceTokenClaimed(
  db: Database,
  request: NextRequest,
  input: { userId: string; deviceId: string },
): Promise<void> {
  try {
    await writeAccountSecurityEvent(
      {
        userId: input.userId,
        deviceId: input.deviceId,
        eventType: 'device_token_claimed',
        metadata: { source: 'cli_poll' },
        ipHash: await ipHashFromHeaders(request.headers),
      },
      db,
    );
  } catch {
    // Device issuance already succeeded; do not strand the CLI on audit-log failure.
  }
}

async function joinArenaIfRequested(
  db: Pick<Database, 'insert'>,
  claimedFlow: { joinArena: boolean | null; userId: string | null },
): Promise<void> {
  if (claimedFlow.joinArena !== true || !claimedFlow.userId) {
    return;
  }

  await joinArenaForUser(db, claimedFlow.userId);
}

async function claimNewCliDevice(db: Database, flow: CompletedCliAuthFlow, pollTokenHash: string) {
  try {
    return await db.transaction(async (tx) => {
      const claimedAt = new Date();
      const deviceToken = createDeviceToken();
      const tokenHash = await hashSecret(deviceToken);
      const [device] = await tx
        .insert(devices)
        .values({
          userId: flow.userId,
          name: flow.deviceName ?? 'NowCoding CLI',
          tokenHash,
          confirmedAt: claimedAt,
          updatedAt: claimedAt,
        })
        .returning({ id: devices.id });

      if (!device) {
        throw new DeviceTokenUnavailableError();
      }

      const [claimedFlow] = await tx
        .update(cliAuthFlows)
        .set({
          deviceId: device.id,
          deviceToken,
          claimedAt,
        })
        .where(
          and(
            eq(cliAuthFlows.pollTokenHash, pollTokenHash),
            eq(cliAuthFlows.userId, flow.userId),
            isNotNull(cliAuthFlows.completedAt),
            isNull(cliAuthFlows.deviceId),
            isNull(cliAuthFlows.deviceToken),
            isNull(cliAuthFlows.claimedAt),
            gt(cliAuthFlows.expiresAt, new Date()),
          ),
        )
        .returning({
          deviceToken: cliAuthFlows.deviceToken,
          deviceId: cliAuthFlows.deviceId,
          userId: cliAuthFlows.userId,
          joinArena: cliAuthFlows.joinArena,
        });

      if (!claimedFlow?.deviceToken || !claimedFlow.deviceId || !claimedFlow.userId) {
        throw new DeviceTokenUnavailableError();
      }

      await joinArenaIfRequested(tx, claimedFlow);

      return claimedFlow;
    });
  } catch (error) {
    if (error instanceof DeviceTokenUnavailableError) {
      return null;
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const pollToken = (body as { pollToken?: unknown }).pollToken;

  if (typeof pollToken !== 'string' || !pollToken) {
    return NextResponse.json({ error: 'poll_token_required' }, { status: 400 });
  }

  const pollTokenHash = await hashSecret(pollToken);
  const db = getDb();
  const [flow] = await db
    .select()
    .from(cliAuthFlows)
    .where(eq(cliAuthFlows.pollTokenHash, pollTokenHash))
    .limit(1);

  if (!flow) {
    return NextResponse.json({ error: 'flow_not_found' }, { status: 404 });
  }

  if (!flow.expiresAt || flow.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'flow_expired' }, { status: 410 });
  }

  if (!flow.completedAt || !flow.userId) {
    return NextResponse.json({ status: 'pending' });
  }

  if (flow.deviceToken && flow.deviceId && flow.userId && !flow.claimedAt) {
    const claimedAt = new Date();
    const flowUserId = flow.userId;
    const claimedFlow = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(cliAuthFlows)
        .set({ claimedAt })
        .where(
          and(
            eq(cliAuthFlows.pollTokenHash, pollTokenHash),
            eq(cliAuthFlows.userId, flowUserId),
            isNotNull(cliAuthFlows.completedAt),
            isNotNull(cliAuthFlows.deviceId),
            isNotNull(cliAuthFlows.deviceToken),
            isNull(cliAuthFlows.claimedAt),
            gt(cliAuthFlows.expiresAt, new Date()),
          ),
        )
        .returning({
          deviceToken: cliAuthFlows.deviceToken,
          deviceId: cliAuthFlows.deviceId,
          userId: cliAuthFlows.userId,
          joinArena: cliAuthFlows.joinArena,
        });

      if (!row?.deviceToken || !row.deviceId || !row.userId) {
        return null;
      }

      await joinArenaIfRequested(tx, row);

      await tx
        .update(devices)
        .set({ confirmedAt: claimedAt, updatedAt: claimedAt })
        .where(eq(devices.id, row.deviceId));

      return row;
    });

    if (claimedFlow?.deviceToken && claimedFlow.deviceId && claimedFlow.userId) {
      const [user] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, claimedFlow.userId))
        .limit(1);

      const response = NextResponse.json({
        status: 'complete',
        endpoint: getCloudUrl(),
        deviceToken: claimedFlow.deviceToken,
        deviceId: claimedFlow.deviceId,
        username: user?.username ?? 'unknown',
        arenaJoined: claimedFlow.joinArena ?? false,
      });

      await db
        .update(cliAuthFlows)
        .set({ deviceToken: null })
        .where(eq(cliAuthFlows.pollTokenHash, pollTokenHash));
      await recordDeviceTokenClaimed(db, request, {
        userId: claimedFlow.userId,
        deviceId: claimedFlow.deviceId,
      });

      return response;
    }
  }

  if (!flow.deviceId && !flow.deviceToken) {
    const claimedFlow = await claimNewCliDevice(
      db,
      { ...flow, userId: flow.userId },
      pollTokenHash,
    );

    if (claimedFlow?.deviceToken && claimedFlow.deviceId && claimedFlow.userId) {
      const [user] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, claimedFlow.userId))
        .limit(1);

      const response = NextResponse.json({
        status: 'complete',
        endpoint: getCloudUrl(),
        deviceToken: claimedFlow.deviceToken,
        deviceId: claimedFlow.deviceId,
        username: user?.username ?? 'unknown',
        arenaJoined: claimedFlow.joinArena ?? false,
      });

      await db
        .update(cliAuthFlows)
        .set({ deviceToken: null })
        .where(eq(cliAuthFlows.pollTokenHash, pollTokenHash));
      await recordDeviceTokenClaimed(db, request, {
        userId: claimedFlow.userId,
        deviceId: claimedFlow.deviceId,
      });

      return response;
    }
  }

  if (flow.deviceToken) {
    await db
      .update(cliAuthFlows)
      .set({ deviceToken: null })
      .where(eq(cliAuthFlows.pollTokenHash, pollTokenHash));
  }

  return NextResponse.json({ error: 'device_token_unavailable' }, { status: 410 });
}
