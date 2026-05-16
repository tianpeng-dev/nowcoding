import { verifyBearer } from '@/lib/auth';
import { getEnv, getOwnerProfile } from '@/lib/env';
import { getDb, getStreak, owner } from '@nowcoding/db';
import { sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const env = getEnv();
  // Vercel Cron sends Authorization: Bearer ${CRON_SECRET}
  if (!verifyBearer(req.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  const profile = getOwnerProfile();
  const db = getDb(env.DATABASE_URL);
  await db
    .insert(owner)
    .values({
      id: 1,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      githubHandle: profile.githubHandle,
      avatarUrl: profile.avatarUrl,
      websiteUrl: profile.websiteUrl,
      location: profile.location,
    })
    .onConflictDoUpdate({
      target: owner.id,
      set: {
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        githubHandle: profile.githubHandle,
        avatarUrl: profile.avatarUrl,
        websiteUrl: profile.websiteUrl,
        location: profile.location,
        updatedAt: sql`now()`,
      },
    });

  let streak = { current: 0, longest: 0, lastActiveDate: null as string | null };
  try {
    streak = await getStreak(db, { timezone: profile.timezone });
  } catch (e) {
    console.error('[cron] streak failed:', e);
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    owner: profile.username,
    streak,
  });
}
