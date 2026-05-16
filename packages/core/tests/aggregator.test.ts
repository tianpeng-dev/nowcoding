import { describe, expect, it } from 'vitest';
import { aggregateToBuckets, bucketStartOf } from '../src/aggregator';

describe('bucketStartOf', () => {
  it('floors to 30-minute boundaries (UTC)', () => {
    expect(bucketStartOf(new Date('2026-05-08T10:14:59Z')).toISOString()).toBe(
      '2026-05-08T10:00:00.000Z',
    );
    expect(bucketStartOf(new Date('2026-05-08T10:29:59Z')).toISOString()).toBe(
      '2026-05-08T10:00:00.000Z',
    );
    expect(bucketStartOf(new Date('2026-05-08T10:30:00Z')).toISOString()).toBe(
      '2026-05-08T10:30:00.000Z',
    );
  });
});

describe('aggregateToBuckets', () => {
  it('groups by (source, model, project, bucketStart) and sums tokens', () => {
    const out = aggregateToBuckets([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        timestamp: new Date('2026-05-08T10:05:00Z'),
        inputTokens: 100,
        outputTokens: 50,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        timestamp: new Date('2026-05-08T10:25:00Z'),
        inputTokens: 200,
        outputTokens: 80,
        cachedInputTokens: 30,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: 'claude-code',
      model: 'opus',
      project: 'demo',
      inputTokens: 300n,
      outputTokens: 130n,
      cachedInputTokens: 30n,
      totalTokens: 460n,
      requestCount: 2n,
    });
    expect(out[0]?.bucketStart.toISOString()).toBe('2026-05-08T10:00:00.000Z');
  });

  it('keeps separate buckets when (source, model, project, bucketStart) differs', () => {
    const out = aggregateToBuckets([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'a',
        timestamp: new Date('2026-05-08T10:05:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'b',
        timestamp: new Date('2026-05-08T10:05:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
      {
        source: 'cursor',
        model: 'opus',
        project: 'a',
        timestamp: new Date('2026-05-08T10:05:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'a',
        timestamp: new Date('2026-05-08T11:00:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
    ]);
    expect(out).toHaveLength(4);
  });

  it('returns empty array on empty input', () => {
    expect(aggregateToBuckets([])).toEqual([]);
  });
});
