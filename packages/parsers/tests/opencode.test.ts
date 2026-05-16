import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OpenCodeParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

const require = createRequire(import.meta.url);

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-opencode-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('OpenCodeParser', () => {
  it('detects OpenCode data storage', async () => {
    const parser = new OpenCodeParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.local/share/opencode/storage/message/ses_a/msg-1.json',
      await readParserFixture('opencode', 'typical.json'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses OpenCode SQLite message rows', async () => {
    const parser = new OpenCodeParser();
    const dbPath = path.join(tmp, '.local/share/opencode/opencode.db');
    await writeFixture(tmp, '.local/share/opencode/.keep', '');
    createOpenCodeDb(dbPath, [
      {
        session_id: 'ses_sqlite',
        data: JSON.stringify({
          role: 'assistant',
          time: { created: '2026-05-14T09:00:00.000Z' },
          modelID: 'opencode-model',
          path: { root: '/Users/peng/work/repo-a' },
          tokens: { input: 9, output: 5, cache: { read: 2 }, reasoning: 1 },
        }),
      },
    ]);

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'opencode',
      model: 'opencode-model',
      project: 'repo-a',
      inputTokens: 9,
      outputTokens: 5,
      cachedInputTokens: 2,
      reasoningOutputTokens: 1,
      sessionId: 'ses_sqlite',
      isUser: false,
    });
  });

  it('parses legacy OpenCode JSON message files', async () => {
    const parser = new OpenCodeParser();
    await writeFixture(
      tmp,
      '.local/share/opencode/storage/message/ses_json/msg-1.json',
      await readParserFixture('opencode', 'typical.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'opencode-json-model',
      project: 'repo-json',
      inputTokens: 6,
      outputTokens: 7,
      cachedInputTokens: 3,
      reasoningOutputTokens: 2,
      sessionId: 'ses_json',
    });
  });

  it('records corrupt legacy OpenCode JSON files as parser errors', async () => {
    const parser = new OpenCodeParser();
    await writeFixture(
      tmp,
      '.local/share/opencode/storage/message/ses_corrupt/msg-1.json',
      await readParserFixture('opencode', 'corrupt.txt'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

function createOpenCodeDb(dbPath: string, rows: { session_id: string; data: string }[]): void {
  const sqlite = require('node:sqlite') as {
    DatabaseSync: new (
      path: string,
    ) => {
      exec(sql: string): void;
      prepare(sql: string): { run(...values: unknown[]): void };
      close(): void;
    };
  };
  const db = new sqlite.DatabaseSync(dbPath);
  try {
    db.exec('CREATE TABLE message (session_id TEXT NOT NULL, data TEXT NOT NULL)');
    const insert = db.prepare('INSERT INTO message (session_id, data) VALUES (?, ?)');
    for (const row of rows) insert.run(row.session_id, row.data);
  } finally {
    db.close();
  }
}
