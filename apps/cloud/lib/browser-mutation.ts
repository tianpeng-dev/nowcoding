import { type NextRequest, NextResponse } from 'next/server';

function forbidden() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export function rejectCrossSiteBrowserMutation(request: NextRequest): NextResponse | null {
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();

  if (fetchSite === 'same-origin' || fetchSite === 'none') {
    return null;
  }

  if (fetchSite === 'cross-site') {
    return forbidden();
  }

  const origin = request.headers.get('origin');

  if (!origin) {
    return fetchSite === 'same-site' ? forbidden() : null;
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin ? null : forbidden();
  } catch {
    return forbidden();
  }
}
