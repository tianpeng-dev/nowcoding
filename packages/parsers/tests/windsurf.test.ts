import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WindsurfParser } from '../src/index';
import { makeTempHome, parserContext, removeTempHome, writeFixture } from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-windsurf-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('WindsurfParser', () => {
  it('stays disabled instead of treating speculative JSONL as real Windsurf usage', async () => {
    const parser = new WindsurfParser();
    await writeFixture(
      tmp,
      'Library/Application Support/Windsurf/sessions/project-a/usage.jsonl',
      '{"timestamp":"2026-05-14T00:00:00.000Z","model":"windsurf-model","usage":{"input_tokens":10,"output_tokens":5}}\n',
    );

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
