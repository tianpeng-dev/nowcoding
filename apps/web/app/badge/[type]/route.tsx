import { isV1BadgeType } from '@/lib/badges';
import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { liveBadgeData } from '@/lib/live-badge';
import { toPublicNowResponse } from '@/lib/now-response';
import { formatSafeTokens } from '@/lib/public-surface';
import { streakBadgeData } from '@/lib/streak-badge';
import type { LiveStatus } from '@nowcoding/core/schemas';
import { type Period, getDb, getNowActivity, getPeriodStats, getStreak } from '@nowcoding/db';
import { type NextRequest, NextResponse } from 'next/server';

export const revalidate = 300;

export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await ctx.params;
  const type = rawType.replace(/\.svg$/, '');
  if (!isV1BadgeType(type)) {
    return NextResponse.json({ error: 'UNKNOWN_BADGE' }, { status: 404 });
  }

  const themeParam = req.nextUrl.searchParams.get('theme') ?? 'light';
  const theme: 'light' | 'dark' = themeParam === 'dark' ? 'dark' : 'light';

  const env = getEnv();
  const owner = getOwnerProfile();

  let stats: { totalTokens: bigint; topModel: string | null } | null = null;
  let streak = { current: 0, longest: 0, lastActiveDate: null as string | null };
  let liveStatus: LiveStatus = 'inactive';
  if (env.DATABASE_URL) {
    try {
      const db = getDb(env.DATABASE_URL);
      if (type === 'streak') {
        streak = await getStreak(db, { timezone: owner.timezone });
      } else if (type === 'live') {
        const activity = await getNowActivity(db, { timezone: owner.timezone });
        liveStatus = toPublicNowResponse(activity, getServerPrivacy()).status;
      } else {
        const period: Period = type === 'today' ? '1d' : type === 'total' ? 'all' : '7d';
        const r = await getPeriodStats(db, period);
        stats = { totalTokens: r.totalTokens, topModel: r.topModel };
      }
    } catch (e) {
      console.error('[badge]', e);
    }
  }

  const tokens = stats ? formatSafeTokens(stats.totalTokens) : '—';
  const ctxData = (() => {
    switch (type) {
      case 'today':
        return { label: `${owner.username} · today`, value: `${tokens} tokens`, theme };
      case 'week':
        return { label: `${owner.username} · 7d`, value: `${tokens} tokens`, theme };
      case 'total':
        return { label: `${owner.username} · total`, value: `${tokens} tokens`, theme };
      case 'model':
        return { label: 'powered by', value: stats?.topModel ?? 'unknown', theme };
      case 'streak':
        return streakBadgeData(owner.username, streak, theme);
      case 'live':
        return liveBadgeData(owner.username, liveStatus, theme);
      default:
        return { label: owner.username, value: tokens, theme };
    }
  })();

  return svgResponse(renderBadge(ctxData));
}

interface BadgeData {
  label: string;
  value: string;
  theme: 'light' | 'dark';
}

function renderBadge({ label, value, theme }: BadgeData): string {
  const bg = theme === 'dark' ? '#0a0a0a' : '#ffffff';
  const fg = theme === 'dark' ? '#f5f5f5' : '#0a0a0a';
  const accent = '#7c3aed';
  // Average char width ~ 6.5px at 11px font — rough but consistent.
  const labelWidth = Math.max(60, label.length * 6.6 + 14);
  const valueWidth = Math.max(48, value.length * 6.6 + 14);
  const total = labelWidth + valueWidth;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="bgGrad" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="round">
    <rect width="${total}" height="22" rx="4"/>
  </clipPath>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="22" fill="${accent}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="22" fill="${bg}"/>
    <rect width="${total}" height="22" fill="url(#bgGrad)"/>
  </g>
  <g fill="#ffffff" font-family="ui-sans-serif,system-ui,Helvetica,Arial,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" text-anchor="middle">${escapeXml(label)}</text>
  </g>
  <g fill="${fg}" font-family="ui-sans-serif,system-ui,Helvetica,Arial,sans-serif" font-size="11">
    <text x="${labelWidth + valueWidth / 2}" y="15" text-anchor="middle">${escapeXml(value)}</text>
  </g>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgResponse(svg: string): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
    },
  });
}
