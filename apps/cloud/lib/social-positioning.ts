export const HOMEPAGE_PRIMARY_HEADLINE_KEY = 'headline' as const;
export const HOMEPAGE_SUBHEAD_KEY = 'description' as const;
export const SHARE_DESTINATION_KEYS = [
  'socialProof.shareDestinations.githubReadme',
  'socialProof.shareDestinations.xTwitter',
  'socialProof.shareDestinations.personalSite',
  'socialProof.shareDestinations.teamProfile',
] as const;
export const SOCIAL_PROOF_SIGNAL_KEYS = [
  'socialProof.signals.codingNow',
  'socialProof.signals.currentProject',
  'socialProof.signals.aiAssistedStreak',
  'socialProof.signals.timeSaved',
  'socialProof.signals.readmeCard',
  'socialProof.signals.shareImage',
] as const;
export const PRIVACY_PROMISE_KEYS = [
  'socialProof.privacy.noPrivateContent',
  'socialProof.privacy.privateProjectNames',
  'socialProof.privacy.pauseLiveStatus',
  'socialProof.privacy.arenaOptIn',
] as const;

export const HOMEPAGE_PRIMARY_HEADLINE = HOMEPAGE_PRIMARY_HEADLINE_KEY;
export const HOMEPAGE_SUBHEAD = HOMEPAGE_SUBHEAD_KEY;
export const SHARE_DESTINATIONS = SHARE_DESTINATION_KEYS;
export const SOCIAL_PROOF_SIGNALS = SOCIAL_PROOF_SIGNAL_KEYS;
export const PRIVACY_PROMISES = PRIVACY_PROMISE_KEYS;
