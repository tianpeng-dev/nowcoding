import { describe, expect, it } from 'vitest';
import { buildBucketInsertRows } from '../lib/ingest-cost';

describe('buildBucketInsertRows', () => {
  it('computes cost and price version from bucket wire data', () => {
    const rows = buildBucketInsertRows(
      [
        {
          source: 'claude-code',
          model: 'claude-sonnet-4-6',
          project: 'nowcoding',
          bucketStart: '2026-05-13T08:00:00.000Z',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cachedInputTokens: 1_000_000,
          reasoningOutputTokens: 1_000_000,
          totalTokens: 4_000_000,
          requestCount: 2,
        },
      ],
      'devbox',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'claude-code',
      model: 'claude-sonnet-4-6',
      project: 'nowcoding',
      hostname: 'devbox',
      inputTokens: 1_000_000n,
      outputTokens: 1_000_000n,
      cachedInputTokens: 1_000_000n,
      reasoningOutputTokens: 1_000_000n,
      totalTokens: 4_000_000n,
      requestCount: 2n,
      costUsd: '33.300000',
      priceVersion: '2026-05-13-v1',
    });
    expect(rows[0]?.bucketStart).toEqual(new Date('2026-05-13T08:00:00.000Z'));
  });

  it('stores zero cost with current price version for unknown models', () => {
    const rows = buildBucketInsertRows(
      [
        {
          source: 'custom',
          model: 'local-model',
          project: '',
          bucketStart: '2026-05-13T08:00:00.000Z',
          inputTokens: 10,
          outputTokens: 20,
          cachedInputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 30,
          requestCount: 1,
        },
      ],
      '',
    );

    expect(rows[0]).toMatchObject({
      project: 'unknown',
      hostname: 'unknown',
      costUsd: '0.000000',
      priceVersion: '2026-05-13-v1',
    });
  });
});
