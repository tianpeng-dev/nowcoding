import { describe, expect, it } from 'vitest';
import { extractSessions, hashSessionId } from '../src/extractor';

describe('hashSessionId', () => {
  it('returns first 16 hex chars of sha256', () => {
    const h = hashSessionId('abc-123');
    expect(h).toMatch(/^[a-f0-9]{16}$/);
    expect(h).toBe(hashSessionId('abc-123'));
  });

  it('different ids → different hashes', () => {
    expect(hashSessionId('a')).not.toBe(hashSessionId('b'));
  });
});

describe('extractSessions', () => {
  it('groups by sessionId and computes basic stats', () => {
    const out = extractSessions([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        sessionId: 's1',
        timestamp: new Date('2026-05-08T10:00:00Z'),
        inputTokens: 10,
        outputTokens: 5,
        isUser: true,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        sessionId: 's1',
        timestamp: new Date('2026-05-08T10:03:00Z'),
        inputTokens: 0,
        outputTokens: 100,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        sessionId: 's2',
        timestamp: new Date('2026-05-08T11:00:00Z'),
        inputTokens: 1,
        outputTokens: 1,
        isUser: true,
      },
    ]);
    expect(out).toHaveLength(2);
    const s1 = out[0];
    expect(s1?.messageCount).toBe(2);
    expect(s1?.userMessageCount).toBe(1);
    expect(s1?.durationSeconds).toBe(180);
    expect(s1?.activeSeconds).toBe(180);
    expect(s1?.userPromptHours).toHaveLength(24);
    expect(s1?.userPromptHours[10]).toBe(1);
  });

  it('skips records without sessionId', () => {
    const out = extractSessions([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        timestamp: new Date('2026-05-08T10:00:00Z'),
        inputTokens: 1,
        outputTokens: 1,
      },
    ]);
    expect(out).toEqual([]);
  });

  it('caps activeSeconds at 5 min per gap', () => {
    const out = extractSessions([
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        sessionId: 's1',
        timestamp: new Date('2026-05-08T10:00:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
      {
        source: 'claude-code',
        model: 'opus',
        project: 'demo',
        sessionId: 's1',
        timestamp: new Date('2026-05-08T11:00:00Z'),
        inputTokens: 1,
        outputTokens: 0,
      },
    ]);
    expect(out[0]?.durationSeconds).toBe(3600);
    expect(out[0]?.activeSeconds).toBe(300);
  });
});
