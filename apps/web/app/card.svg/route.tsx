import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import {
  buildProfileSummary,
  formatCostFromString,
  formatSafeTokens,
  parseCardPeriod,
  toNowResponse,
} from '@/lib/public-surface';
import { renderReadmeCardSvg } from '@/lib/readme-card';
import type { ReadmeCardData } from '@/lib/readme-card';
import { getDb, getNowActivity, getPeriodStats, getStreak } from '@nowcoding/db';
import type { NextRequest } from 'next/server';

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const env = getEnv();
  const owner = getOwnerProfile();
  const privacy = getServerPrivacy();
  const period = parseCardPeriod(req.nextUrl.searchParams.get('period'));
  const theme = req.nextUrl.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const now = new Date();

  const card: ReadmeCardData = {
    displayName: owner.displayName,
    periodLabel: period,
    tokenLabel: '0',
    costLabel: privacy.showCost ? '$0.00 estimated' : 'hidden',
    liveLabel: 'Inactive',
    liveTone: 'inactive' as const,
    streakLabel: '0d',
    topModel: 'unknown',
    milestoneLabel: null,
    timeSavedLabel: '~0 hrs',
    peakActivityLabel: 'No pattern yet',
    sparkline: [] as number[],
    theme,
  };

  if (env.DATABASE_URL) {
    try {
      const db = getDb(env.DATABASE_URL);
      const [stats, streak, activity] = await Promise.all([
        getPeriodStats(db, period, { now, timezone: owner.timezone }),
        getStreak(db, { timezone: owner.timezone, now }),
        getNowActivity(db, { timezone: owner.timezone, now }),
      ]);
      const publicNow = toNowResponse(activity, privacy, now);
      const summary = buildProfileSummary({
        stats,
        now: publicNow,
        streak,
        showCost: privacy.showCost,
      });

      card.tokenLabel = summary.tokenLabel || formatSafeTokens(stats.totalTokens);
      card.costLabel = privacy.showCost ? formatCostFromString(stats.estimatedCostUsd) : 'hidden';
      card.liveLabel = summary.live.label;
      card.liveTone = summary.live.tone;
      card.streakLabel = summary.streakLabel;
      card.topModel = summary.topModel;
      card.milestoneLabel = summary.milestoneLabel;
      card.timeSavedLabel = summary.timeSavedLabel;
      card.peakActivityLabel = summary.peakActivityLabel;
      card.sparkline = stats.sparkline.map((point) => toChartNumber(point.tokens));
    } catch (error) {
      console.error('[card.svg]', error);
    }
  }

  return new Response(renderReadmeCardSvg(card), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
    },
  });
}

function toChartNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  if (value < 0n) return 0;
  return Number(value);
}
