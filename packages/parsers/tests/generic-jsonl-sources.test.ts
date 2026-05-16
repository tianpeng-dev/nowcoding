import { describe, expect, it } from 'vitest';
import { parserMetadata } from '../src/index';

describe('generic JSONL parser fixtures', () => {
  it('has no generic parser metadata sources left', () => {
    expect(parserMetadata.filter((source) => source.status === 'generic')).toEqual([]);
  });
});
