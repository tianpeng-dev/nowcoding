import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OpenClawParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-openclaw-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('OpenClawParser', () => {
  it('detects OpenClaw agent session storage', async () => {
    const parser = new OpenClawParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.openclaw/agents/repo-a/sessions/session-a.jsonl',
      await readParserFixture('openclaw', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses assistant message usage from OpenClaw sessions', async () => {
    const parser = new OpenClawParser();
    await writeFixture(
      tmp,
      '.openclaw/agents/repo-a/sessions/session-a.jsonl',
      await readParserFixture('openclaw', 'typical.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'openclaw',
      model: 'claw-model',
      project: 'repo-a',
      inputTokens: 10,
      outputTokens: 6,
      cachedInputTokens: 2,
      reasoningOutputTokens: 0,
      sessionId: 'repo-a/sessions/session-a.jsonl',
      isUser: false,
    });
  });

  it('scans profile roots and usage field aliases', async () => {
    const parser = new OpenClawParser();
    await writeFixture(
      tmp,
      '.openclaw-work/agents/repo-b/sessions/session-b.jsonl',
      await readParserFixture('openclaw', 'edge.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'profile-model',
      project: 'repo-b',
      inputTokens: 7,
      outputTokens: 3,
      cachedInputTokens: 1,
    });
  });

  it('records corrupt OpenClaw JSONL lines and continues parsing', async () => {
    const parser = new OpenClawParser();
    await writeFixture(
      tmp,
      '.clawdbot/agents/repo-c/sessions/session-c.jsonl',
      await readParserFixture('openclaw', 'corrupt.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.project).toBe('unknown');
  });
});
