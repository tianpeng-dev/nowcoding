import { describe, expect, it } from 'vitest';
import { deriveLiveStatus } from '../src/activity';

const NOW = new Date('2026-05-14T12:00:00.000Z');

function minutesAgo(minutes: number) {
  return new Date(NOW.getTime() - minutes * 60_000);
}

describe('deriveLiveStatus', () => {
  it('returns inactive with no activity', () => {
    expect(deriveLiveStatus(null, NOW)).toBe('inactive');
  });

  it('treats activity at the 5-minute boundary as live', () => {
    expect(deriveLiveStatus(minutesAgo(5), NOW)).toBe('live');
    expect(deriveLiveStatus(new Date(NOW.getTime() - 5 * 60_000 - 1), NOW)).toBe('recent');
  });

  it('treats activity at the 60-minute boundary as recent', () => {
    expect(deriveLiveStatus(minutesAgo(60), NOW)).toBe('recent');
    expect(deriveLiveStatus(new Date(NOW.getTime() - 60 * 60_000 - 1), NOW)).toBe('idle');
  });

  it('treats activity at the 24-hour boundary as idle', () => {
    expect(deriveLiveStatus(new Date(NOW.getTime() - 24 * 60 * 60_000), NOW)).toBe('idle');
    expect(deriveLiveStatus(new Date(NOW.getTime() - 24 * 60 * 60_000 - 1), NOW)).toBe('inactive');
  });

  it('clamps future activity to live for client clock skew', () => {
    expect(deriveLiveStatus(new Date(NOW.getTime() + 60_000), NOW)).toBe('live');
  });
});
