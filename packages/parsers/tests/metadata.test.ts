import { describe, expect, it } from 'vitest';
import { allParsers, parserMetadata } from '../src/index';
import { readParserFixture } from './helpers';

describe('parserMetadata', () => {
  it('has one metadata row for each registered parser source', () => {
    const registered = allParsers()
      .map((parser) => parser.source)
      .sort();
    const documented = parserMetadata.map((parser) => parser.source).sort();

    expect(documented).toEqual(registered);
  });

  it('uses explicit support statuses', () => {
    const allowed = new Set(['full', 'partial', 'generic', 'disabled']);
    for (const parser of parserMetadata) {
      expect(allowed.has(parser.status)).toBe(true);
    }
  });

  it('marks cursor as disabled until local opt-in exists', () => {
    expect(parserMetadata.find((parser) => parser.source === 'cursor')).toMatchObject({
      status: 'disabled',
      dataKind: 'mixed',
    });
  });

  it('marks codex as full because it has source-specific token_count parsing', () => {
    expect(parserMetadata.find((parser) => parser.source === 'codex')).toMatchObject({
      status: 'full',
      dataKind: 'jsonl',
    });
  });

  it('requires each full parser to have typical, edge, and corrupt fixtures', async () => {
    const fullSources = parserMetadata.filter((parser) => parser.status === 'full');

    for (const parser of fullSources) {
      const fixtureNames = parser.fixtureNames ?? ['typical.jsonl', 'edge.jsonl', 'corrupt.jsonl'];
      for (const fixtureName of fixtureNames) {
        await expect(readParserFixture(parser.source, fixtureName)).resolves.toBeTruthy();
      }
    }
  });
});
