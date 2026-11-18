import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

function withContractName<TTable>(table: TTable, name: string): TTable {
  Object.defineProperty(table, '_', {
    value: { name },
  });

  return table;
}

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
};

export const users = withContractName(
  pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').unique(),
    githubId: text('github_id').unique(),
    githubLogin: text('github_login').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    timezone: text('timezone').default('UTC'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    ...timestamps,
  }),
  'users',
);

export const devices = withContractName(
  pgTable(
    'devices',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id').references(() => users.id),
      name: text('name'),
      tokenHash: text('token_hash').unique(),
      lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
      revokedAt: timestamp('revoked_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
      confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
      hostname: text('hostname'),
      platform: text('platform'),
      cliVersion: text('cli_version'),
      clientInfo: jsonb('client_info').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
      lastIpHash: text('last_ip_hash'),
      revokedReason: text('revoked_reason'),
    },
    (table) => ({
      userIdx: index('devices_user_id_idx').on(table.userId),
    }),
  ),
  'devices',
);

export const cliAuthFlows = withContractName(
  pgTable(
    'cli_auth_flows',
    {
      pollTokenHash: text('poll_token_hash').primaryKey(),
      deviceName: text('device_name'),
      joinArena: boolean('join_arena').default(true),
      userCodeHash: text('user_code_hash').unique(),
      userId: uuid('user_id').references(() => users.id),
      deviceId: uuid('device_id').references(() => devices.id),
      deviceToken: text('device_token'),
      expiresAt: timestamp('expires_at', { withTimezone: true }),
      completedAt: timestamp('completed_at', { withTimezone: true }),
      claimedAt: timestamp('claimed_at', { withTimezone: true }),
      statusNonceHash: text('status_nonce_hash'),
      statusExpiresAt: timestamp('status_expires_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => ({
      userIdx: index('cli_auth_flows_user_id_idx').on(table.userId),
      deviceIdx: index('cli_auth_flows_device_id_idx').on(table.deviceId),
    }),
  ),
  'cli_auth_flows',
);

export const accountSecurityEvents = withContractName(
  pgTable(
    'account_security_events',
    {
      id: bigserial('id', { mode: 'bigint' }).primaryKey(),
      userId: uuid('user_id').references(() => users.id),
      deviceId: uuid('device_id').references(() => devices.id),
      eventType: text('event_type').notNull(),
      metadata: jsonb('metadata')
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      ipHash: text('ip_hash'),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => ({
      userIdx: index('account_security_events_user_id_idx').on(table.userId),
      deviceIdx: index('account_security_events_device_id_idx').on(table.deviceId),
    }),
  ),
  'account_security_events',
);

export const usageBuckets = withContractName(
  pgTable(
    'usage_buckets',
    {
      id: bigserial('id', { mode: 'bigint' }).primaryKey(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
      deviceId: uuid('device_id')
        .notNull()
        .references(() => devices.id),
      source: text('source').notNull(),
      model: text('model').notNull(),
      project: text('project').notNull().default('unknown'),
      hostname: text('hostname').notNull().default('unknown'),
      bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
      promptTokens: bigint('prompt_tokens', { mode: 'bigint' }).default(sql`0`),
      completionTokens: bigint('completion_tokens', { mode: 'bigint' }).default(sql`0`),
      totalTokens: bigint('total_tokens', { mode: 'bigint' }).default(sql`0`),
      requestCount: bigint('request_count', { mode: 'bigint' }).default(sql`0`),
      costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).default('0'),
      excludedFromArenaAt: timestamp('excluded_from_arena_at', {
        withTimezone: true,
      }),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => ({
      uniq: uniqueIndex('usage_buckets_unique_idx').on(
        table.userId,
        table.deviceId,
        table.source,
        table.model,
        table.project,
        table.bucketStart,
        table.hostname,
      ),
      userTimeIdx: index('usage_buckets_user_bucket_start_idx').on(table.userId, table.bucketStart),
      deviceIdx: index('usage_buckets_device_id_idx').on(table.deviceId),
    }),
  ),
  'usage_buckets',
);

export const usageSessions = withContractName(
  pgTable(
    'usage_sessions',
    {
      id: bigserial('id', { mode: 'bigint' }).primaryKey(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
      deviceId: uuid('device_id')
        .notNull()
        .references(() => devices.id),
      source: text('source').notNull(),
      project: text('project').notNull().default('unknown'),
      sessionHash: text('session_hash').notNull(),
      firstMessageAt: timestamp('first_message_at', {
        withTimezone: true,
      }).notNull(),
      lastMessageAt: timestamp('last_message_at', {
        withTimezone: true,
      }).notNull(),
      durationSeconds: bigint('duration_seconds', { mode: 'bigint' }).notNull(),
      activeSeconds: bigint('active_seconds', { mode: 'bigint' }).notNull(),
      messageCount: bigint('message_count', { mode: 'bigint' }).notNull(),
      userMessageCount: bigint('user_message_count', {
        mode: 'bigint',
      }).notNull(),
      userPromptHours: jsonb('user_prompt_hours')
        .$type<number[]>()
        .notNull()
        .default(sql`'[]'::jsonb`),
      hostname: text('hostname').notNull().default('unknown'),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => ({
      uniq: uniqueIndex('usage_sessions_unique_idx').on(
        table.userId,
        table.deviceId,
        table.sessionHash,
        table.source,
        table.hostname,
      ),
      userTimeIdx: index('usage_sessions_user_last_message_at_idx').on(
        table.userId,
        table.lastMessageAt,
      ),
      deviceIdx: index('usage_sessions_device_id_idx').on(table.deviceId),
    }),
  ),
  'usage_sessions',
);

export const arenaConsents = withContractName(
  pgTable('arena_consents', {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    joined: boolean('joined').default(false),
    publicFields: jsonb('public_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }),
  'arena_consents',
);

export const leaderboardEntries = withContractName(
  pgTable(
    'leaderboard_entries',
    {
      id: bigserial('id', { mode: 'bigint' }).primaryKey(),
      range: text('range').notNull(),
      scope: text('scope').notNull(),
      metric: text('metric').notNull(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
      score: numeric('score', { precision: 20, scale: 6 }),
      publicValue: text('public_value'),
      rank: integer('rank'),
      excludedAt: timestamp('excluded_at', { withTimezone: true }),
      generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    },
    (table) => ({
      uniq: uniqueIndex('leaderboard_entries_unique_idx').on(
        table.range,
        table.scope,
        table.metric,
        table.userId,
        table.generatedAt,
      ),
      userIdx: index('leaderboard_entries_user_id_idx').on(table.userId),
    }),
  ),
  'leaderboard_entries',
);
