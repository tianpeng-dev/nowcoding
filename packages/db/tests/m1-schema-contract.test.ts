import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readBaselineMigration(): string {
  const drizzleDir = path.join(process.cwd(), 'packages/db/drizzle');
  const sqlFiles = readdirSync(drizzleDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  expect(sqlFiles.length).toBeGreaterThan(0);
  return readFileSync(path.join(drizzleDir, sqlFiles[0]), 'utf8');
}

describe('M1 v1 schema migration contract', () => {
  it('creates the v1 core tables and excludes v1.5 events', () => {
    const migration = readBaselineMigration();

    expect(migration).toContain('CREATE TABLE "owner"');
    expect(migration).toContain('CREATE TABLE "buckets"');
    expect(migration).toContain('CREATE TABLE "sessions"');
    expect(migration).toContain('CREATE TABLE "sync_state"');
    expect(migration).toContain('CREATE TABLE "heartbeats"');
    expect(migration).not.toContain('CREATE TABLE "events"');
  });

  it('includes timezone cost and price version columns', () => {
    const migration = readBaselineMigration();

    expect(migration).toMatch(/"timezone" text DEFAULT 'UTC' NOT NULL/i);
    expect(migration).toMatch(/"cost_usd" numeric\(12,\s*6\) DEFAULT '0' NOT NULL/i);
    expect(migration).toMatch(/"price_version" text DEFAULT '2026-05-13-v1' NOT NULL/i);
  });

  it('indexes heartbeat lookup fields', () => {
    const migration = readBaselineMigration();

    expect(migration).toContain('heartbeats_source_idx');
    expect(migration).toContain('heartbeats_last_seen_idx');
  });
});
