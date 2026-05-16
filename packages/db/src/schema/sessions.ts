import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// session_hash = sha256(originalSessionId).slice(0,16) — original IDs never leave the CLI.
export const sessions = pgTable(
  'sessions',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    source: text('source').notNull(),
    project: text('project').notNull().default('unknown'),
    sessionHash: text('session_hash').notNull(),
    firstMessageAt: timestamp('first_message_at', { withTimezone: true }).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    activeSeconds: integer('active_seconds').notNull().default(0),
    messageCount: integer('message_count').notNull().default(0),
    userMessageCount: integer('user_message_count').notNull().default(0),
    userPromptHours: jsonb('user_prompt_hours').notNull().default([]),
    hostname: text('hostname').notNull().default('unknown'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniq: uniqueIndex('sessions_uniq_idx').on(table.sessionHash, table.source, table.hostname),
    timeIdx: index('sessions_time_idx').on(table.firstMessageAt),
    lastMessageIdx: index('sessions_last_message_idx').on(table.lastMessageAt),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
