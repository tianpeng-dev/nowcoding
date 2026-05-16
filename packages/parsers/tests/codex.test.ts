import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodexParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-codex-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('CodexParser', () => {
  it('parses Codex Desktop token_count events from last_token_usage', async () => {
    await writeFixture(
      tmp,
      '.codex/sessions/2026/05/14/rollout.jsonl',
      await readParserFixture('codex', 'typical.jsonl'),
    );

    const parser = new CodexParser();
    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'codex',
      model: 'gpt-5.5',
      project: 'unknown',
      inputTokens: 33,
      outputTokens: 3,
      cachedInputTokens: 12,
      reasoningOutputTokens: 3,
      sessionId: 'session-1',
    });
  });

  it('derives the project from Codex cwd when project upload is allowed', async () => {
    await writeFixture(
      tmp,
      '.codex/sessions/2026/05/14/rollout.jsonl',
      await readParserFixture('codex', 'edge.jsonl'),
    );

    const parser = new CodexParser();
    const result = await parser.parse(parserContext(tmp, true));

    expect(result.records[0]?.project).toBe('NowCoding');
  });
});
