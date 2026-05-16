import { NextResponse } from 'next/server';
import { verifyBearer } from '../../../../lib/auth';
import { getEnv, getServerPrivacy } from '../../../../lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const env = getEnv();
  if (!verifyBearer(req.headers.get('authorization'), env.NOWCODING_API_TOKEN)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const privacy = getServerPrivacy();
  return NextResponse.json(
    {
      uploadProject: privacy.uploadProject,
      uploadHostname: privacy.uploadHostname,
      showCost: privacy.showCost,
      showLive: privacy.showLive,
      version: '1.0.0',
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600',
      },
    },
  );
}
