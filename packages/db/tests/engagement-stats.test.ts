import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPeriodStats } from '../src/queries/stats';
import * as schema from '../src/schema/index';

type StatsDb = Parameters<typeof getPeriodStats>[0];

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

async function createBucketsTable() {
  await pg.exec(`
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
  `);
}

async function createSessionsTable() {
  await pg.exec(`
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

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema });
  await createBucketsTable();
  await createSessionsTable();
});

afterEach(async () => {
  vi.useRealTimers();
  await pg.close();
});

describe('engagement stats aggregation', () => {
  it('estimates time saved from generated output including reasoning tokens', async () => {
    await db.insert(schema.buckets).values([
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T08:00:00Z'),
        outputTokens: 1_000n,
        reasoningOutputTokens: 1_000_000n,
        totalTokens: 1_001_000n,
        requestCount: 50n,
      },
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T22:00:00Z'),
        outputTokens: 500n,
        reasoningOutputTokens: 500n,
        totalTokens: 1_000n,
        requestCount: 2n,
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(stats.timeSavedMinutes).toBe(960);
  });

  it('finds the strongest three-hour UTC activity window by request count', async () => {
    await db.insert(schema.buckets).values([
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T01:00:00Z'),
        outputTokens: 10n,
        totalTokens: 10_000_000n,
        requestCount: 1n,
      },
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T14:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 10n,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T15:00:00Z'),
        outputTokens: 120n,
        totalTokens: 120n,
        requestCount: 10n,
      },
      {
        source: 'claude-code',
        model: 'haiku',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T16:00:00Z'),
        outputTokens: 130n,
        totalTokens: 130n,
        requestCount: 10n,
      },
      {
        source: 'legacy-import',
        model: 'unknown',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T23:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 0n,
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(stats.peakActivity).toEqual({
      startHour: 14,
      endHour: 17,
      label: '14:00 - 17:00',
    });
  });

  it('counts legacy token activity as one interaction when request count is zero', async () => {
    await db.insert(schema.buckets).values([
      {
        source: 'legacy-import',
        model: 'unknown',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T04:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 0n,
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(stats.peakActivity).toEqual({
      startHour: 2,
      endHour: 5,
      label: '02:00 - 05:00',
    });
  });

  it('populates milestone from engagement helper inputs', async () => {
    await db.insert(schema.buckets).values([
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T08:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 1n,
      },
      {
        source: 'cursor',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T09:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 1n,
      },
      {
        source: 'codex',
        model: 'gpt-5',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T10:00:00Z'),
        outputTokens: 100n,
        totalTokens: 100n,
        requestCount: 1n,
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(stats.milestone).toBe('3 TOOL EXPLORER');
  });

  it('aggregates session count and active seconds', async () => {
    await db.insert(schema.sessions).values([
      {
        source: 'claude-code',
        project: 'demo',
        hostname: 'mac',
        sessionHash: 'session-1',
        firstMessageAt: new Date('2026-05-13T08:00:00Z'),
        lastMessageAt: new Date('2026-05-13T08:15:00Z'),
        activeSeconds: 600,
      },
      {
        source: 'cursor',
        project: 'demo',
        hostname: 'mac',
        sessionHash: 'session-2',
        firstMessageAt: new Date('2026-05-13T09:00:00Z'),
        lastMessageAt: new Date('2026-05-13T09:45:00Z'),
        activeSeconds: 1200,
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(stats.sessionCount).toBe(2);
    expect(stats.activeSeconds).toBe(1800);
  });

  it('excludes sessions outside non-all periods', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    await db.insert(schema.sessions).values({
      source: 'claude-code',
      project: 'demo',
      hostname: 'mac',
      sessionHash: 'old-session',
      firstMessageAt: new Date('2026-05-13T10:00:00Z'),
      lastMessageAt: new Date('2026-05-13T11:59:59Z'),
      activeSeconds: 1200,
    });

    const today = await getPeriodStats(db as unknown as StatsDb, '1d');
    const sevenDays = await getPeriodStats(db as unknown as StatsDb, '7d');

    expect(today.sessionCount).toBe(0);
    expect(today.activeSeconds).toBe(0);
    expect(sevenDays.sessionCount).toBe(0);
    expect(sevenDays.activeSeconds).toBe(0);
  });

  it('counts cross-boundary sessions but caps active seconds to period overlap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    await db.insert(schema.sessions).values({
      source: 'claude-code',
      project: 'demo',
      hostname: 'mac',
      sessionHash: 'cross-boundary-session',
      firstMessageAt: new Date('2026-05-19T10:00:00Z'),
      lastMessageAt: new Date('2026-05-19T12:30:00Z'),
      activeSeconds: 7200,
    });

    const today = await getPeriodStats(db as unknown as StatsDb, '1d');

    expect(today.sessionCount).toBe(1);
    expect(today.activeSeconds).toBe(1800);
  });

  it('uses the owner timezone for today stats when provided', async () => {
    const now = new Date('2026-05-20T02:00:00Z');

    await db.insert(schema.buckets).values([
      {
        source: 'claude-code',
        model: 'claude-sonnet-4',
        bucketStart: new Date('2026-05-19T10:00:00Z'),
        inputTokens: 300n,
        outputTokens: 200n,
        totalTokens: 500n,
        requestCount: 1n,
      },
      {
        source: 'claude-code',
        model: 'claude-sonnet-4',
        bucketStart: new Date('2026-05-19T17:00:00Z'),
        inputTokens: 600n,
        outputTokens: 400n,
        totalTokens: 1000n,
        requestCount: 1n,
      },
    ]);

    await db.insert(schema.sessions).values([
      {
        source: 'claude-code',
        project: 'demo',
        hostname: 'mac',
        sessionHash: 'previous-local-day-session',
        firstMessageAt: new Date('2026-05-19T15:00:00Z'),
        lastMessageAt: new Date('2026-05-19T15:30:00Z'),
        activeSeconds: 1200,
      },
      {
        source: 'claude-code',
        project: 'demo',
        hostname: 'mac',
        sessionHash: 'current-local-day-session',
        firstMessageAt: new Date('2026-05-19T15:30:00Z'),
        lastMessageAt: new Date('2026-05-19T16:30:00Z'),
        activeSeconds: 2400,
      },
    ]);

    const today = await getPeriodStats(db as unknown as StatsDb, '1d', {
      now,
      timezone: 'Asia/Shanghai',
    });

    expect(today.totalTokens).toBe(1000n);
    expect(today.sessionCount).toBe(1);
    expect(today.activeSeconds).toBe(1800);
  });

  it('uses full session active seconds for all-time stats', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    await db.insert(schema.sessions).values({
      source: 'claude-code',
      project: 'demo',
      hostname: 'mac',
      sessionHash: 'all-time-session',
      firstMessageAt: new Date('2026-05-19T10:00:00Z'),
      lastMessageAt: new Date('2026-05-19T12:30:00Z'),
      activeSeconds: 7200,
    });

    const allTime = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(allTime.sessionCount).toBe(1);
    expect(allTime.activeSeconds).toBe(7200);
  });
});
