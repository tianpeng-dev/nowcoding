import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RooCodeParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

const EXT_DIR = 'Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-roo-code-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('RooCodeParser', () => {
  it('detects Roo Code extension storage', async () => {
    const parser = new RooCodeParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(tmp, `${EXT_DIR}/tasks/_index.json`, JSON.stringify({ entries: [] }));

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses api_req_started usage from Roo Code indexed tasks', async () => {
    const parser = new RooCodeParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/_index.json`,
      JSON.stringify({
        entries: [
          { id: 'task-a', workspace: '/Users/peng/work/repo-a', apiConfigName: 'roo-fallback' },
        ],
      }),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-a/ui_messages.json`,
      await readParserFixture('roo-code', 'typical.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'roo-code',
      model: 'claude-3.7-sonnet',
      project: 'repo-a',
      inputTokens: 12,
      outputTokens: 8,
      cachedInputTokens: 4,
      sessionId: 'task-a',
    });
  });

  it('falls back to per-task history_item files and profile model names', async () => {
    const parser = new RooCodeParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-b/history_item.json`,
      JSON.stringify({
        id: 'task-b',
        workspace: '/Users/peng/src/repo-b',
        apiConfigName: 'roo-profile-model',
      }),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-b/ui_messages.json`,
      await readParserFixture('roo-code', 'edge.json'),
    );

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'roo-profile-model',
      project: 'repo-b',
      inputTokens: 7,
      outputTokens: 5,
      cachedInputTokens: 2,
    });
  });

  it('records corrupt Roo Code UI message JSON as parser errors', async () => {
    const parser = new RooCodeParser();
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/_index.json`,
      JSON.stringify({ entries: [{ id: 'task-c' }] }),
    );
    await writeFixture(
      tmp,
      `${EXT_DIR}/tasks/task-c/ui_messages.json`,
      await readParserFixture('roo-code', 'corrupt.txt'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
