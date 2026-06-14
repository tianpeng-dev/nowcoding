export interface HomepageFeatureCopy {
  title: string;
  body: string;
}

export interface SocialPositioningCopy {
  primaryHeadline: string;
  subhead: string;
  socialProofSignals: readonly string[];
  shareDestinations: readonly string[];
  privacyPromises: readonly string[];
  features: readonly HomepageFeatureCopy[];
}

export const DEFAULT_SOCIAL_POSITIONING_COPY = {
  primaryHeadline: 'See what builders are coding with AI right now.',
  subhead:
    'NowCoding turns AI coding activity into a live profile, shareable status card, and social proof across GitHub and the open web.',
  socialProofSignals: [
    'Coding now',
    'Current project',
    'AI-assisted streak',
    'Time saved',
    'README card',
    'Share image',
  ],
  shareDestinations: ['GitHub README', 'X / Twitter', 'Personal site', 'Team profile'],
  privacyPromises: [
    'No prompts, code, or completions are uploaded.',
    'Project names can stay private.',
    'Live status can be paused.',
    'Arena is opt-in.',
  ],
  features: [
    {
      title: 'Live presence',
      body: 'Show whether you are coding now, recently active, or away.',
    },
    {
      title: 'Shareable profile',
      body: 'Give every builder a public AI coding profile with cards and badges.',
    },
    {
      title: 'Social proof',
      body: 'Use streaks, time saved, milestones, and activity cards to make progress visible.',
    },
    {
      title: 'Usage details',
      body: 'Inspect tools, models, tokens, and cost when you need the deeper breakdown.',
    },
  ],
} as const satisfies SocialPositioningCopy;

export function buildSocialPositioningCopy(
  copy: SocialPositioningCopy = DEFAULT_SOCIAL_POSITIONING_COPY,
): SocialPositioningCopy {
  return copy;
}

export const HOMEPAGE_PRIMARY_HEADLINE = DEFAULT_SOCIAL_POSITIONING_COPY.primaryHeadline;

export const HOMEPAGE_SUBHEAD = DEFAULT_SOCIAL_POSITIONING_COPY.subhead;

export const SOCIAL_PROOF_SIGNALS = DEFAULT_SOCIAL_POSITIONING_COPY.socialProofSignals;

export const SHARE_DESTINATIONS = DEFAULT_SOCIAL_POSITIONING_COPY.shareDestinations;

export const PRIVACY_PROMISES = DEFAULT_SOCIAL_POSITIONING_COPY.privacyPromises;

export const HOMEPAGE_FEATURES = DEFAULT_SOCIAL_POSITIONING_COPY.features;
