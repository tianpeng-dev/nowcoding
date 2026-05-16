import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommonJsonlParser } from '../src/_base/common-jsonl-parser';
import type { JsonlParserConfig } from '../src/_base/jsonl-parser';
import { CodexParser, allParsers } from '../src/index';

class TestParser extends CommonJsonlParser {
  readonly source = 'test-tool';
  readonly config: JsonlParserConfig = { rootSubpath: '.test-tool' };
}

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nowcoding-cj-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('CommonJsonlParser', () => {
  it('parses OpenAI-style usage records', async () => {
    const dir = path.join(tmp, '.test-tool', 'proj-a');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'session.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-05-08T10:00:00Z',
        model: 'gpt-5',
        sessionId: 'abc',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      })}\n`,
    );
    const parser = new TestParser();
    const r = await parser.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records).toHaveLength(1);
    expect(r.records[0]?.inputTokens).toBe(100);
    expect(r.records[0]?.outputTokens).toBe(50);
    expect(r.records[0]?.model).toBe('gpt-5');
    expect(r.records[0]?.project).toBe('proj-a');
  });

  it('parses Anthropic-style nested message.usage', async () => {
    const dir = path.join(tmp, '.test-tool', 'proj-b');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'session.jsonl'),
      `${JSON.stringify({
        created_at: '2026-05-08T10:00:00Z',
        message: {
          model: 'claude',
          role: 'assistant',
          usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 },
        },
        sessionId: 'def',
      })}\n`,
    );
    const parser = new TestParser();
    const r = await parser.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records[0]?.cachedInputTokens).toBe(5);
    expect(r.records[0]?.model).toBe('claude');
  });

  it('skips records with no usage', async () => {
    const dir = path.join(tmp, '.test-tool');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 's.jsonl'),
      `${JSON.stringify({ timestamp: '2026-05-08T10:00:00Z', model: 'x' })}\n`,
    );
    const parser = new TestParser();
    const r = await parser.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records).toHaveLength(0);
  });

  it('detect=false when root subpath is missing', async () => {
    const parser = new CodexParser();
    expect(
      await parser.detect({
        homeDir: tmp,
        hostname: 'h',
        fileCache: {},
        scannedFiles: [],
        allowProject: true,
      }),
    ).toBe(false);
  });
});

describe('allParsers registry', () => {
  it('exposes 18 parsers', () => {
    expect(allParsers()).toHaveLength(18);
  });

  it('all sources are unique', () => {
    const sources = allParsers().map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});
