import { getDb, leaderboardEntries, users } from '@nowcoding/cloud-db';
import { leaderboardQuerySchema } from '@nowcoding/core/cloud';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const parsed = leaderboardQuerySchema.safeParse({
    range: request.nextUrl.searchParams.get('range') ?? undefined,
    scope: request.nextUrl.searchParams.get('scope') ?? undefined,
    metric: request.nextUrl.searchParams.get('metric') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { range, scope, metric } = parsed.data;
  const db = getDb();
  const [latest] = await db
    .select({
      generatedAt: sql<string>`max(${leaderboardEntries.generatedAt})::text`,
    })
    .from(leaderboardEntries)
    .where(
      and(
        eq(leaderboardEntries.range, range),
        eq(leaderboardEntries.scope, scope),
        eq(leaderboardEntries.metric, metric),
        isNull(leaderboardEntries.excludedAt),
      ),
    );

  const generatedAtText = latest?.generatedAt;
  const generatedAt = generatedAtText ? new Date(generatedAtText) : null;
  const entries = generatedAt
    ? await db
        .select({
          rank: leaderboardEntries.rank,
          username: users.username,
          avatarUrl: users.avatarUrl,
          publicValue: leaderboardEntries.publicValue,
        })
        .from(leaderboardEntries)
        .innerJoin(users, eq(users.id, leaderboardEntries.userId))
        .where(
          and(
            eq(leaderboardEntries.range, range),
            eq(leaderboardEntries.scope, scope),
            eq(leaderboardEntries.metric, metric),
            eq(leaderboardEntries.generatedAt, generatedAt),
            isNull(leaderboardEntries.excludedAt),
            isNull(users.hiddenAt),
            isNotNull(users.username),
          ),
        )
        .orderBy(leaderboardEntries.rank, desc(leaderboardEntries.score))
        .limit(100)
    : [];

  return NextResponse.json(
    {
      range,
      scope,
      metric,
      label: 'self-reported AI coding activity',
      entries: entries.map((entry) => {
        const publicValue = entry.publicValue ?? '';

        return {
          rank: entry.rank ?? 0,
          username: entry.username ?? 'unknown',
          avatarUrl: entry.avatarUrl,
          publicValue,
          scoreCapped: publicValue.endsWith('+'),
        };
      }),
    },
    {
      headers: { 'Cache-Control': 'public, max-age=60' },
    },
  );
}
