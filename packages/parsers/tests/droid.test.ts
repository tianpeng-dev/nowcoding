import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DroidParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-droid-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('DroidParser', () => {
  it('detects Droid Factory session storage', async () => {
    const parser = new DroidParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-a/session-a.jsonl',
      await readParserFixture('droid', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses token usage from Droid session settings', async () => {
    const parser = new DroidParser();
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-a/session-a.jsonl',
      await readParserFixture('droid', 'typical.jsonl'),
    );
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-a/session-a.settings.json',
      JSON.stringify({
        model: 'claude-sonnet-4',
        tokenUsage: {
          inputTokens: 20,
          outputTokens: 13,
          cacheReadTokens: 5,
          thinkingTokens: 3,
        },
      }),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'droid',
      model: 'claude-sonnet-4',
      project: 'a',
      inputTokens: 15,
      outputTokens: 10,
      cachedInputTokens: 5,
      reasoningOutputTokens: 3,
      sessionId: 'session-a',
    });
  });

  it('skips settings without usage and settings sidecar files', async () => {
    const parser = new DroidParser();
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-b/session-b.jsonl',
      await readParserFixture('droid', 'edge.jsonl'),
    );
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-b/session-b.settings.json',
      JSON.stringify({ model: 'empty', tokenUsage: {} }),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(0);
  });

  it('records corrupt Droid JSONL lines and continues parsing settings', async () => {
    const parser = new DroidParser();
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-c/session-c.jsonl',
      await readParserFixture('droid', 'corrupt.jsonl'),
    );
    await writeFixture(
      tmp,
      '.factory/sessions/encoded-repo-c/session-c.settings.json',
      JSON.stringify({ model: 'droid-model', tokenUsage: { inputTokens: 3, outputTokens: 4 } }),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.project).toBe('unknown');
  });
});
