import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getNowActivity as getPublicNowActivity } from '../src/index';
import { getNowActivity, recordHeartbeat } from '../src/queries/activity';
import * as schema from '../src/schema/index';

type ActivityDb = Parameters<typeof recordHeartbeat>[0];

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

async function createTables() {
  await pg.exec(`
    CREATE TABLE heartbeats (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      model TEXT,
      project TEXT NOT NULL DEFAULT 'unknown',
      hostname TEXT NOT NULL DEFAULT 'unknown',
      last_seen_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE buckets (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      model TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT 'unknown',
      hostname TEXT NOT NULL DEFAULT 'unknown',
      bucket_start TIMESTAMPTZ NOT NULL,
      input_tokens BIGINT NOT NULL DEFAULT 0,
      output_tokens BIGINT NOT NULL DEFAULT 0,
      cached_input_tokens BIGINT NOT NULL DEFAULT 0,
      reasoning_output_tokens BIGINT NOT NULL DEFAULT 0,
      total_tokens BIGINT NOT NULL DEFAULT 0,
      request_count BIGINT NOT NULL DEFAULT 0,
      cost_usd NUMERIC(12, 6) NOT NULL DEFAULT '0',
      price_version TEXT NOT NULL DEFAULT '2026-05-13-v1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE sessions (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT 'unknown',
      session_hash TEXT NOT NULL,
      first_message_at TIMESTAMPTZ NOT NULL,
      last_message_at TIMESTAMPTZ NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      active_seconds INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      user_message_count INTEGER NOT NULL DEFAULT 0,
      user_prompt_hours JSONB NOT NULL DEFAULT '[]',
      hostname TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function insertBucket(bucketStart: string, totalTokens: bigint, costUsd = '0.000000') {
  await db.insert(schema.buckets).values({
    source: 'claude-code',
    model: 'claude-sonnet-4-6',
    project: 'demo',
    hostname: 'mac',
    bucketStart: new Date(bucketStart),
    inputTokens: totalTokens,
    outputTokens: 0n,
    cachedInputTokens: 0n,
    reasoningOutputTokens: 0n,
    totalTokens,
    requestCount: 1n,
    costUsd,
    priceVersion: '2026-05-13-v1',
  });
}

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema });
  await createTables();
});

afterEach(async () => {
  await pg.close();
});

describe('M4 live activity queries', () => {
  it('records heartbeat summaries without prompt content', async () => {
    await recordHeartbeat(db as unknown as ActivityDb, {
      source: 'claude-code',
      model: 'claude-sonnet-4-6',
      project: 'unknown',
      hostname: 'unknown',
      lastSeenAt: new Date('2026-05-14T12:00:00.000Z'),
    });

    const rows = await db.select().from(schema.heartbeats);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'claude-code',
      model: 'claude-sonnet-4-6',
      project: 'unknown',
      hostname: 'unknown',
    });
    expect(rows[0]?.lastSeenAt.toISOString()).toBe('2026-05-14T12:00:00.000Z');
  });

  it('uses the latest heartbeat, bucket, or session as current activity', async () => {
    await insertBucket('2026-05-14T10:00:00.000Z', 100n, '0.100000');
    await db.insert(schema.sessions).values({
      source: 'cursor',
      project: 'demo',
      sessionHash: '0123456789abcdef',
      firstMessageAt: new Date('2026-05-14T10:30:00.000Z'),
      lastMessageAt: new Date('2026-05-14T11:00:00.000Z'),
      durationSeconds: 10,
      activeSeconds: 10,
      messageCount: 1,
      userMessageCount: 1,
      userPromptHours: [],
      hostname: 'mac',
    });
    await recordHeartbeat(db as unknown as ActivityDb, {
      source: 'claude-code',
      model: 'claude-opus-4-7',
      project: 'demo',
      hostname: 'mac',
      lastSeenAt: new Date('2026-05-14T11:55:00.000Z'),
    });

    const now = await getNowActivity(db as unknown as ActivityDb, {
      timezone: 'UTC',
      now: new Date('2026-05-14T12:00:00.000Z'),
    });

    expect(now.lastActiveAt?.toISOString()).toBe('2026-05-14T11:55:00.000Z');
    expect(now.currentSource).toBe('claude-code');
    expect(now.currentModel).toBe('claude-opus-4-7');
  });

  it('aggregates today tokens and cost using owner timezone', async () => {
    await insertBucket('2026-05-13T16:30:00.000Z', 100n, '0.100000');
    await insertBucket('2026-05-14T02:00:00.000Z', 200n, '0.200000');
    await insertBucket('2026-05-14T16:30:00.000Z', 300n, '0.300000');

    const now = await getNowActivity(db as unknown as ActivityDb, {
      timezone: 'Asia/Shanghai',
      now: new Date('2026-05-14T12:00:00.000Z'),
    });

    expect(now.todayTokens).toBe(300);
    expect(now.todayEstimatedCostUsd).toBe(0.3);
  });

  it('includes exact local-day boundaries for the earliest IANA timezone', async () => {
    await insertBucket('2026-05-13T09:59:59.999Z', 10n);
    await insertBucket('2026-05-13T10:00:00.000Z', 20n);
    await insertBucket('2026-05-14T09:59:59.999Z', 30n);
    await insertBucket('2026-05-14T10:00:00.000Z', 40n);

    const now = await getNowActivity(db as unknown as ActivityDb, {
      timezone: 'Pacific/Kiritimati',
      now: new Date('2026-05-14T00:00:00.000Z'),
    });

    expect(now.todayTokens).toBe(50);
  });

  it('includes exact local-day boundaries for the latest IANA timezone', async () => {
    await insertBucket('2026-05-14T11:59:59.999Z', 10n);
    await insertBucket('2026-05-14T12:00:00.000Z', 20n);
    await insertBucket('2026-05-15T11:59:59.999Z', 30n);
    await insertBucket('2026-05-15T12:00:00.000Z', 40n);

    const now = await getNowActivity(db as unknown as ActivityDb, {
      timezone: 'Etc/GMT+12',
      now: new Date('2026-05-15T00:00:00.000Z'),
    });

    expect(now.todayTokens).toBe(50);
  });

  it('preserves six-decimal cost precision for today totals', async () => {
    await insertBucket('2026-05-14T02:00:00.000Z', 0n, '0.123456');
    await insertBucket('2026-05-14T03:00:00.000Z', 0n, '0.000001');

    const now = await getNowActivity(db as unknown as ActivityDb, {
      timezone: 'UTC',
      now: new Date('2026-05-14T12:00:00.000Z'),
    });

    expect(now.todayEstimatedCostUsd).toBe(0.123457);
  });

  it('throws before losing precision for today token totals', async () => {
    await insertBucket('2026-05-14T02:00:00.000Z', BigInt(Number.MAX_SAFE_INTEGER) + 1n);

    await expect(
      getNowActivity(db as unknown as ActivityDb, {
        timezone: 'UTC',
        now: new Date('2026-05-14T12:00:00.000Z'),
      }),
    ).rejects.toThrow(RangeError);
  });

  it('throws before losing precision for today cost totals', async () => {
    await pg.exec(`
      INSERT INTO buckets (
        source,
        model,
        project,
        hostname,
        bucket_start,
        input_tokens,
        output_tokens,
        cached_input_tokens,
        reasoning_output_tokens,
        total_tokens,
        request_count,
        cost_usd,
        price_version
      )
      SELECT
        'claude-code',
        'claude-sonnet-4-6',
        'demo',
        'mac',
        TIMESTAMPTZ '2026-05-14T02:00:00.000Z',
        0,
        0,
        0,
        0,
        0,
        1,
        '999999.999999',
        '2026-05-13-v1'
      FROM generate_series(1, 9008);
    `);

    await expect(
      getNowActivity(db as unknown as ActivityDb, {
        timezone: 'UTC',
        now: new Date('2026-05-14T12:00:00.000Z'),
      }),
    ).rejects.toThrow(RangeError);
  });

  it('exports now activity query from the public DB entrypoint', async () => {
    const now = await getPublicNowActivity(db as unknown as ActivityDb, {
      timezone: 'UTC',
      now: new Date('2026-05-14T12:00:00.000Z'),
    });

    expect(now).toMatchObject({
      lastActiveAt: null,
      currentSource: null,
      currentModel: null,
      todayTokens: 0,
      todayEstimatedCostUsd: 0,
    });
  });
});
