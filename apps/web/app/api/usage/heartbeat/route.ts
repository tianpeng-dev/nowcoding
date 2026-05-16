import { verifyBearer } from '@/lib/auth';
import { getEnv, getServerPrivacy } from '@/lib/env';
import { resolveHeartbeatLastSeenAt } from '@/lib/now-response';
import { applyPrivacyToHostname, applyPrivacyToProject } from '@nowcoding/core/privacy';
import { heartbeatRequestSchema } from '@nowcoding/core/schemas';
import { getDb, recordHeartbeat } from '@nowcoding/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const env = getEnv();
  if (!verifyBearer(req.headers.get('authorization'), env.NOWCODING_API_TOKEN)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 500 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = heartbeatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_PAYLOAD', issues: parsed.error.issues.slice(0, 20) },
      { status: 400 },
    );
  }

  const privacy = getServerPrivacy();
  const hostname = req.headers.get('x-hostname')?.trim() || 'unknown';
  const lastSeenAt = resolveHeartbeatLastSeenAt(parsed.data.observedAt);

  try {
    const db = getDb(env.DATABASE_URL);
    await recordHeartbeat(db, {
      source: parsed.data.source,
      model: parsed.data.model ?? null,
      project: applyPrivacyToProject(parsed.data.project, privacy.uploadProject),
      hostname: applyPrivacyToHostname(hostname, privacy.uploadHostname),
      lastSeenAt,
    });
    return NextResponse.json(
      { ok: true, lastSeenAt: lastSeenAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[heartbeat] failed:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
