import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../drizzle/0003_supabase_rls.sql', import.meta.url),
  'utf8',
);

const normalizedMigration = migration.toLowerCase().replace(/\s+/g, ' ');

const deviceManagementMigration = readFileSync(
  new URL('../drizzle/0006_device_management.sql', import.meta.url),
  'utf8',
);

const normalizedDeviceManagementMigration = deviceManagementMigration
  .toLowerCase()
  .replace(/\s+/g, ' ');

const hardenedTables = [
  'users',
  'devices',
  'cli_auth_flows',
  'usage_buckets',
  'usage_sessions',
  'arena_consents',
  'leaderboard_entries',
];

const hardenedSequences = [
  'usage_buckets_id_seq',
  'usage_sessions_id_seq',
  'leaderboard_entries_id_seq',
];

describe('Supabase RLS hardening migration', () => {
  it('enables row level security on every Cloud table if it exists', () => {
    for (const table of hardenedTables) {
      expect(normalizedMigration).toContain(
        `alter table if exists public.${table} enable row level security;`,
      );
    }
  });

  it('revokes direct public, anon, and authenticated table access from every Cloud table', () => {
    expect(normalizedMigration).toContain(
      'revoke all on table public.%i from public, anon, authenticated',
    );

    for (const table of hardenedTables) {
      expect(normalizedMigration).toContain(`'${table}'`);
    }
  });

  it('revokes public, anon, and authenticated access from sequence-backed ids', () => {
    expect(normalizedMigration).toContain(
      'revoke all on sequence public.%i from public, anon, authenticated',
    );

    for (const sequence of hardenedSequences) {
      expect(normalizedMigration).toContain(`'${sequence}'`);
    }
  });

  it('documents that public data is served through trusted application routes', () => {
    expect(normalizedMigration).toMatch(/trusted server credentials/i);
    expect(normalizedMigration).toMatch(/application routes/i);
    expect(normalizedMigration).toMatch(/not direct supabase table reads/i);
  });

  it('hardens account security events created after the baseline RLS migration', () => {
    expect(normalizedDeviceManagementMigration).toContain(
      'alter table if exists public.account_security_events enable row level security;',
    );
    expect(normalizedDeviceManagementMigration).toContain(
      'revoke all on table public.account_security_events from public, anon, authenticated;',
    );
    expect(normalizedDeviceManagementMigration).toContain(
      'revoke all on sequence public.account_security_events_id_seq from public, anon, authenticated;',
    );
  });
});
