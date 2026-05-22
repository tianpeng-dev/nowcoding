import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  await pg.close();
});

describe('M2 stats cost aggregation', () => {
  it('sums persisted bucket costs into PeriodStats', async () => {
    await db.insert(schema.buckets).values([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T08:00:00Z'),
        inputTokens: 100n,
        outputTokens: 50n,
        cachedInputTokens: 10n,
        reasoningOutputTokens: 5n,
        totalTokens: 150n,
        requestCount: 1n,
        costUsd: '0.125000',
        priceVersion: '2026-05-13-v1',
      },
      {
        source: 'claude-code',
        model: 'sonnet',
        project: 'demo',
        hostname: 'mac',
        bucketStart: new Date('2026-05-13T09:00:00Z'),
        inputTokens: 200n,
        outputTokens: 75n,
        cachedInputTokens: 20n,
        reasoningOutputTokens: 10n,
        totalTokens: 275n,
        requestCount: 2n,
        costUsd: '0.375000',
        priceVersion: '2026-05-13-v1',
      },
    ]);

    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(Number(stats.estimatedCostUsd)).toBe(0.5);
    expect(stats.timeSavedMinutes).toBe(7);
    expect(stats.peakActivity).toEqual({
      startHour: 7,
      endHour: 10,
      label: '07:00 - 10:00',
    });
  });

  it('returns zero estimated cost for an empty table', async () => {
    const stats = await getPeriodStats(db as unknown as StatsDb, 'all');

    expect(Number(stats.estimatedCostUsd)).toBe(0);
    expect(stats.estimatedCostUsd).toBe('0');
    expect(stats.timeSavedMinutes).toBe(0);
    expect(stats.peakActivity).toBeNull();
    expect(stats.milestone).toBeNull();
  });
});
