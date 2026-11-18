import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationDir = new URL('../drizzle/', import.meta.url);
const migrationFiles = readdirSync(migrationDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const initialMigration = readFileSync(
  new URL('../drizzle/0000_initial_schema.sql', import.meta.url),
  'utf8',
)
  .toLowerCase()
  .replace(/\s+/g, ' ');

const baseTables = [
  'users',
  'devices',
  'cli_auth_flows',
  'usage_buckets',
  'usage_sessions',
  'arena_consents',
  'leaderboard_entries',
];

describe('fresh database bootstrap migrations', () => {
  it('runs a baseline schema migration before incremental migrations', () => {
    expect(migrationFiles[0]).toBe('0000_initial_schema.sql');
    expect(migrationFiles).toContain('0001_cli_device_token.sql');
    expect(migrationFiles).toContain('0006_device_management.sql');
    expect(migrationFiles.indexOf('0000_initial_schema.sql')).toBeLessThan(
      migrationFiles.indexOf('0001_cli_device_token.sql'),
    );
  });

  it('creates every table required by later migrations and runtime routes', () => {
    for (const table of baseTables) {
      expect(initialMigration).toContain(`create table if not exists public.${table}`);
    }
  });

  it('creates the index contracts used by the Drizzle schema', () => {
    expect(initialMigration).toContain(
      'create unique index if not exists usage_buckets_unique_idx',
    );
    expect(initialMigration).toContain(
      'create index if not exists usage_buckets_user_bucket_start_idx',
    );
    expect(initialMigration).toContain(
      'create unique index if not exists usage_sessions_unique_idx',
    );
    expect(initialMigration).toContain(
      'create index if not exists usage_sessions_user_last_message_at_idx',
    );
    expect(initialMigration).toContain(
      'create unique index if not exists leaderboard_entries_unique_idx',
    );
  });
});
