import { type NextRequest, NextResponse } from 'next/server';
import {
  getProfileHeatmap,
  getPublicProfileUser,
  normalizeHeatmapYear,
} from '../../../../../lib/profile-data';

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

  const year = normalizeHeatmapYear(request.nextUrl.searchParams.get('year'));

  return NextResponse.json(await getProfileHeatmap(user, year), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
