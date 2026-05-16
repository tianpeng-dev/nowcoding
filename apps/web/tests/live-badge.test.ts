import { describe, expect, it } from 'vitest';
import { liveBadgeData } from '../lib/live-badge';

describe('live badge data', () => {
  it('formats public live status', () => {
    expect(liveBadgeData('peng', 'live', 'light')).toEqual({
      label: 'peng · live',
      value: 'live',
      theme: 'light',
    });
  });

  it('formats private live status', () => {
    expect(liveBadgeData('peng', 'private', 'dark')).toEqual({
      label: 'peng · live',
      value: 'private',
      theme: 'dark',
    });
  });
});
