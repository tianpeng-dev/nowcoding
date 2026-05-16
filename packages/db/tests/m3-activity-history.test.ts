import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getHeatmap as getPublicHeatmap, getStreak as getPublicStreak } from '../src/index';
import { getHeatmap } from '../src/queries/heatmap';
import { getStreak } from '../src/queries/streak';
import * as schema from '../src/schema/index';

type ActivityDb = Parameters<typeof getStreak>[0];

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
  await createBucketsTable();
});

afterEach(async () => {
  await pg.close();
});

describe('M3 activity history queries', () => {
  it('computes streaks using owner timezone day boundaries', async () => {
    await insertBucket('2026-05-12T16:30:00.000Z', 100n);
    await insertBucket('2026-05-13T16:30:00.000Z', 100n);

    const result = await getStreak(db as unknown as ActivityDb, {
      timezone: 'Asia/Shanghai',
      now: new Date('2026-05-14T02:00:00.000Z'),
    });

    expect(result).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-14',
    });
  });

  it('recomputes longest streak after a historical day is backfilled', async () => {
    await insertBucket('2026-05-10T10:00:00.000Z', 100n);
    await insertBucket('2026-05-11T10:00:00.000Z', 100n);
    await insertBucket('2026-05-13T10:00:00.000Z', 100n);
    await insertBucket('2026-05-14T10:00:00.000Z', 100n);

    expect(
      await getStreak(db as unknown as ActivityDb, {
        timezone: 'UTC',
        now: new Date('2026-05-14T12:00:00.000Z'),
      }),
    ).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-05-14',
    });

    await insertBucket('2026-05-12T10:00:00.000Z', 100n);

    expect(
      await getStreak(db as unknown as ActivityDb, {
        timezone: 'UTC',
        now: new Date('2026-05-14T12:00:00.000Z'),
      }),
    ).toEqual({
      current: 5,
      longest: 5,
      lastActiveDate: '2026-05-14',
    });
  });

  it('aggregates yearly heatmap cells by owner timezone', async () => {
    await insertBucket('2026-12-31T16:30:00.000Z', 25_000n, '0.250000');
    await insertBucket('2027-01-01T00:30:00.000Z', 25_000n, '0.250000');
    await insertBucket('2027-01-02T08:00:00.000Z', 1_000_000n, '5.000000');

    const heatmap = await getHeatmap(db as unknown as ActivityDb, {
      year: 2027,
      timezone: 'Asia/Shanghai',
    });

    expect(heatmap.year).toBe(2027);
    expect(heatmap.timezone).toBe('Asia/Shanghai');
    expect(heatmap.cells).toHaveLength(365);
    expect(heatmap.cells.find((cell) => cell.date === '2027-01-01')).toMatchObject({
      tokens: 50_000,
      estimatedCostUsd: 0.5,
      level: 2,
    });
    expect(heatmap.cells.find((cell) => cell.date === '2027-01-02')).toMatchObject({
      tokens: 1_000_000,
      estimatedCostUsd: 5,
      level: 4,
    });
  });

  it('aggregates heatmap costs with fixed decimal precision', async () => {
    await insertBucket('2027-03-01T01:00:00.000Z', 10_000n, '0.100000');
    await insertBucket('2027-03-01T02:00:00.000Z', 10_000n, '0.200000');

    const heatmap = await getHeatmap(db as unknown as ActivityDb, {
      year: 2027,
      timezone: 'UTC',
    });

    expect(heatmap.cells.find((cell) => cell.date === '2027-03-01')).toMatchObject({
      tokens: 20_000,
      estimatedCostUsd: 0.3,
    });
  });

  it('throws before losing precision for heatmap token totals above safe integer range', async () => {
    await insertBucket('2027-04-01T01:00:00.000Z', BigInt(Number.MAX_SAFE_INTEGER) + 1n);

    await expect(
      getHeatmap(db as unknown as ActivityDb, {
        year: 2027,
        timezone: 'UTC',
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      getHeatmap(db as unknown as ActivityDb, {
        year: 2027,
        timezone: 'UTC',
      }),
    ).rejects.toThrow('exceeds Number.MAX_SAFE_INTEGER');
  });

  it('validates heatmap year before querying buckets', async () => {
    await pg.exec('DROP TABLE buckets;');

    await expect(
      getHeatmap(db as unknown as ActivityDb, {
        year: 1969,
        timezone: 'UTC',
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      getHeatmap(db as unknown as ActivityDb, {
        year: 1969,
        timezone: 'UTC',
      }),
    ).rejects.toThrow('Heatmap year must be an integer between 1970 and 9999');
  });

  it('validates heatmap timezone even when no buckets exist', async () => {
    await expect(
      getHeatmap(db as unknown as ActivityDb, {
        year: 2027,
        timezone: 'Not/AZone',
      }),
    ).rejects.toThrow(RangeError);
  });

  it('exports activity queries from the public DB entrypoint', async () => {
    await insertBucket('2027-05-01T01:00:00.000Z', 10_000n, '0.100000');

    const heatmap = await getPublicHeatmap(db as unknown as ActivityDb, {
      year: 2027,
      timezone: 'UTC',
    });
    const streak = await getPublicStreak(db as unknown as ActivityDb, {
      timezone: 'UTC',
      now: new Date('2027-05-01T12:00:00.000Z'),
    });

    expect(heatmap.cells.find((cell) => cell.date === '2027-05-01')).toMatchObject({
      tokens: 10_000,
      estimatedCostUsd: 0.1,
    });
    expect(streak).toMatchObject({
      current: 1,
      lastActiveDate: '2027-05-01',
    });
  });
});
