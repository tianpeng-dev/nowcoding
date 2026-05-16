import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QwenCodeParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-qwen-code-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('QwenCodeParser', () => {
  it('detects Qwen tmp chat storage', async () => {
    const parser = new QwenCodeParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.qwen/tmp/project-a/chats/session-a.jsonl',
      await readParserFixture('qwen-code', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses assistant usage metadata from Qwen chat JSONL', async () => {
    const parser = new QwenCodeParser();
    await writeFixture(
      tmp,
      '.qwen/tmp/project-a/chats/session-a.jsonl',
      await readParserFixture('qwen-code', 'typical.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'qwen-code',
      model: 'qwen3-coder-plus',
      project: 'repo-a',
      inputTokens: 16,
      outputTokens: 8,
      cachedInputTokens: 4,
      reasoningOutputTokens: 2,
      sessionId: 'project-a/chats/session-a.jsonl',
      isUser: false,
    });
  });

  it('derives fallback project from tmp directory and dedupes repeated uuids', async () => {
    const parser = new QwenCodeParser();
    await writeFixture(
      tmp,
      '.qwen/tmp/project-b/chats/session-b.jsonl',
      await readParserFixture('qwen-code', 'edge.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'qwen3-coder',
      project: 'project-b',
      inputTokens: 7,
      outputTokens: 3,
      cachedInputTokens: 1,
      sessionId: 'project-b/chats/session-b.jsonl',
    });
  });

  it('records corrupt Qwen JSONL lines and continues parsing', async () => {
    const parser = new QwenCodeParser();
    await writeFixture(
      tmp,
      '.qwen/tmp/project-c/chats/session-c.jsonl',
      await readParserFixture('qwen-code', 'corrupt.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.project).toBe('unknown');
  });
});
