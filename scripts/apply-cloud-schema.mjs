import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const DEFAULT_MIGRATION_DIR = new URL('../packages/cloud-db/drizzle/', import.meta.url);
const cloudDbRequire = createRequire(new URL('../packages/cloud-db/package.json', import.meta.url));

export async function listSqlMigrationFiles(migrationDir = DEFAULT_MIGRATION_DIR) {
  const files = await readdir(migrationDir);

  return files
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right));
}

export function buildMigrationHistoryTableSql() {
  return `
create table if not exists public.nowcoding_schema_migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamp with time zone not null default now()
);
`;
}

export function buildMigrationHistoryInsertSql() {
  return `
insert into public.nowcoding_schema_migrations (filename, checksum)
values ($1, $2)
on conflict (filename) do update
set checksum = public.nowcoding_schema_migrations.checksum
where public.nowcoding_schema_migrations.checksum = excluded.checksum
returning filename;
`;
}

export function normalizeDatabaseUrlForLogs(databaseUrl) {
  try {
    const url = new URL(databaseUrl);

    if (url.password) {
      url.password = '***';
    }

    return url.toString();
  } catch {
    return '[invalid database_url]';
  }
}

function md5(content) {
  return createHash('md5').update(content).digest('hex');
}

async function loadPostgres() {
  const postgresModule = await import(cloudDbRequire.resolve('postgres'));

  return postgresModule.default;
}

async function createPostgresClient(databaseUrl, options) {
  const postgres = await loadPostgres();

  return postgres(databaseUrl, options);
}

function migrationChecksum(content) {
  return md5(content);
}

async function appliedMigrations(sql) {
  const rows = await sql`
    select filename, checksum
    from public.nowcoding_schema_migrations
    order by filename
  `;

  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

export async function applyCloudSchema({
  databaseUrl = process.env.DATABASE_URL,
  migrationDir = DEFAULT_MIGRATION_DIR,
  logger = console,
  postgresFactory = createPostgresClient,
} = {}) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = await postgresFactory(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    logger.log(`Connecting to ${normalizeDatabaseUrlForLogs(databaseUrl)}`);
    await sql.unsafe(buildMigrationHistoryTableSql());

    const applied = await appliedMigrations(sql);
    const files = await listSqlMigrationFiles(migrationDir);

    for (const file of files) {
      const migrationUrl = new URL(file, migrationDir);
      const content = await readFile(migrationUrl, 'utf8');
      const checksum = migrationChecksum(content);
      const appliedChecksum = applied.get(file);

      if (appliedChecksum === checksum) {
        logger.log(`Skipping ${file}`);
        continue;
      }

      if (appliedChecksum) {
        throw new Error(`Migration checksum mismatch for ${file}`);
      }

      logger.log(`Applying ${file}`);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(content);
        const rows = await transaction.unsafe(buildMigrationHistoryInsertSql(), [file, checksum]);

        if (rows.length !== 1) {
          throw new Error(`Migration history conflict for ${file}`);
        }
      });
      logger.log(`Applied ${file}`);
    }

    logger.log('Cloud schema is up to date');
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  applyCloudSchema().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to apply Cloud schema: ${message}`);
    process.exitCode = 1;
  });
}
