import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../drizzle/0004_schema_migrations_rls.sql', import.meta.url),
  'utf8',
);

const normalizedMigration = migration.toLowerCase().replace(/\s+/g, ' ');

describe('schema migration history hardening', () => {
  it('enables RLS on the public migration history table', () => {
    expect(normalizedMigration).toContain(
      'alter table if exists public.nowcoding_schema_migrations enable row level security;',
    );
  });

  it('revokes direct public, anon, and authenticated access', () => {
    expect(normalizedMigration).toContain(
      'revoke all on table public.nowcoding_schema_migrations from public, anon, authenticated;',
    );
  });
});
