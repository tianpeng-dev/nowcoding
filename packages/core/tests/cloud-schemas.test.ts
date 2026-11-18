import { describe, expect, it } from 'vitest';
import { cloudIngestPayloadSchema } from '../src/schemas';

describe('cloudIngestPayloadSchema', () => {
  it('allows extreme token totals through validation for anti-abuse inspection', () => {
    const parsed = cloudIngestPayloadSchema.safeParse({
      buckets: [
        {
          source: 'codex',
          model: 'gpt-5',
          project: 'nowcoding',
          bucketStart: '2026-05-15T00:00:00.000Z',
          inputTokens: 2_000_000_001,
          outputTokens: 0,
          totalTokens: 2_000_000_001,
          requestCount: 1,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects oversized session counters', () => {
    const parsed = cloudIngestPayloadSchema.safeParse({
      buckets: [],
      sessions: [
        {
          source: 'codex',
          project: 'nowcoding',
          sessionHash: 'abcdef0123456789',
          firstMessageAt: '2026-05-15T00:00:00.000Z',
          lastMessageAt: '2026-05-15T00:10:00.000Z',
          durationSeconds: Number.MAX_SAFE_INTEGER + 1,
          activeSeconds: 60,
          messageCount: 1,
          userMessageCount: 1,
          userPromptHours: Array.from({ length: 24 }, () => 0),
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects oversized hourly prompt counts', () => {
    const parsed = cloudIngestPayloadSchema.safeParse({
      buckets: [],
      sessions: [
        {
          source: 'codex',
          project: 'nowcoding',
          sessionHash: 'abcdef0123456789',
          firstMessageAt: '2026-05-15T00:00:00.000Z',
          lastMessageAt: '2026-05-15T00:10:00.000Z',
          durationSeconds: 600,
          activeSeconds: 60,
          messageCount: 1,
          userMessageCount: 1,
          userPromptHours: [Number.MAX_SAFE_INTEGER + 1, ...Array.from({ length: 23 }, () => 0)],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
