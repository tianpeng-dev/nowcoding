import {
  formatTokenTotal,
  getProfileNow,
  getProfileStats,
  getPublicProfileUser,
} from '../../../../../lib/profile-data';
import { escapeSvgText, svgResponse } from '../../../../../lib/profile-svg';
import { PROFILE_BADGE_TYPES, type ProfileBadgeType } from '../../../../../lib/profile-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ username: string; type: string }>;
};

function parseBadgeType(type: string): ProfileBadgeType | null {
  if (!type.endsWith('.svg')) {
    return null;
  }

  const badgeType = type.slice(0, -4);

  return PROFILE_BADGE_TYPES.includes(badgeType as ProfileBadgeType)
    ? (badgeType as ProfileBadgeType)
    : null;
}

function renderBadge(label: string, value: string): string {
  const safeLabel = escapeSvgText(label);
  const safeValue = escapeSvgText(value);
  const labelWidth = Math.max(48, safeLabel.length * 7 + 22);
  const valueWidth = Math.max(54, safeValue.length * 7 + 22);
  const width = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${safeLabel}: ${safeValue}">
  <rect width="${labelWidth}" height="28" fill="#24292f"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="28" fill="#0969da"/>
  <text x="${labelWidth / 2}" y="18" fill="#fff" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" text-anchor="middle">${safeLabel}</text>
  <text x="${labelWidth + valueWidth / 2}" y="18" fill="#fff" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${safeValue}</text>
</svg>`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { username, type } = await context.params;
  const badgeType = parseBadgeType(type);

  if (!badgeType) {
    return new Response('Not found', { status: 404 });
  }

  const user = await getPublicProfileUser(username);

  if (!user) {
    return new Response('Not found', { status: 404 });
  }

  const stats = await getProfileStats(
    user,
    badgeType === 'total' || badgeType === 'model' ? 'all' : '7d',
  );
  const now = badgeType === 'today' || badgeType === 'live' ? await getProfileNow(user) : null;

  const valueByType: Record<ProfileBadgeType, string> = {
    today: `${formatTokenTotal(now?.todayTokens ?? '0')} tokens`,
    week: `${formatTokenTotal(stats.totalTokens)} tokens`,
    total: `${formatTokenTotal(stats.totalTokens)} tokens`,
    model: stats.topModel ?? 'none',
    streak: `${stats.streak.toLocaleString('en-US')} days`,
    live: now?.status ?? 'offline',
  };

  return svgResponse(renderBadge(badgeType, valueByType[badgeType]));
}
