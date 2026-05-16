import { gunzipSync } from 'node:zlib';
import { verifyBearer } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { buildBucketInsertRows } from '@/lib/ingest-cost';
import { ingestPayloadSchema } from '@nowcoding/core';
import { buckets, getDb, schema, sessions, syncState } from '@nowcoding/db';
import { sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const MAX_BODY = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const env = getEnv();
  if (!verifyBearer(req.headers.get('authorization'), env.NOWCODING_API_TOKEN)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 500 });
  }

  let body: Buffer;
  try {
    body = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  if (body.byteLength > MAX_BODY) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  if (req.headers.get('content-encoding') === 'gzip') {
    try {
      body = gunzipSync(body);
    } catch {
      return NextResponse.json({ error: 'INVALID_GZIP' }, { status: 400 });
    }
  }
  if (body.byteLength > MAX_BODY * 4) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = ingestPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_PAYLOAD', issues: parsed.error.issues.slice(0, 20) },
      { status: 400 },
    );
  }

  const hostname = req.headers.get('x-hostname')?.trim() || 'unknown';
  const db = getDb(env.DATABASE_URL);

  const bucketRows = buildBucketInsertRows(parsed.data.buckets, hostname);

  let storedBuckets = 0;
  if (bucketRows.length > 0) {
    // P0-4: hostname/project must be non-null for the unique index to dedup.
    await db
      .insert(buckets)
      .values(bucketRows)
      .onConflictDoUpdate({
        target: [
          buckets.source,
          buckets.model,
          buckets.project,
          buckets.bucketStart,
          buckets.hostname,
        ],
        set: {
          inputTokens: sql`excluded.input_tokens`,
          outputTokens: sql`excluded.output_tokens`,
          cachedInputTokens: sql`excluded.cached_input_tokens`,
          reasoningOutputTokens: sql`excluded.reasoning_output_tokens`,
          totalTokens: sql`excluded.total_tokens`,
          requestCount: sql`excluded.request_count`,
          costUsd: sql`excluded.cost_usd`,
          priceVersion: sql`excluded.price_version`,
          updatedAt: sql`now()`,
        },
      });
    storedBuckets = bucketRows.length;
  }

  let storedSessions = 0;
  if (parsed.data.sessions && parsed.data.sessions.length > 0) {
    const sessionRows = parsed.data.sessions.map((s) => ({
      source: s.source,
      project: s.project || 'unknown',
      sessionHash: s.sessionHash,
      firstMessageAt: new Date(s.firstMessageAt),
      lastMessageAt: new Date(s.lastMessageAt),
      durationSeconds: s.durationSeconds,
      activeSeconds: s.activeSeconds,
      messageCount: s.messageCount,
      userMessageCount: s.userMessageCount,
      userPromptHours: s.userPromptHours,
      hostname,
    }));
    await db.insert(sessions).values(sessionRows).onConflictDoNothing();
    storedSessions = sessionRows.length;
  }

  const sources = new Set(bucketRows.map((b) => b.source));
  for (const source of sources) {
    await db
      .insert(syncState)
      .values({
        source,
        hostname,
        lastSyncedAt: new Date(),
        totalBuckets: BigInt(bucketRows.filter((b) => b.source === source).length),
      })
      .onConflictDoUpdate({
        target: [syncState.source, syncState.hostname],
        set: {
          lastSyncedAt: sql`now()`,
          totalBuckets: sql`${syncState.totalBuckets} + excluded.total_buckets`,
          updatedAt: sql`now()`,
        },
      });
  }

  return NextResponse.json({
    received: { buckets: parsed.data.buckets.length, sessions: parsed.data.sessions?.length ?? 0 },
    stored: { buckets: storedBuckets, sessions: storedSessions },
  });
}

export async function DELETE(req: NextRequest) {
  const env = getEnv();
  if (!verifyBearer(req.headers.get('authorization'), env.NOWCODING_API_TOKEN)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 500 });
  }
  const hostnameParam = req.nextUrl.searchParams.get('hostname');
  if (!hostnameParam) {
    return NextResponse.json({ error: 'HOSTNAME_REQUIRED' }, { status: 400 });
  }
  const db = getDb(env.DATABASE_URL);
  const r1 = await db.delete(buckets).where(sql`${buckets.hostname} = ${hostnameParam}`);
  const r2 = await db.delete(sessions).where(sql`${sessions.hostname} = ${hostnameParam}`);
  void schema;
  return NextResponse.json({
    deleted: {
      buckets: (r1 as unknown as { rowCount?: number }).rowCount ?? 0,
      sessions: (r2 as unknown as { rowCount?: number }).rowCount ?? 0,
    },
  });
}
