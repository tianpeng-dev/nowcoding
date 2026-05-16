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

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema });
  await createBucketsTable();
});

afterEach(async () => {
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
});
