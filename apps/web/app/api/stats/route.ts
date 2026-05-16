import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { toPublicStatsResponse } from '@/lib/stats-response';
import { type Period, getDb, getPeriodStats, getStreak } from '@nowcoding/db';
import { type NextRequest, NextResponse } from 'next/server';

export const revalidate = 60;

const PUBLIC_PERIOD_TO_QUERY_PERIOD = {
  today: '1d',
  '7d': '7d',
  '30d': '30d',
  all: 'all',
} satisfies Record<string, Period>;

export async function GET(req: NextRequest) {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }
  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d';
  const period =
    PUBLIC_PERIOD_TO_QUERY_PERIOD[periodParam as keyof typeof PUBLIC_PERIOD_TO_QUERY_PERIOD];
  if (!period) {
    return NextResponse.json({ error: 'INVALID_PERIOD' }, { status: 400 });
  }
  try {
    const db = getDb(env.DATABASE_URL);
    const owner = getOwnerProfile();
    const [stats, streak] = await Promise.all([
      getPeriodStats(db, period),
      getStreak(db, { timezone: owner.timezone }),
    ]);
    return NextResponse.json(toPublicStatsResponse(stats, getServerPrivacy().showCost, streak), {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('[stats] failed:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
