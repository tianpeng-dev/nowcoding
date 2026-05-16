import { sql } from 'drizzle-orm';
import { bigint, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

// P0-5: Composite primary key MUST use `primaryKey({ columns: [...] })`.
// Setting `.primaryKey()` on each column individually would create two
// separate single-column PKs in Drizzle, which Postgres rejects.
export const syncState = pgTable(
  'sync_state',
  {
    source: text('source').notNull(),
    hostname: text('hostname').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastFileMtime: timestamp('last_file_mtime', { withTimezone: true }),
    totalBuckets: bigint('total_buckets', { mode: 'bigint' }).notNull().default(sql`0`),
    totalSessions: bigint('total_sessions', { mode: 'bigint' }).notNull().default(sql`0`),
    totalErrors: integer('total_errors').notNull().default(0),
    lastErrorMessage: text('last_error_message'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.source, table.hostname] }),
  }),
);

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;
