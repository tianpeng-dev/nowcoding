import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const COST_PRICE_VERSION = '2026-05-13-v1' as const;

// P0-4: hostname/project MUST NOT be NULL. Postgres treats NULL ≠ NULL in
// unique constraints, so a NULL would defeat dedup and produce duplicate rows.
// Default to 'unknown' so the unique index always evaluates concrete values.
export const buckets = pgTable(
  'buckets',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    source: text('source').notNull(),
    model: text('model').notNull(),
    project: text('project').notNull().default('unknown'),
    hostname: text('hostname').notNull().default('unknown'),
    bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
    inputTokens: bigint('input_tokens', { mode: 'bigint' }).notNull().default(sql`0`),
    outputTokens: bigint('output_tokens', { mode: 'bigint' }).notNull().default(sql`0`),
    cachedInputTokens: bigint('cached_input_tokens', { mode: 'bigint' }).notNull().default(sql`0`),
    reasoningOutputTokens: bigint('reasoning_output_tokens', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    totalTokens: bigint('total_tokens', { mode: 'bigint' }).notNull().default(sql`0`),
    requestCount: bigint('request_count', { mode: 'bigint' }).notNull().default(sql`0`),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    priceVersion: text('price_version').notNull().default(COST_PRICE_VERSION),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniq: uniqueIndex('buckets_uniq_idx').on(
      table.source,
      table.model,
      table.project,
      table.bucketStart,
      table.hostname,
    ),
    timeIdx: index('buckets_time_idx').on(table.bucketStart),
    sourceIdx: index('buckets_source_idx').on(table.source),
    modelIdx: index('buckets_model_idx').on(table.model),
  }),
);

export type Bucket = typeof buckets.$inferSelect;
export type NewBucket = typeof buckets.$inferInsert;
