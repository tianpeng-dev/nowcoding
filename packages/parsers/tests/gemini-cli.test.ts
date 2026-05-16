import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GeminiCliParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-gemini-cli-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('GeminiCliParser', () => {
  it('detects Gemini CLI tmp chat storage', async () => {
    const parser = new GeminiCliParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.gemini/tmp/session-2026-05-14/chats/session-1.json',
      await readParserFixture('gemini-cli', 'typical.json'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses tokens from Gemini CLI messages arrays', async () => {
    const parser = new GeminiCliParser();
    await writeFixture(
      tmp,
      '.gemini/tmp/session-2026-05-14/chats/session-1.json',
      await readParserFixture('gemini-cli', 'typical.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      source: 'gemini-cli',
      model: 'gemini-2.5-pro',
      project: 'unknown',
      inputTokens: 15,
      outputTokens: 0,
      cachedInputTokens: 5,
      sessionId: 'session-2026-05-14/chats/session-1.json',
      isUser: true,
    });
    expect(result.records[1]).toMatchObject({
      source: 'gemini-cli',
      model: 'gemini-2.5-pro',
      project: 'unknown',
      inputTokens: 24,
      outputTokens: 10,
      cachedInputTokens: 6,
      reasoningOutputTokens: 2,
      sessionId: 'session-2026-05-14/chats/session-1.json',
      isUser: false,
    });
  });

  it('parses usage metadata from Gemini CLI history arrays', async () => {
    const parser = new GeminiCliParser();
    await writeFixture(
      tmp,
      '.gemini/tmp/session-2026-05-14/chats/session-2.json',
      await readParserFixture('gemini-cli', 'edge.json'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      model: 'gemini-2.5-flash',
      inputTokens: 13,
      outputTokens: 6,
      cachedInputTokens: 4,
      reasoningOutputTokens: 3,
      isUser: false,
    });
    expect(result.records[1]).toMatchObject({
      model: 'gemini-2.5-flash-lite',
      inputTokens: 4,
      outputTokens: 8,
      cachedInputTokens: 1,
      reasoningOutputTokens: 0,
      isUser: true,
    });
  });

  it('records corrupt Gemini CLI JSON as parser errors', async () => {
    const parser = new GeminiCliParser();
    await writeFixture(
      tmp,
      '.gemini/tmp/session-2026-05-14/chats/session-corrupt.json',
      await readParserFixture('gemini-cli', 'corrupt.txt'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
