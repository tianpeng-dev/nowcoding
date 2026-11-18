import {
  formatCloudTimeSaved,
  getProfileNow,
  getProfileStats,
  getPublicProfileUser,
} from '../../../../lib/profile-data';
import { escapeSvgText, svgResponse } from '../../../../lib/profile-svg';

import { clampLabel, formatCompactTokenTotal } from '../../../../lib/card-labels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ username: string }>;
};

function formatCost(value: string | null): string {
  if (!value) {
    return 'hidden';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 'hidden';
  }

  return `$${parsed.toFixed(2)}`;
}

function formatStreak(days: number): string {
  return `${days.toLocaleString('en-US')}d`;
}

function sparklinePolyline(rows: { date: string; totalTokens: string }[]): string {
  const width = 276;
  const height = 86;
  const left = 470;
  const top = 132;
  const values = rows.map((row) => BigInt(row.totalTokens));
  const max = values.reduce((best, value) => (value > best ? value : best), 1n);

  return values
    .map((value, index) => {
      const x = left + (index * width) / Math.max(1, values.length - 1);
      const ratio = Number((value * 1_000_000n) / max) / 1_000_000;
      const y = top + height - ratio * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function sparklineBars(rows: { date: string; totalTokens: string }[]): string {
  const width = 276;
  const height = 86;
  const left = 470;
  const top = 132;
  const gap = 8;
  const barWidth = (width - gap * (rows.length - 1)) / rows.length;
  const values = rows.map((row) => BigInt(row.totalTokens));
  const max = values.reduce((best, value) => (value > best ? value : best), 1n);

  return values
    .map((value, index) => {
      const ratio = Number((value * 1_000_000n) / max) / 1_000_000;
      const barHeight = Math.max(2, ratio * height);
      const x = left + index * (barWidth + gap);
      const y = top + height - barHeight;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3" fill="#1f6feb" opacity="0.2"/>`;
    })
    .join('');
}

function moduleBlock(x: number, label: string, value: string, accent = '#f0f6fc'): string {
  return `<g>
    <rect x="${x}" y="250" width="164" height="52" rx="8" fill="#161b22" stroke="#30363d"/>
    <text x="${x + 16}" y="272" fill="#8b949e" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="0.8">${escapeSvgText(label)}</text>
    <text x="${x + 16}" y="293" fill="${accent}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="17" font-weight="700">${escapeSvgText(value)}</text>
  </g>`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;
  const user = await getPublicProfileUser(username);

  if (!user) {
    return new Response('Not found', { status: 404 });
  }

  const [stats, now] = await Promise.all([getProfileStats(user, '7d'), getProfileNow(user)]);
  const displayName = clampLabel(user.displayName ?? user.username, 28);
  const handle = clampLabel(`@${user.username}`, 30);
  const totalTokens = formatCompactTokenTotal(stats.totalTokens);
  const milestone = stats.milestone
    ? `<rect x="46" y="84" width="${Math.max(96, stats.milestone.length * 8 + 26)}" height="26" rx="13" fill="#1f6feb" opacity="0.18"/>
  <text x="59" y="102" fill="#79c0ff" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="800">${escapeSvgText(stats.milestone)}</text>`
    : '';
  const liveColor =
    now.status === 'active' ? '#3fb950' : now.status === 'idle' ? '#d29922' : '#8b949e';
  const liveLabel = now.currentSource
    ? `${now.status} on ${clampLabel(now.currentSource, 12)}`
    : now.status;
  const points = sparklinePolyline(stats.sparkline);
  const bars = sparklineBars(stats.sparkline);
  const firstDate = stats.sparkline[0]?.date.slice(5) ?? '';
  const lastDate = stats.sparkline.at(-1)?.date.slice(5) ?? '';
  const cost = formatCost(stats.estimatedCostUsd);
  const model = clampLabel(stats.topModel, 15);
  const peakActivity = stats.peakActivity?.label ?? 'none';

  return svgResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330" role="img" aria-label="NowCoding 7 day profile card for ${escapeSvgText(handle)}">
  <rect width="800" height="330" rx="18" fill="#0d1117"/>
  <rect x="1" y="1" width="798" height="328" rx="17" fill="none" stroke="#30363d"/>
  <rect x="24" y="24" width="752" height="282" rx="14" fill="#101418" stroke="#21262d"/>

  <text x="46" y="59" fill="#8b949e" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="800" letter-spacing="1">NOWCODING • 7D</text>
  <circle cx="642" cy="52" r="5" fill="${liveColor}"/>
  <text x="657" y="57" fill="#c9d1d9" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700">${escapeSvgText(liveLabel)}</text>

  <text x="46" y="139" fill="#f0f6fc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="38" font-weight="800">${escapeSvgText(displayName)}</text>
  <text x="48" y="166" fill="#8b949e" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="16">${escapeSvgText(handle)}</text>
  ${milestone}

  <text x="46" y="213" fill="#f0f6fc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="850">${escapeSvgText(totalTokens)}</text>
  <text x="48" y="235" fill="#8b949e" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700">TOKENS</text>
  <rect x="260" y="195" width="116" height="30" rx="15" fill="#161b22" stroke="#30363d"/>
  <text x="278" y="215" fill="#c9d1d9" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="800">Est. Cost ${escapeSvgText(cost)}</text>

  <text x="470" y="106" fill="#8b949e" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="800" letter-spacing="0.8">TOKEN SPARKLINE</text>
  <line x1="470" y1="218" x2="746" y2="218" stroke="#30363d"/>
  ${bars}
  <polyline points="${points}" fill="none" stroke="#58a6ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="470" y="238" fill="#6e7681" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11">${escapeSvgText(firstDate)}</text>
  <text x="724" y="238" fill="#6e7681" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11">${escapeSvgText(lastDate)}</text>

  ${moduleBlock(46, 'MODEL', model)}
  ${moduleBlock(226, 'TIME SAVED', formatCloudTimeSaved(stats.timeSavedMinutes), '#7ee787')}
  ${moduleBlock(406, 'PEAK ACT.', peakActivity, '#ffa657')}
  ${moduleBlock(586, 'STREAK', formatStreak(stats.streak), '#d2a8ff')}
</svg>`);
}
