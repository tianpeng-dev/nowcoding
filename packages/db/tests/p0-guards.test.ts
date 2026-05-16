import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// P0-4 guard: prove that the unique index on
// (source, model, project, bucket_start, hostname) deduplicates rows
// when ALL columns are NOT NULL, AND that NULL values defeat the dedup
// (the failure mode the schema must prevent).

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE buckets_strict (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      model TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT 'unknown',
      hostname TEXT NOT NULL DEFAULT 'unknown',
      bucket_start TIMESTAMPTZ NOT NULL,
      input_tokens BIGINT NOT NULL DEFAULT 0,
      output_tokens BIGINT NOT NULL DEFAULT 0,
      total_tokens BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX buckets_strict_uniq
      ON buckets_strict (source, model, project, bucket_start, hostname);

    CREATE TABLE buckets_loose (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      model TEXT NOT NULL,
      project TEXT,
      hostname TEXT,
      bucket_start TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX buckets_loose_uniq
      ON buckets_loose (source, model, project, bucket_start, hostname);
  `);
});

afterAll(async () => {
  await pg.close();
});

describe('P0-4: hostname/project NOT NULL preserves dedup', () => {
  it('upsert with same key twice produces one row (strict schema)', async () => {
    const sql = `
      INSERT INTO buckets_strict
        (source, model, project, hostname, bucket_start, input_tokens, output_tokens, total_tokens)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source, model, project, bucket_start, hostname)
      DO UPDATE SET
        input_tokens = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        total_tokens = EXCLUDED.total_tokens,
        updated_at = NOW();
    `;
    const args = [
      'claude-code',
      'opus',
      'demo',
      'mac',
      new Date('2026-05-08T10:00:00Z').toISOString(),
      100,
      50,
      150,
    ];
    await pg.query(sql, args);
    await pg.query(sql, args);
    await pg.query(sql, [
      ...args.slice(0, 5),
      999, // bumped tokens — should overwrite, not create a row
      999,
      1998,
    ]);
    const r = await pg.query<{ count: string; total: string }>(
      'SELECT COUNT(*)::text AS count, MAX(total_tokens)::text AS total FROM buckets_strict',
    );
    expect(r.rows[0]?.count).toBe('1');
    expect(r.rows[0]?.total).toBe('1998');
  });

  it('with NULL hostname the same key produces duplicate rows (loose schema, demonstrates the bug we prevent)', async () => {
    const sql = `
      INSERT INTO buckets_loose (source, model, project, hostname, bucket_start)
      VALUES ($1, $2, $3, $4, $5);
    `;
    const args = [
      'claude-code',
      'opus',
      'demo',
      null,
      new Date('2026-05-08T11:00:00Z').toISOString(),
    ];
    await pg.query(sql, args);
    await pg.query(sql, args);
    const r = await pg.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM buckets_loose',
    );
    // Postgres treats NULL ≠ NULL in unique indexes, so without NOT NULL
    // we'd get 2 rows from the same logical key. Our schema prevents this
    // by enforcing NOT NULL DEFAULT 'unknown'.
    expect(r.rows[0]?.count).toBe('2');
  });
});
