import { describe, expect, it } from 'vitest';
import { V1_BADGE_TYPES, badgeEmbedMarkdown, isV1BadgeType } from '../lib/badges';

describe('badge catalog', () => {
  it('lists the six v1 badge types in README order', () => {
    expect(V1_BADGE_TYPES).toEqual(['today', 'week', 'total', 'model', 'streak', 'live']);
  });

  it('recognizes canonical badge types only', () => {
    expect(isV1BadgeType('live')).toBe(true);
    expect(isV1BadgeType('wrapped')).toBe(false);
  });

  it('builds stable README markdown snippets', () => {
    expect(badgeEmbedMarkdown('https://example.com', 'peng')).toContain(
      '![Live](https://example.com/badge/live.svg)',
    );
    expect(badgeEmbedMarkdown('https://example.com/', 'peng')).toContain(
      '![peng Card](https://example.com/card.svg)',
    );
  });
});
