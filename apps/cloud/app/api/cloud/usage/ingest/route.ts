import { gunzipSync } from 'node:zlib';
import { devices, getDb, usageBuckets, usageSessions } from '@nowcoding/cloud-db';
import type { SessionWire } from '@nowcoding/core';
import { cloudIngestPayloadSchema } from '@nowcoding/core/schemas';
import { eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { toBucketRows } from '../../../../../lib/bucket-rows';
import {
  type AuthenticatedDevice,
  authenticateDeviceRequest,
} from '../../../../../lib/device-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BODY_BYTES = 6 * 1024 * 1024;

type BucketInsertRow = typeof usageBuckets.$inferInsert;
type SessionInsertRow = typeof usageSessions.$inferInsert;

async function parseJsonBody(request: NextRequest): Promise<unknown> {
  let body = Buffer.from(await request.arrayBuffer());

  if (body.byteLength > MAX_BODY_BYTES) {
    throw new Error('payload_too_large');
  }

  if (request.headers.get('content-encoding') === 'gzip') {
    try {
      body = gunzipSync(body, { maxOutputLength: MAX_BODY_BYTES * 4 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : null;

      if (code === 'ERR_BUFFER_TOO_LARGE' || message.includes('maxOutputLength')) {
        throw new Error('payload_too_large');
      }

      throw new Error('invalid_gzip');
    }
  }

  if (body.byteLength > MAX_BODY_BYTES * 4) {
    throw new Error('payload_too_large');
  }

  return JSON.parse(body.toString('utf8')) as unknown;
}

function sessionKey(row: SessionInsertRow): string {
  return [row.userId, row.deviceId, row.sessionHash, row.source, row.hostname].join('\0');
}

function toSessionRows(
  sessions: SessionWire[] | undefined,
  device: AuthenticatedDevice,
  hostname: string,
): SessionInsertRow[] {
  const deduped = new Map<string, SessionInsertRow>();

  for (const session of sessions ?? []) {
    const row: SessionInsertRow = {
      userId: device.userId,
      deviceId: device.id,
      source: session.source,
      project: session.project.trim() || 'unknown',
      sessionHash: session.sessionHash,
      firstMessageAt: new Date(session.firstMessageAt),
      lastMessageAt: new Date(session.lastMessageAt),
      durationSeconds: BigInt(session.durationSeconds),
      activeSeconds: BigInt(session.activeSeconds),
      messageCount: BigInt(session.messageCount),
      userMessageCount: BigInt(session.userMessageCount),
      userPromptHours: session.userPromptHours,
      hostname,
    };

    deduped.set(sessionKey(row), row);
  }

  return Array.from(deduped.values());
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function underreportedTokensResponse() {
  return NextResponse.json(
    {
      error: 'invalid_payload',
      issues: [
        {
          path: ['buckets', 'totalTokens'],
          message: 'totalTokens cannot be less than component token sum',
        },
      ],
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const device = await authenticateDeviceRequest(request.headers.get('authorization'));

  if (!device) {
    return errorResponse('unauthorized', 401);
  }

  let json: unknown;

  try {
    json = await parseJsonBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'payload_too_large') {
      return errorResponse('payload_too_large', 413);
    }

    if (error instanceof Error && error.message === 'invalid_gzip') {
      return errorResponse('invalid_gzip', 400);
    }

    return errorResponse('invalid_json', 400);
  }

  const parsed = cloudIngestPayloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues.slice(0, 20) },
      { status: 400 },
    );
  }

  const now = new Date();
  const hostname = request.headers.get('x-hostname')?.trim() || 'unknown';
  const db = getDb();
  let bucketRows: BucketInsertRow[];

  try {
    bucketRows = toBucketRows(parsed.data.buckets, device, hostname, now);
  } catch (error) {
    if (error instanceof Error && error.message === 'underreported_total_tokens') {
      return underreportedTokensResponse();
    }

    throw error;
  }

  const sessionRows = toSessionRows(parsed.data.sessions, device, hostname);

  await db
    .update(devices)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(eq(devices.id, device.id));

  if (bucketRows.length > 0) {
    await db
      .insert(usageBuckets)
      .values(bucketRows)
      .onConflictDoUpdate({
        target: [
          usageBuckets.userId,
          usageBuckets.deviceId,
          usageBuckets.source,
          usageBuckets.model,
          usageBuckets.project,
          usageBuckets.bucketStart,
          usageBuckets.hostname,
        ],
        set: {
          promptTokens: sql`excluded.prompt_tokens`,
          completionTokens: sql`excluded.completion_tokens`,
          totalTokens: sql`excluded.total_tokens`,
          requestCount: sql`excluded.request_count`,
          costUsd: sql`excluded.cost_usd`,
          excludedFromArenaAt: sql`excluded.excluded_from_arena_at`,
        },
      });
  }

  if (sessionRows.length > 0) {
    await db
      .insert(usageSessions)
      .values(sessionRows)
      .onConflictDoUpdate({
        target: [
          usageSessions.userId,
          usageSessions.deviceId,
          usageSessions.sessionHash,
          usageSessions.source,
          usageSessions.hostname,
        ],
        set: {
          project: sql`excluded.project`,
          firstMessageAt: sql`least(${usageSessions.firstMessageAt}, excluded.first_message_at)`,
          lastMessageAt: sql`greatest(${usageSessions.lastMessageAt}, excluded.last_message_at)`,
          durationSeconds: sql`greatest(${usageSessions.durationSeconds}, excluded.duration_seconds)`,
          activeSeconds: sql`greatest(${usageSessions.activeSeconds}, excluded.active_seconds)`,
          messageCount: sql`greatest(${usageSessions.messageCount}, excluded.message_count)`,
          userMessageCount: sql`greatest(${usageSessions.userMessageCount}, excluded.user_message_count)`,
          userPromptHours: sql`case when excluded.last_message_at >= ${usageSessions.lastMessageAt} then excluded.user_prompt_hours else ${usageSessions.userPromptHours} end`,
        },
      });
  }

  return NextResponse.json({
    received: {
      buckets: parsed.data.buckets.length,
      sessions: parsed.data.sessions?.length ?? 0,
    },
    stored: {
      buckets: bucketRows.length,
      sessions: sessionRows.length,
    },
  });
}
