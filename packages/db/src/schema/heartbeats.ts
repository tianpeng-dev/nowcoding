import { bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const heartbeats = pgTable(
  'heartbeats',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    source: text('source').notNull(),
    model: text('model'),
    project: text('project').notNull().default('unknown'),
    hostname: text('hostname').notNull().default('unknown'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index('heartbeats_source_idx').on(table.source),
    lastSeenIdx: index('heartbeats_last_seen_idx').on(table.lastSeenAt),
  }),
);

export type Heartbeat = typeof heartbeats.$inferSelect;
export type NewHeartbeat = typeof heartbeats.$inferInsert;
