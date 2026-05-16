export const V1_BADGE_TYPES = ['today', 'week', 'total', 'model', 'streak', 'live'] as const;

export type V1BadgeType = (typeof V1_BADGE_TYPES)[number];

export function isV1BadgeType(value: string): value is V1BadgeType {
  return (V1_BADGE_TYPES as readonly string[]).includes(value);
}

export function badgeEmbedMarkdown(baseUrl: string, altName = 'NowCoding'): string {
  const root = baseUrl.replace(/\/$/, '');
  return [
    `![Today](${root}/badge/today.svg)`,
    `![Week](${root}/badge/week.svg)`,
    `![Total](${root}/badge/total.svg)`,
    `![Model](${root}/badge/model.svg)`,
    `![Streak](${root}/badge/streak.svg)`,
    `![Live](${root}/badge/live.svg)`,
    `![${altName} Card](${root}/card.svg)`,
  ].join('\n');
}
