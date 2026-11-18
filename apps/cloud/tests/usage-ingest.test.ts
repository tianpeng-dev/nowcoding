import { describe, expect, it } from 'vitest';
import { toBucketRows } from '../lib/bucket-rows';

const device = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
};

describe('toBucketRows', () => {
  it('stores a nonzero cost estimate for known priced model buckets', () => {
    const [row] = toBucketRows(
      [
        {
          source: 'claude-code',
          model: 'claude-sonnet-4-6',
          project: 'nowcoding',
          bucketStart: '2026-05-15T00:00:00.000Z',
          inputTokens: 1_000_000,
          cachedInputTokens: 1_000_000,
          outputTokens: 1_000_000,
          reasoningOutputTokens: 1_000_000,
          totalTokens: 4_000_000,
          requestCount: 2,
        },
      ],
      device,
      'devbox',
      new Date('2026-05-15T00:05:00.000Z'),
    );

    expect(row?.costUsd).toBe('33.300000');
  });

  it('stores zero cost for unknown model buckets', () => {
    const [row] = toBucketRows(
      [
        {
          source: 'custom',
          model: 'local-model',
          project: 'nowcoding',
          bucketStart: '2026-05-15T00:00:00.000Z',
          inputTokens: 1_000_000,
          cachedInputTokens: 0,
          outputTokens: 1_000_000,
          reasoningOutputTokens: 0,
          totalTokens: 2_000_000,
          requestCount: 1,
        },
      ],
      device,
      'devbox',
      new Date('2026-05-15T00:05:00.000Z'),
    );

    expect(row?.costUsd).toBe('0.000000');
  });
});
