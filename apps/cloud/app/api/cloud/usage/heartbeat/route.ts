import { devices, getDb } from '@nowcoding/cloud-db';
import { heartbeatRequestSchema } from '@nowcoding/core';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateDeviceRequest } from '../../../../../lib/device-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const device = await authenticateDeviceRequest(request.headers.get('authorization'));

  if (!device) {
    return errorResponse('unauthorized', 401);
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }

  const parsed = heartbeatRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues.slice(0, 20) },
      { status: 400 },
    );
  }

  const lastSeenAt = new Date();

  await getDb()
    .update(devices)
    .set({ lastSeenAt, updatedAt: lastSeenAt })
    .where(eq(devices.id, device.id));

  return NextResponse.json(
    { ok: true, lastSeenAt: lastSeenAt.toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
