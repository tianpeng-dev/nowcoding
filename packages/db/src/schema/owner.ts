import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const owner = pgTable('owner', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  githubHandle: text('github_handle'),
  avatarUrl: text('avatar_url'),
  websiteUrl: text('website_url'),
  location: text('location'),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Owner = typeof owner.$inferSelect;
export type NewOwner = typeof owner.$inferInsert;
