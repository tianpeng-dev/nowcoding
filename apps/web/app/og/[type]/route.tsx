import { getEnv, getOwnerProfile, getServerPrivacy } from '@/lib/env';
import { buildOgProfileViewData } from '@/lib/og-profile';
import { toNowResponse } from '@/lib/public-surface';
import { getDb, getNowActivity, getPeriodStats, getStreak } from '@nowcoding/db';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await ctx.params;
  const type = rawType.replace(/\.png$/, '');
  const env = getEnv();
  const owner = getOwnerProfile();
  const privacy = getServerPrivacy();
  const now = new Date();
  let view = buildOgProfileViewData({
    owner,
    stats: null,
    now: null,
    streak: null,
    showCost: privacy.showCost,
    type,
  });

  if (env.DATABASE_URL) {
    try {
      const db = getDb(env.DATABASE_URL);
      const [stats, streak, activity] = await Promise.all([
        getPeriodStats(db, '7d'),
        getStreak(db, { timezone: owner.timezone, now }),
        getNowActivity(db, { timezone: owner.timezone, now }),
      ]);
      view = buildOgProfileViewData({
        owner,
        stats,
        now: toNowResponse(activity, privacy, now),
        streak,
        showCost: privacy.showCost,
        type,
      });
    } catch (error) {
      console.error('[og/profile]', error);
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 58%, #312e81 100%)',
        color: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        padding: '64px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#a78bfa', fontSize: 28, letterSpacing: 4, fontWeight: 700 }}>
            NOWCODING
          </span>
          <span
            style={{
              border: `2px solid ${toneColor(view.statusTone)}`,
              borderRadius: 999,
              color: toneColor(view.statusTone),
              fontSize: 24,
              fontWeight: 700,
              padding: '12px 22px',
            }}
          >
            {view.statusLabel}
          </span>
        </div>
        <span style={{ marginTop: 64, fontSize: 78, fontWeight: 800, lineHeight: 1.05 }}>
          {view.title}
        </span>
        <span style={{ marginTop: 18, maxWidth: 860, fontSize: 30, color: '#d4d4d8' }}>
          {view.subtitle}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {view.isEmpty ? (
          <div
            style={{
              border: '2px dashed #52525b',
              borderRadius: 20,
              color: '#d4d4d8',
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              padding: '22px 28px',
            }}
          >
            {view.emptyMessage}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          {view.metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                minWidth: metric.label === 'Live' ? 260 : 210,
                padding: '22px 26px',
              }}
            >
              <span style={{ color: '#a1a1aa', fontSize: 20, fontWeight: 700 }}>
                {metric.label}
              </span>
              <span
                style={{
                  color: metric.tone ? toneColor(metric.tone) : '#fafafa',
                  fontSize: 34,
                  fontWeight: 800,
                  marginTop: 8,
                }}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa' }}>
        <span style={{ fontSize: 22 }}>Public NowCoding profile</span>
        {view.footerSuffix ? <span style={{ fontSize: 18 }}>{view.footerSuffix}</span> : null}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    },
  );
}

function toneColor(tone: 'live' | 'recent' | 'idle' | 'inactive' | 'private') {
  const colors = {
    live: '#34d399',
    recent: '#60a5fa',
    idle: '#fbbf24',
    inactive: '#d4d4d8',
    private: '#a1a1aa',
  };
  return colors[tone];
}
