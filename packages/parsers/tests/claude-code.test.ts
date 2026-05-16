import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeCodeParser } from '../src/claude-code';
import { readParserFixture } from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nowcoding-cc-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('ClaudeCodeParser', () => {
  it('detect=false when ~/.claude/projects is missing', async () => {
    const p = new ClaudeCodeParser();
    expect(
      await p.detect({
        homeDir: tmp,
        hostname: 'h',
        fileCache: {},
        scannedFiles: [],
        allowProject: true,
      }),
    ).toBe(false);
  });

  it('parses a typical jsonl session', async () => {
    const projDir = path.join(tmp, '.claude', 'projects', '-Users-alice-app');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(
      path.join(projDir, 'sess-1.jsonl'),
      await readParserFixture('claude-code', 'typical.jsonl'),
    );

    const p = new ClaudeCodeParser();
    const r = await p.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records).toHaveLength(2);
    expect(r.records[0]?.sessionId).toBe('sess-1');
    expect(r.records[0]?.model).toBe('claude-opus-4-7');
    expect(r.records[1]?.cachedInputTokens).toBe(30);
  });

  it('replaces project with unknown when allowProject=false', async () => {
    const projDir = path.join(tmp, '.claude', 'projects', '-Users-alice-secret');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(
      path.join(projDir, 's.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-05-08T10:05:00Z',
        sessionId: 'a',
        message: { model: 'opus', role: 'user', usage: { input_tokens: 1, output_tokens: 0 } },
      })}\n`,
    );
    const p = new ClaudeCodeParser();
    const r = await p.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: false,
    });
    expect(r.records[0]?.project).toBe('unknown');
  });

  it('skips files with cached mtime+size match (P1-1 incremental)', async () => {
    const projDir = path.join(tmp, '.claude', 'projects', 'p');
    await fs.mkdir(projDir, { recursive: true });
    const file = path.join(projDir, 's.jsonl');
    await fs.writeFile(
      file,
      `${JSON.stringify({
        timestamp: '2026-05-08T10:05:00Z',
        sessionId: 'a',
        message: { model: 'opus', role: 'user', usage: { input_tokens: 1, output_tokens: 0 } },
      })}\n`,
    );
    const stat = await fs.stat(file);
    const p = new ClaudeCodeParser();
    const r = await p.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: { [file]: { mtime: stat.mtimeMs, size: stat.size } },
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records).toHaveLength(0);
  });

  it('records error on corrupt jsonl line but continues', async () => {
    const projDir = path.join(tmp, '.claude', 'projects', 'p');
    await fs.mkdir(projDir, { recursive: true });
    const file = path.join(projDir, 's.jsonl');
    await fs.writeFile(file, await readParserFixture('claude-code', 'corrupt.jsonl'));
    const p = new ClaudeCodeParser();
    const r = await p.parse({
      homeDir: tmp,
      hostname: 'h',
      fileCache: {},
      scannedFiles: [],
      allowProject: true,
    });
    expect(r.records).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});
