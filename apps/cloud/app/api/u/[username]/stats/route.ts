import { type NextRequest, NextResponse } from 'next/server';
import { getProfileStats, getPublicProfileUser } from '../../../../../lib/profile-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const user = await getPublicProfileUser(username);

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const stats = await getProfileStats(user, request.nextUrl.searchParams.get('period'));

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
