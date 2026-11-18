const DEFAULT_CLOUD_URL = 'https://nowcoding.cc';

export const PROFILE_BADGE_TYPES = ['today', 'week', 'total', 'model', 'streak', 'live'] as const;

export type ProfileBadgeType = (typeof PROFILE_BADGE_TYPES)[number];

export type OfficialProfileUrls = {
  profile: string;
  card: string;
  badges: Record<ProfileBadgeType, string>;
};

function cloudBaseUrl(): string {
  const configured = process.env.NOWCODING_CLOUD_URL?.trim();

  return (configured || DEFAULT_CLOUD_URL).replace(/\/+$/, '');
}

export function buildOfficialProfileUrls(username: string): OfficialProfileUrls {
  const encodedUsername = encodeURIComponent(username);
  const base = `${cloudBaseUrl()}/u/${encodedUsername}`;

  return {
    profile: base,
    card: `${base}/card.svg`,
    badges: Object.fromEntries(
      PROFILE_BADGE_TYPES.map((type) => [type, `${base}/badge/${type}.svg`]),
    ) as Record<ProfileBadgeType, string>,
  };
}
