import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HermesParser } from '../src/index';
import { makeTempHome, parserContext, removeTempHome, writeFixture } from './helpers';

const require = createRequire(import.meta.url);

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-hermes-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('HermesParser', () => {
  it('detects default Hermes state database', async () => {
    const parser = new HermesParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(tmp, '.hermes/.keep', '');
    createHermesDb(path.join(tmp, '.hermes/state.db'), []);

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses usage from the default Hermes sessions table', async () => {
    const parser = new HermesParser();
    await writeFixture(tmp, '.hermes/.keep', '');
    createHermesDb(path.join(tmp, '.hermes/state.db'), [
      {
        id: 'session-a',
        model: 'hermes-model',
        started_at: 1778749200,
        input_tokens: 10,
        output_tokens: 6,
        cache_read_tokens: 3,
        reasoning_tokens: 2,
      },
    ]);

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'hermes',
      model: 'hermes-model',
      project: 'default',
      inputTokens: 10,
      outputTokens: 6,
      cachedInputTokens: 3,
      reasoningOutputTokens: 2,
      sessionId: 'session-a',
    });
  });

  it('parses named Hermes profile databases', async () => {
    const parser = new HermesParser();
    await writeFixture(tmp, '.hermes/profiles/work/.keep', '');
    createHermesDb(path.join(tmp, '.hermes/profiles/work/state.db'), [
      {
        id: 'session-b',
        model: 'profile-model',
        started_at: 1778749800,
        input_tokens: 5,
        output_tokens: 7,
        cache_read_tokens: 1,
        reasoning_tokens: 0,
      },
    ]);

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'profile-model',
      project: 'work',
      inputTokens: 5,
      outputTokens: 7,
      cachedInputTokens: 1,
      sessionId: 'session-b',
    });
  });

  it('skips empty Hermes sessions', async () => {
    const parser = new HermesParser();
    await writeFixture(tmp, '.hermes/.keep', '');
    createHermesDb(path.join(tmp, '.hermes/state.db'), [
      {
        id: 'session-empty',
        model: 'empty',
        started_at: 1778750400,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        reasoning_tokens: 0,
      },
    ]);

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(0);
  });
});

interface HermesRow {
  id: string;
  model: string;
  started_at: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
}

function createHermesDb(dbPath: string, rows: HermesRow[]): void {
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
    db.exec(`CREATE TABLE sessions (
      id TEXT NOT NULL,
      model TEXT,
      started_at REAL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      reasoning_tokens INTEGER
    )`);
    const insert = db.prepare(`INSERT INTO sessions (
      id, model, started_at, input_tokens, output_tokens, cache_read_tokens, reasoning_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const row of rows) {
      insert.run(
        row.id,
        row.model,
        row.started_at,
        row.input_tokens,
        row.output_tokens,
        row.cache_read_tokens,
        row.reasoning_tokens,
      );
    }
  } finally {
    db.close();
  }
}
