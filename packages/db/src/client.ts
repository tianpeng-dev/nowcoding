import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const DEFAULT_MAX_CONNECTIONS = 1;

let cached:
  | {
      url: string;
      db: ReturnType<typeof drizzle<typeof schema>>;
    }
  | undefined;

export function getDb(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (cached?.url === url) return cached.db;

  const sql = postgres(url, {
    max: parseMaxConnections(process.env.DATABASE_MAX_CONNECTIONS),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(sql, { schema });
  cached = { url, db };
  return db;
}

export type Database = ReturnType<typeof getDb>;
export { schema };

function parseMaxConnections(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_CONNECTIONS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) return DEFAULT_MAX_CONNECTIONS;
  return parsed;
}
