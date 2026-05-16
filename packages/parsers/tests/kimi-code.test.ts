import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KimiCodeParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-kimi-code-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('KimiCodeParser', () => {
  it('detects Kimi session wire storage', async () => {
    const parser = new KimiCodeParser();
    const projectHash = md5('/Users/peng/work/repo-kimi');

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      `.kimi/sessions/${projectHash}/session-a/wire.jsonl`,
      await readParserFixture('kimi-code', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses StatusUpdate token usage from Kimi 1.9 wire envelopes', async () => {
    const parser = new KimiCodeParser();
    const workdir = '/Users/peng/work/repo-kimi';
    const projectHash = md5(workdir);
    await writeFixture(tmp, '.kimi/config.toml', 'default_model = "kimi-k2"\n');
    await writeFixture(tmp, '.kimi/kimi.json', JSON.stringify({ work_dirs: [{ path: workdir }] }));
    await writeFixture(
      tmp,
      `.kimi/sessions/${projectHash}/session-a/wire.jsonl`,
      await readParserFixture('kimi-code', 'typical.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'kimi-code',
      model: 'kimi-k2',
      project: 'repo-kimi',
      inputTokens: 12,
      outputTokens: 8,
      cachedInputTokens: 3,
      reasoningOutputTokens: 0,
      sessionId: `${projectHash}/session-a/wire.jsonl`,
    });
  });

  it('parses legacy payloads, model overrides, and dedupes message ids', async () => {
    const parser = new KimiCodeParser();
    await writeFixture(tmp, '.kimi/config.toml', '[models."kimi-code/kimi-for-coding"]\n');
    await writeFixture(
      tmp,
      '.kimi/kimi.json',
      JSON.stringify({ projects: { legacyhash: { path: '/Users/peng/src/legacy-kimi' } } }),
    );
    await writeFixture(
      tmp,
      '.kimi/sessions/legacyhash/session-b/wire.jsonl',
      await readParserFixture('kimi-code', 'edge.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'kimi-edge',
      project: 'legacy-kimi',
      inputTokens: 5,
      outputTokens: 6,
      cachedInputTokens: 1,
      sessionId: 'legacyhash/session-b/wire.jsonl',
    });
  });

  it('records corrupt Kimi JSONL lines and continues parsing', async () => {
    const parser = new KimiCodeParser();
    await writeFixture(
      tmp,
      '.kimi/sessions/hash-c/session-c/wire.jsonl',
      await readParserFixture('kimi-code', 'corrupt.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.project).toBe('unknown');
  });
});

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}
