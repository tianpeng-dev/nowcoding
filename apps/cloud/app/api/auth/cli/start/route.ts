import {
  createCliFlowToken,
  createPollToken,
  getCloudUrl,
  hashSecret,
} from '@nowcoding/cloud-core';
import { cliAuthFlows, getDb } from '@nowcoding/cloud-db';
import { type NextRequest, NextResponse } from 'next/server';

const FLOW_TTL_MS = 10 * 60 * 1000;

function parseDeviceName(value: unknown): string {
  if (typeof value !== 'string') {
    return 'NowCoding CLI';
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 120) : 'NowCoding CLI';
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const payload = body as { deviceName?: unknown; joinArena?: unknown };
  const deviceName = parseDeviceName(payload.deviceName);
  const joinArena = typeof payload.joinArena === 'boolean' ? payload.joinArena : false;
  const pollToken = createPollToken();
  const flowToken = createCliFlowToken();
  const pollTokenHash = await hashSecret(pollToken);
  const userCodeHash = await hashSecret(flowToken);
  const expiresAt = new Date(Date.now() + FLOW_TTL_MS);

  await getDb().insert(cliAuthFlows).values({
    pollTokenHash,
    userCodeHash,
    deviceName,
    joinArena,
    expiresAt,
  });

  const cloudUrl = getCloudUrl();
  const returnTo = `/login/device?flow=${encodeURIComponent(flowToken)}`;
  const verificationUrl = `${cloudUrl}/api/auth/github/start?returnTo=${encodeURIComponent(
    returnTo,
  )}`;

  return NextResponse.json({
    verificationUrl,
    pollToken,
    expiresAt: expiresAt.toISOString(),
  });
}
