import { bigserial, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// v1.5+ table — schema defined now so a future migration can create it
// without coordinating multiple PRs. NOT created in v1.0 migrations.
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('events_type_idx').on(table.type),
    timeIdx: index('events_time_idx').on(table.occurredAt),
  }),
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
