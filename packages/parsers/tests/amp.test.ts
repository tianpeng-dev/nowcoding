import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AmpParser } from '../src/index';
import {
  makeTempHome,
  parserContext,
  readParserFixture,
  removeTempHome,
  writeFixture,
} from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-amp-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('AmpParser', () => {
  it('detects Amp thread storage', async () => {
    const parser = new AmpParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(
      tmp,
      '.local/share/amp/threads/T-thread-a.json',
      await readParserFixture('amp', 'typical.json'),
    );

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses usage ledger events from Amp thread JSON', async () => {
    const parser = new AmpParser();
    await writeFixture(
      tmp,
      '.local/share/amp/threads/T-thread-a.json',
      await readParserFixture('amp', 'typical.json'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'amp',
      model: 'claude-3.5-sonnet',
      project: 'unknown',
      inputTokens: 12,
      outputTokens: 7,
      cachedInputTokens: 3,
      reasoningOutputTokens: 0,
      sessionId: 'amp-thread-a',
    });
  });

  it('parses legacy message usage when no ledger is present', async () => {
    const parser = new AmpParser();
    await writeFixture(
      tmp,
      '.local/share/amp/threads/archive/T-thread-b.json',
      await readParserFixture('amp', 'edge.json'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'gpt-4.1',
      inputTokens: 5,
      outputTokens: 11,
      cachedInputTokens: 2,
      sessionId: 'amp-thread-b',
    });
  });

  it('records corrupt Amp thread JSON as parser errors', async () => {
    const parser = new AmpParser();
    await writeFixture(
      tmp,
      '.local/share/amp/threads/T-corrupt.json',
      await readParserFixture('amp', 'corrupt.txt'),
    );

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
