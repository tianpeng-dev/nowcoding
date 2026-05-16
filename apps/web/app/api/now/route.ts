import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { toPublicNowResponse } from '@/lib/now-response';
import { getDb, getNowActivity } from '@nowcoding/db';
import { NextResponse } from 'next/server';

export const revalidate = 30;

export async function GET() {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const owner = getOwnerProfile();
    const now = new Date();
    const db = getDb(env.DATABASE_URL);
    const activity = await getNowActivity(db, { timezone: owner.timezone, now });
    return NextResponse.json(toPublicNowResponse(activity, getServerPrivacy(), now), {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (e) {
    console.error('[now] failed:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
