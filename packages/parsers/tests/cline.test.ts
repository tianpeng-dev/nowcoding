import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClineParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

const EXT_DIR = 'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-cline-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('ClineParser', () => {
  it('detects Cline extension storage', async () => {
    const parser = new ClineParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(tmp, `${EXT_DIR}/state/taskHistory.json`, JSON.stringify([]));

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses api_req_started usage from Cline UI messages', async () => {
    const parser = new ClineParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/state/taskHistory.json`,
      JSON.stringify([
        {
          id: 'task-a',
          cwdOnTaskInitialization: '/Users/peng/work/repo-a',
          modelId: 'fallback-model',
        },
      ]),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-a/ui_messages.json`,
      await readParserFixture('cline', 'typical.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'cline',
      model: 'claude-3.5-sonnet',
      project: 'repo-a',
      inputTokens: 13,
      outputTokens: 6,
      cachedInputTokens: 2,
      reasoningOutputTokens: 0,
      sessionId: 'task-a',
      isUser: false,
    });
  });

  it('uses task fallback model and shadow worktree project', async () => {
    const parser = new ClineParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/state/taskHistory.json`,
      JSON.stringify([
        {
          id: 'task-b',
          shadowGitConfigWorkTree: '/Users/peng/src/repo-b',
          modelId: 'cline-fallback-model',
        },
      ]),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-b/ui_messages.json`,
      await readParserFixture('cline', 'edge.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'cline-fallback-model',
      project: 'repo-b',
      inputTokens: 6,
      outputTokens: 7,
      cachedInputTokens: 3,
    });
  });

  it('records corrupt Cline UI message JSON as parser errors', async () => {
    const parser = new ClineParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/state/taskHistory.json`,
      JSON.stringify([{ id: 'task-c' }]),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-c/ui_messages.json`,
      await readParserFixture('cline', 'corrupt.txt'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
