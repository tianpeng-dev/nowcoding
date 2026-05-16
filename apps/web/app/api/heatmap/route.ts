import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { toPublicHeatmapResponse } from '@/lib/heatmap-response';
import { toLocalDateKey } from '@nowcoding/core/heatmap';
import { getDb, getHeatmap } from '@nowcoding/db';
import { type NextRequest, NextResponse } from 'next/server';

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const owner = getOwnerProfile();
    const yearParam = req.nextUrl.searchParams.get('year');
    const year =
      yearParam === null
        ? Number(toLocalDateKey(new Date(), owner.timezone).slice(0, 4))
        : Number(yearParam);
    if (!Number.isInteger(year) || year < 1970 || year > 9999) {
      return NextResponse.json({ error: 'INVALID_YEAR' }, { status: 400 });
    }

    const db = getDb(env.DATABASE_URL);
    const heatmap = await getHeatmap(db, { year, timezone: owner.timezone });
    return NextResponse.json(toPublicHeatmapResponse(heatmap, getServerPrivacy().showCost), {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('[heatmap] failed:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
