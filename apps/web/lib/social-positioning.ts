export const HOMEPAGE_PRIMARY_HEADLINE = 'See what builders are coding with AI right now.';

export const HOMEPAGE_SUBHEAD =
  'NowCoding turns AI coding activity into a live profile, shareable status card, and social proof across GitHub and the open web.';

export const SOCIAL_PROOF_SIGNALS = [
  'Coding now',
  'Current project',
  'AI-assisted streak',
  'Time saved',
  'README card',
  'Share image',
] as const;

export const SHARE_DESTINATIONS = [
  'GitHub README',
  'X / Twitter',
  'Personal site',
  'Team profile',
] as const;

export const PRIVACY_PROMISES = [
  'No prompts, code, or completions are uploaded.',
  'Project names can stay private.',
  'Live status can be paused.',
  'Arena is opt-in.',
] as const;

export const HOMEPAGE_FEATURES = [
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
] as const;
