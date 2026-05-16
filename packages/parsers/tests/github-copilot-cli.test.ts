import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GithubCopilotCliParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-github-copilot-cli-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('GithubCopilotCliParser', () => {
  it('detects Copilot CLI session state storage', async () => {
    const parser = new GithubCopilotCliParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.copilot/session-state/session-a/events.jsonl',
      await readParserFixture('github-copilot-cli', 'typical.jsonl'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses shutdown model metrics from Copilot CLI events', async () => {
    const parser = new GithubCopilotCliParser();
    await writeFixture(
      tmp,
      '.copilot/session-state/session-a/events.jsonl',
      await readParserFixture('github-copilot-cli', 'typical.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'github-copilot-cli',
      model: 'gpt-4.1',
      project: 'repo-a',
      inputTokens: 16,
      outputTokens: 9,
      cachedInputTokens: 4,
      reasoningOutputTokens: 0,
      sessionId: 'session-a',
    });
  });

  it('uses resumed context and skips empty model metrics', async () => {
    const parser = new GithubCopilotCliParser();
    await writeFixture(
      tmp,
      '.copilot/session-state/session-b/events.jsonl',
      await readParserFixture('github-copilot-cli', 'edge.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'claude-3.7-sonnet',
      project: 'unknown',
      inputTokens: 20,
      outputTokens: 11,
      cachedInputTokens: 5,
      reasoningOutputTokens: 0,
      sessionId: 'session-b',
    });
  });

  it('records corrupt Copilot CLI event lines and continues parsing', async () => {
    const parser = new GithubCopilotCliParser();
    await writeFixture(
      tmp,
      '.copilot/session-state/session-c/events.jsonl',
      await readParserFixture('github-copilot-cli', 'corrupt.jsonl'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(1);
  });
});
