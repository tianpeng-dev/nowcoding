import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0005_fk_indexes.sql', import.meta.url), 'utf8');

const normalizedMigration = migration.toLowerCase().replace(/\s+/g, ' ');

const expectedIndexes = [
  'devices_user_id_idx',
  'cli_auth_flows_user_id_idx',
  'cli_auth_flows_device_id_idx',
  'usage_buckets_device_id_idx',
  'usage_sessions_device_id_idx',
  'leaderboard_entries_user_id_idx',
];

describe('foreign key index migration', () => {
  it('drops the duplicate CLI auth user code hash index', () => {
    expect(normalizedMigration).toContain(
      'drop index if exists public.cli_auth_flows_user_code_hash_idx;',
    );
  });

  it('adds covering indexes for Supabase advisor foreign key findings', () => {
    for (const indexName of expectedIndexes) {
      expect(normalizedMigration).toContain(`create index if not exists ${indexName}`);
    }
  });
});
