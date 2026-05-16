import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PiParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-pi-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('PiParser', () => {
  it('detects pi-coding-agent session storage', async () => {
    const parser = new PiParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.pi/agent/sessions/encoded-repo-a/20260514_session-a.jsonl',
      await readParserFixture('pi', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses assistant message usage from pi-coding-agent sessions', async () => {
    const parser = new PiParser();
    await writeFixture(
      tmp,
      '.pi/agent/sessions/encoded-repo-a/20260514_session-a.jsonl',
      await readParserFixture('pi', 'typical.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'pi',
      model: 'pi-coder-large',
      project: 'repo-a',
      inputTokens: 14,
      outputTokens: 9,
      cachedInputTokens: 4,
      reasoningOutputTokens: 0,
      sessionId: 'session-a',
      isUser: false,
    });
  });

  it('dedupes repeated message entry ids and falls back to encoded directory project', async () => {
    const parser = new PiParser();
    await writeFixture(
      tmp,
      '.pi/agent/sessions/Users-peng-src-repo-b/20260514_session-b.jsonl',
      await readParserFixture('pi', 'edge.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'pi-coder-small',
      project: 'b',
      inputTokens: 6,
      outputTokens: 7,
      cachedInputTokens: 2,
      sessionId: '20260514_session-b',
    });
  });

  it('records corrupt pi-coding-agent JSONL lines and continues parsing', async () => {
    const parser = new PiParser();
    await writeFixture(
      tmp,
      '.pi/agent/sessions/encoded-repo-c/20260514_session-c.jsonl',
      await readParserFixture('pi', 'corrupt.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.project).toBe('unknown');
  });
});
