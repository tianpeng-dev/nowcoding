import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };

type CachedDatabase = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: ReturnType<typeof postgres>;
};

const databaseClients = new Map<string, CachedDatabase>();

export function getDatabaseMaxConnections(value = process.env.DATABASE_MAX_CONNECTIONS): number {
  if (!/^\d+$/.test(value ?? '')) {
    return 1;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export function getDb(
  databaseUrl = process.env.DATABASE_URL,
  maxConnections = process.env.DATABASE_MAX_CONNECTIONS,
) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a cloud database client');
  }

  const max = getDatabaseMaxConnections(maxConnections);
  const cacheKey = `${databaseUrl}:${max}`;
  const cached = databaseClients.get(cacheKey);

  if (cached) {
    return cached.db;
  }

  const sql = postgres(databaseUrl, {
    max,
    prepare: false,
  });
  const db = drizzle(sql, { schema });

  databaseClients.set(cacheKey, { db, sql });

  return db;
}

export type Database = ReturnType<typeof getDb>;
