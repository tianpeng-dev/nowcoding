import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function queryDbJson(dbPath: string, sql: string): Record<string, unknown>[] {
  const db = openNodeSqlite(dbPath);
  if (db) {
    try {
      return db.prepare(sql).all() as Record<string, unknown>[];
    } finally {
      db.close();
    }
  }
  return queryViaCli(dbPath, sql);
}

function openNodeSqlite(dbPath: string): SqliteDatabase | null {
  try {
    const sqlite = require('node:sqlite') as {
      DatabaseSync?: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;
    };
    return sqlite.DatabaseSync ? new sqlite.DatabaseSync(dbPath, { readOnly: true }) : null;
  } catch {
    return null;
  }
}

function queryViaCli(dbPath: string, sql: string): Record<string, unknown>[] {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    timeout: 30_000,
  });
  const trimmed = out.trim();
  return trimmed ? (JSON.parse(trimmed) as Record<string, unknown>[]) : [];
}

interface SqliteDatabase {
  prepare(sql: string): { all(): unknown[] };
  close(): void;
}
