import { describe, expect, it } from 'vitest';
import {
  HOMEPAGE_FEATURES,
  HOMEPAGE_PRIMARY_HEADLINE,
  HOMEPAGE_SUBHEAD,
  PRIVACY_PROMISES,
  SHARE_DESTINATIONS,
  SOCIAL_PROOF_SIGNALS,
} from '../lib/social-positioning';

describe('social positioning', () => {
  it('leads with now and people rather than tools or cost', () => {
    expect(HOMEPAGE_PRIMARY_HEADLINE).toBe('See what builders are coding with AI right now.');
    expect(HOMEPAGE_PRIMARY_HEADLINE.toLowerCase()).toContain('right now');
    expect(HOMEPAGE_PRIMARY_HEADLINE.toLowerCase()).not.toContain('cost');
    expect(HOMEPAGE_PRIMARY_HEADLINE.toLowerCase()).not.toContain('dashboard');
  });

  it('frames metrics as social proof', () => {
    expect(SOCIAL_PROOF_SIGNALS).toEqual([
      'Coding now',
      'Current project',
      'AI-assisted streak',
      'Time saved',
      'README card',
      'Share image',
    ]);
  });

  it('prioritizes social distribution channels', () => {
    expect(SHARE_DESTINATIONS).toEqual([
      'GitHub README',
      'X / Twitter',
      'Personal site',
      'Team profile',
    ]);
  });

  it('makes privacy clear without turning the page into a security doc', () => {
    expect(PRIVACY_PROMISES).toEqual([
      'No prompts, code, or completions are uploaded.',
      'Project names can stay private.',
      'Live status can be paused.',
      'Arena is opt-in.',
    ]);
  });

  it('keeps usage analytics as a supporting feature', () => {
    expect(HOMEPAGE_FEATURES.map((feature) => feature.title)).toEqual([
      'Live presence',
      'Shareable profile',
      'Social proof',
      'Usage details',
    ]);
    expect(HOMEPAGE_SUBHEAD).toContain('live profile');
  });
});
