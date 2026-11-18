import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyCloudSchema,
  buildMigrationHistoryInsertSql,
  buildMigrationHistoryTableSql,
  listSqlMigrationFiles,
  normalizeDatabaseUrlForLogs,
} from './apply-cloud-schema.mjs';

function md5(content: string) {
  return createHash('md5').update(content).digest('hex');
}

async function withMigrationDir(
  files: Record<string, string>,
  test: (migrationDir: URL) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'apply-cloud-schema-'));

  try {
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(join(directory, filename), content);
    }

    await test(pathToFileURL(`${directory}/`));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createFakePostgres({
  historyRows = [],
  insertRows = [{ filename: '0000_test.sql' }],
}: {
  historyRows?: Array<{ filename: string; checksum: string }>;
  insertRows?: Array<{ filename: string }>;
} = {}) {
  const calls: Array<{
    type: string;
    text?: string;
    params?: unknown[];
    databaseUrl?: string;
    options?: unknown;
  }> = [];

  const sql = Object.assign(
    async (strings: TemplateStringsArray) => {
      calls.push({ type: 'query', text: strings.join('?') });

      return historyRows;
    },
    {
      unsafe: async (text: string, params?: unknown[]) => {
        calls.push({ type: 'unsafe', text, params });

        return [];
      },
      begin: async (
        callback: (transaction: {
          unsafe: (text: string, params?: unknown[]) => Promise<unknown[]>;
        }) => unknown,
      ) => {
        calls.push({ type: 'begin' });

        const transaction = {
          unsafe: async (text: string, params?: unknown[]) => {
            calls.push({ type: 'txUnsafe', text, params });

            if (text.includes('nowcoding_schema_migrations')) {
              return insertRows;
            }

            return [];
          },
        };

        return callback(transaction);
      },
      end: async () => {
        calls.push({ type: 'end' });
      },
    },
  );

  return {
    calls,
    postgresFactory: (databaseUrl: string, options: unknown) => {
      calls.push({ type: 'connect', databaseUrl, options });

      return sql;
    },
  };
}

describe('apply-cloud-schema helpers', () => {
  it('lists checked-in SQL migrations in filename order', async () => {
    await expect(
      listSqlMigrationFiles(new URL('../packages/cloud-db/drizzle/', import.meta.url)),
    ).resolves.toEqual([
      '0000_initial_schema.sql',
      '0001_cli_device_token.sql',
      '0002_usage_sessions.sql',
      '0003_supabase_rls.sql',
      '0004_schema_migrations_rls.sql',
      '0005_fk_indexes.sql',
      '0006_device_management.sql',
    ]);
  });

  it('creates a stable migration history table statement', () => {
    expect(buildMigrationHistoryTableSql()).toContain(
      'create table if not exists public.nowcoding_schema_migrations',
    );
    expect(buildMigrationHistoryTableSql()).toContain('filename text primary key');
  });

  it('builds parameterized migration history inserts', () => {
    expect(buildMigrationHistoryInsertSql()).toContain(
      'insert into public.nowcoding_schema_migrations',
    );
    expect(buildMigrationHistoryInsertSql()).toContain('on conflict (filename) do update');
    expect(buildMigrationHistoryInsertSql()).toContain('returning filename');
  });

  it('skips an already-applied migration only when the checksum matches', async () => {
    const content = 'select 1;\n';
    const fake = createFakePostgres({
      historyRows: [{ filename: '0000_test.sql', checksum: md5(content) }],
    });

    await withMigrationDir({ '0000_test.sql': content }, async (migrationDir) => {
      await applyCloudSchema({
        databaseUrl: 'postgres://user:secret@localhost:6543/postgres',
        migrationDir,
        logger: { log: () => {} },
        postgresFactory: fake.postgresFactory,
      });
    });

    expect(fake.calls).not.toContainEqual(expect.objectContaining({ type: 'begin' }));
    expect(fake.calls).toContainEqual(
      expect.objectContaining({
        type: 'connect',
        options: { max: 1, prepare: false },
      }),
    );
    expect(fake.calls.at(-1)).toEqual({ type: 'end' });
  });

  it('fails an already-applied migration when the checksum changed', async () => {
    const fake = createFakePostgres({
      historyRows: [{ filename: '0000_test.sql', checksum: md5('select old_value;\n') }],
    });

    await expect(
      withMigrationDir({ '0000_test.sql': 'select new_value;\n' }, async (migrationDir) => {
        await applyCloudSchema({
          databaseUrl: 'postgres://user:secret@localhost:6543/postgres',
          migrationDir,
          logger: { log: () => {} },
          postgresFactory: fake.postgresFactory,
        });
      }),
    ).rejects.toThrow('Migration checksum mismatch for 0000_test.sql');
    expect(fake.calls).not.toContainEqual(expect.objectContaining({ type: 'begin' }));
    expect(fake.calls.at(-1)).toEqual({ type: 'end' });
  });

  it('fails when the migration history insert returns no rows', async () => {
    const fake = createFakePostgres({ insertRows: [] });

    await expect(
      withMigrationDir({ '0000_test.sql': 'select 1;\n' }, async (migrationDir) => {
        await applyCloudSchema({
          databaseUrl: 'postgres://user:secret@localhost:6543/postgres',
          migrationDir,
          logger: { log: () => {} },
          postgresFactory: fake.postgresFactory,
        });
      }),
    ).rejects.toThrow('Migration history conflict for 0000_test.sql');
    expect(fake.calls).toContainEqual(expect.objectContaining({ type: 'begin' }));
    expect(fake.calls.at(-1)).toEqual({ type: 'end' });
  });

  it('records new migrations with the current checksum', async () => {
    const content = 'select 1;\n';
    const fake = createFakePostgres();

    await withMigrationDir({ '0000_test.sql': content }, async (migrationDir) => {
      await applyCloudSchema({
        databaseUrl: 'postgres://user:secret@localhost:6543/postgres',
        migrationDir,
        logger: { log: () => {} },
        postgresFactory: fake.postgresFactory,
      });
    });

    expect(fake.calls).toContainEqual(
      expect.objectContaining({
        type: 'txUnsafe',
        params: ['0000_test.sql', md5(content)],
      }),
    );
  });

  it('redacts passwords in database URLs before logging', () => {
    expect(
      normalizeDatabaseUrlForLogs(
        'postgres://user:secret-password@db.example.supabase.co:6543/postgres',
      ),
    ).toBe('postgres://user:***@db.example.supabase.co:6543/postgres');
  });
});
