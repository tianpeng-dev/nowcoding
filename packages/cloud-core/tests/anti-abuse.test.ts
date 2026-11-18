import { describe, expect, it } from 'vitest';
import { inspectBucketForArena } from '../src/anti-abuse';

describe('inspectBucketForArena', () => {
  const now = new Date('2026-05-15T00:00:00.000Z');

  it('rejects bucket starts more than ten minutes in the future', () => {
    expect(
      inspectBucketForArena({ bucketStart: '2099-01-01T00:00:00.000Z', totalTokens: 1 }, now),
    ).toEqual({ accepted: false, reason: 'future_timestamp' });
  });

  it('rejects extreme single-row token counts', () => {
    expect(
      inspectBucketForArena(
        {
          bucketStart: '2026-05-15T00:00:00.000Z',
          totalTokens: 2_000_000_001,
        },
        now,
      ),
    ).toEqual({ accepted: false, reason: 'extreme_single_row_tokens' });
  });

  it('rejects extreme component token totals even when totalTokens is underreported', () => {
    expect(
      inspectBucketForArena(
        {
          bucketStart: '2026-05-15T00:00:00.000Z',
          totalTokens: 1,
          inputTokens: 2_000_000_001,
          outputTokens: 0,
          cachedInputTokens: 0,
          reasoningOutputTokens: 0,
        },
        now,
      ),
    ).toEqual({ accepted: false, reason: 'extreme_single_row_tokens' });
  });

  it('rejects invalid token counts', () => {
    expect(
      inspectBucketForArena({ bucketStart: '2026-05-15T00:00:00.000Z', totalTokens: -1 }, now),
    ).toEqual({ accepted: false, reason: 'invalid_tokens' });
  });
});
