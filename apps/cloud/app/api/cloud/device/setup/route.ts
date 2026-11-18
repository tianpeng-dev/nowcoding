import { devices, getDb } from '@nowcoding/cloud-db';
import { eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateDeviceRequest } from '../../../../../lib/device-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETUP_SOURCES = new Set(['login', 'daemon', 'manual']);
const SKIPPED_REASONS = new Set(['user_skipped', 'non_interactive', 'install_failed']);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function safeSource(value: unknown): 'login' | 'daemon' | 'manual' {
  return typeof value === 'string' && SETUP_SOURCES.has(value)
    ? (value as 'login' | 'daemon' | 'manual')
    : 'login';
}

function safeSkippedReason(value: unknown): string | null {
  return typeof value === 'string' && SKIPPED_REASONS.has(value) ? value : null;
}

function safeReportedAt(value: unknown): string {
  if (typeof value === 'string') {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
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

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return errorResponse('invalid_payload', 400);
  }

  const body = json as Record<string, unknown>;

  if (typeof body.automaticSyncEnabled !== 'boolean') {
    return errorResponse('automatic_sync_enabled_required', 400);
  }

  const updatedAt = new Date();
  const automaticSync = {
    enabled: body.automaticSyncEnabled,
    source: safeSource(body.source),
    skippedReason: safeSkippedReason(body.skippedReason),
    reportedAt: safeReportedAt(body.reportedAt),
  };
  const clientInfo = sql`
    jsonb_set(
      case
        when jsonb_typeof(coalesce(${devices.clientInfo}, '{}'::jsonb)) = 'object'
          then coalesce(${devices.clientInfo}, '{}'::jsonb)
        else '{}'::jsonb
      end,
      '{automaticSync}',
      ${JSON.stringify(automaticSync)}::jsonb,
      true
    )
  `;
  const [updated] = await getDb()
    .update(devices)
    .set({
      clientInfo,
      updatedAt,
    })
    .where(eq(devices.id, device.id))
    .returning({ updatedAt: devices.updatedAt });

  return NextResponse.json(
    { ok: true, updatedAt: (updated?.updatedAt ?? updatedAt).toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
