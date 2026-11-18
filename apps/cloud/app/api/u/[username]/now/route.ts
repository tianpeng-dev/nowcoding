import { NextResponse } from 'next/server';
import { getProfileNow, getPublicProfileUser } from '../../../../../lib/profile-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;
  const user = await getPublicProfileUser(username);

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(await getProfileNow(user), {
    headers: { 'Cache-Control': 'public, max-age=30' },
  });
}
