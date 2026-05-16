import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KiroParser } from '../src/index';
import { makeTempHome, parserContext, removeTempHome, writeFixture } from './helpers';

const require = createRequire(import.meta.url);

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-kiro-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('KiroParser', () => {
  it('detects Kiro devdata SQLite database', async () => {
    const parser = new KiroParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(tmp, `${kiroBaseSubpath()}/dev_data/.keep`, '');
    createKiroDb(path.join(tmp, kiroBaseSubpath(), 'dev_data/devdata.sqlite'), []);

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses SQLite token rows and resolves model names from chat timeline', async () => {
    const parser = new KiroParser();
    const base = kiroBaseSubpath();
    await writeFixture(
      tmp,
      `${base}/workspace-a/session.chat`,
      JSON.stringify({
        metadata: {
          modelId: 'CLAUDE_SONNET_4_20250514_V1_0',
          startTime: Date.parse('2026-05-14T11:58:00.000Z'),
          endTime: Date.parse('2026-05-14T12:02:00.000Z'),
        },
      }),
    );
    await writeFixture(tmp, `${base}/dev_data/.keep`, '');
    createKiroDb(path.join(tmp, base, 'dev_data/devdata.sqlite'), [
      {
        id: 1,
        model: 'agent',
        tokens_prompt: 11,
        tokens_generated: 7,
        timestamp: '2026-05-14 12:00:00',
      },
    ]);

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'kiro',
      model: 'claude-sonnet-4',
      project: 'unknown',
      inputTokens: 11,
      outputTokens: 7,
      sessionId: '1',
    });
  });

  it('falls back to tokens_generated.jsonl when SQLite is absent', async () => {
    const parser = new KiroParser();
    const base = kiroBaseSubpath();
    await writeFixture(
      tmp,
      `${base}/dev_data/tokens_generated.jsonl`,
      '{"model":"agent","provider":"kiro","promptTokens":5,"generatedTokens":3}\n',
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'kiro-agent',
      inputTokens: 5,
      outputTokens: 3,
    });
  });

  it('reports corrupt JSONL fallback lines as parser errors', async () => {
    const parser = new KiroParser();
    const base = kiroBaseSubpath();
    await writeFixture(tmp, `${base}/dev_data/tokens_generated.jsonl`, '{not json}\n');

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

interface KiroRow {
  id: number;
  model: string;
  tokens_prompt: number;
  tokens_generated: number;
  timestamp: string;
}

function createKiroDb(dbPath: string, rows: KiroRow[]): void {
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
    db.exec(`CREATE TABLE tokens_generated (
      id INTEGER PRIMARY KEY,
      model TEXT,
      tokens_prompt INTEGER,
      tokens_generated INTEGER,
      timestamp TEXT
    )`);
    const insert = db.prepare(`INSERT INTO tokens_generated (
      id, model, tokens_prompt, tokens_generated, timestamp
    ) VALUES (?, ?, ?, ?, ?)`);
    for (const row of rows) {
      insert.run(row.id, row.model, row.tokens_prompt, row.tokens_generated, row.timestamp);
    }
  } finally {
    db.close();
  }
}

function kiroBaseSubpath(): string {
  if (process.platform === 'darwin') {
    return path.join(
      'Library',
      'Application Support',
      'Kiro',
      'User',
      'globalStorage',
      'kiro.kiroagent',
    );
  }
  if (process.platform === 'win32') {
    return path.join('AppData', 'Roaming', 'Kiro', 'User', 'globalStorage', 'kiro.kiroagent');
  }
  return path.join('.config', 'Kiro', 'User', 'globalStorage', 'kiro.kiroagent');
}
