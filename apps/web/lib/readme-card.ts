import type { SurfaceTone } from './public-surface';

export interface ReadmeCardData {
  displayName: string;
  periodLabel: string;
  tokenLabel: string;
  costLabel: string;
  liveLabel: string;
  liveTone: SurfaceTone;
  streakLabel: string;
  topModel: string;
  milestoneLabel: string | null;
  timeSavedLabel: string;
  peakActivityLabel: string;
  sparkline: number[];
  theme: 'light' | 'dark';
}

const FONT = 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
const MONO_FONT =
  'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace';
const TITLE_MAX = 21;
const MILESTONE_MAX = 20;
const COST_MAX = 28;
const COST_VALUE_MAX = 10;
const LIVE_MAX = 18;
const STREAK_MAX = 8;
const DIMENSION_MAX = 17;
const ENGAGEMENT_MAX = 13;

export function renderReadmeCardSvg(card: ReadmeCardData): string {
  const palette = card.theme === 'dark' ? darkPalette : lightPalette;
  const live = livePalette(card.liveTone, card.theme);
  const path = sparklinePath(card.sparkline, 5, 15, 400, 65, 95);
  const displayName = clampText(card.displayName, TITLE_MAX);
  const milestoneLabel =
    card.milestoneLabel === null ? null : clampText(card.milestoneLabel, MILESTONE_MAX);
  const costLabel = clampText(card.costLabel, COST_MAX);
  const costValue = clampText(formatCostValue(costLabel), COST_VALUE_MAX);
  const liveLabel = clampText(card.liveLabel, LIVE_MAX);
  const streakLabel = clampText(card.streakLabel, STREAK_MAX);
  const topModel = clampText(card.topModel, DIMENSION_MAX);
  const timeSavedLabel = clampText(card.timeSavedLabel, ENGAGEMENT_MAX);
  const peakActivityLabel = clampText(card.peakActivityLabel, ENGAGEMENT_MAX);
  const title = `${displayName} - NowCoding ${card.periodLabel}`;
  const milestonePill = milestoneLabel
    ? `<g transform="translate(88, 17)">
        <rect x="0" y="0" width="150" height="22" rx="6" fill="${palette.panel}" stroke="${palette.panelBorder}" stroke-width="1"/>
        <text x="10" y="15" fill="${palette.muted}" font-size="10" font-weight="600" letter-spacing="0.5">
          <tspan fill="${palette.milestoneText}">✦</tspan> ${escapeXml(milestoneLabel)}
        </text>
    </g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330" viewBox="0 0 800 330" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <defs>
    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.chartLine}" stop-opacity="${palette.areaStartOpacity}"/>
      <stop offset="100%" stop-color="${palette.chartLine}" stop-opacity="0"/>
    </linearGradient>
    <style>
      text {
        font-family: ${FONT};
      }
      .mono {
        font-family: ${MONO_FONT};
      }
      @keyframes smoothFadeInUp {
        0% { opacity: 0; transform: translateY(12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes drawLineSmooth {
        0% { stroke-dashoffset: 700; opacity: 0; }
        10% { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes fadeFill {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes pulseDot {
        0% { transform: scale(0.8); opacity: 0.8; }
        50% { transform: scale(2.2); opacity: 0; }
        100% { transform: scale(0.8); opacity: 0; }
      }
      .entry-smooth {
        animation: smoothFadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        opacity: 0;
      }
      .delay-1 { animation-delay: 0.15s; }
      .delay-2 { animation-delay: 0.3s; }
      .delay-3 { animation-delay: 0.45s; }
      .delay-4 { animation-delay: 0.6s; }
      .pulse-indicator {
        transform-origin: 20px 16px;
        animation: pulseDot 2.5s infinite cubic-bezier(0.2, 0, 0, 1);
      }
      .chart-line-smooth {
        stroke-dasharray: 700;
        stroke-dashoffset: 700;
        opacity: 0;
        animation: drawLineSmooth 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards 0.45s;
      }
      .chart-fill-smooth {
        opacity: 0;
        animation: fadeFill 1.2s ease-in-out forwards 1.2s;
      }
      .stat-module {
        transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .stat-module:hover {
        transform: translateY(-4px);
      }
    </style>
  </defs>

  <rect width="800" height="330" rx="12" fill="${palette.background}" stroke="${palette.border}" stroke-width="1"/>

  <g transform="translate(40, 35)">
    <g class="entry-smooth">
      <rect x="0" y="0" width="6" height="24" rx="3" fill="${palette.chartLine}"/>
      <text x="16" y="12" fill="${palette.muted}" font-size="12" font-weight="700" letter-spacing="1.5">NOWCODING • ${escapeXml(card.periodLabel.toUpperCase())}</text>
      <text x="16" y="35" fill="${palette.foreground}" font-size="24" font-weight="800">${escapeXml(displayName)}</text>
      ${milestonePill}
    </g>
  </g>

  <g transform="translate(620, 30)">
    <g class="entry-smooth delay-1">
      <rect x="0" y="0" width="140" height="32" rx="16" fill="${live.background}" stroke="${live.border}" stroke-width="1"/>
      <circle cx="20" cy="16" r="4" fill="${live.dot}" class="pulse-indicator"/>
      <circle cx="20" cy="16" r="4" fill="${live.dotSolid}"/>
      <text x="35" y="21" fill="${live.text}" font-size="14" font-weight="700">${escapeXml(liveLabel)}</text>
    </g>
  </g>

  <g transform="translate(40, 155)">
    <g class="entry-smooth delay-2">
      <text x="0" y="0" fill="${palette.foreground}" font-size="64" font-weight="800" letter-spacing="-1" class="mono">${escapeXml(card.tokenLabel)}</text>
      <text x="5" y="25" fill="${palette.subtle}" font-size="16" font-weight="500">tokens processed</text>
    </g>
  </g>

  <g transform="translate(40, 205)">
    <g class="entry-smooth delay-3">
      <rect x="0" y="0" width="190" height="34" rx="8" fill="${palette.panel}" stroke="${palette.panelBorder}" stroke-width="1"/>
      <text x="15" y="22" fill="${palette.costIcon}" font-size="15">⚡</text>
      <text x="35" y="22" fill="${palette.muted}" font-size="14" font-weight="600">Est. Cost:</text>
      <text x="115" y="22" fill="${palette.foreground}" font-size="15" font-weight="700" class="mono">${escapeXml(costValue)}</text>
    </g>
  </g>

  <g transform="translate(350, 105)">
    <g class="entry-smooth delay-3">
      <rect width="410" height="100" rx="8" fill="${palette.panel}" stroke="${palette.panelBorder}" stroke-width="1"/>
      <line x1="5" y1="85" x2="405" y2="85" stroke="${palette.border}" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="${escapeXml(path.area)}" fill="url(#chartGradient)" class="chart-fill-smooth"/>
      <path d="${escapeXml(path.line)}" fill="none" stroke="${palette.chartLine}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chart-line-smooth"/>
      <text x="400" y="90" fill="${palette.subtle}" font-size="11" font-weight="600" text-anchor="end">Last 7 Days</text>
    </g>
  </g>

  <g class="entry-smooth delay-4">
    <line x1="40" y1="260" x2="760" y2="260" stroke="${palette.border}" stroke-width="1"/>
  </g>

  <g class="entry-smooth delay-4">
    <g transform="translate(40, 275)">
      <g class="stat-module">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="${palette.modelIconBg}" opacity="0.7"/>
        <text x="35" y="9" fill="${palette.muted}" font-size="11" font-weight="600" text-transform="uppercase">Model</text>
        <text x="35" y="23" fill="${palette.foreground}" font-size="14" font-weight="700" class="mono">${escapeXml(topModel)}</text>
      </g>
    </g>

    <g transform="translate(225, 275)">
      <g class="stat-module">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="${palette.timeIconBg}" opacity="0.7"/>
        <text x="35" y="9" fill="${palette.muted}" font-size="11" font-weight="600" text-transform="uppercase">Time Saved</text>
        <text x="35" y="23" fill="${palette.timeIcon}" font-size="14" font-weight="700" class="mono">${escapeXml(timeSavedLabel)}</text>
      </g>
    </g>

    <g transform="translate(410, 275)">
      <g class="stat-module">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="${palette.peakIconBg}" opacity="0.7"/>
        <text x="35" y="9" fill="${palette.muted}" font-size="11" font-weight="600" text-transform="uppercase">Peak Act.</text>
        <text x="35" y="23" fill="${palette.peakIcon}" font-size="14" font-weight="700" class="mono">${escapeXml(peakActivityLabel)}</text>
      </g>
    </g>

    <g transform="translate(595, 275)">
      <g class="stat-module">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="${palette.streakIconBg}" opacity="0.7"/>
        <text x="35" y="9" fill="${palette.muted}" font-size="11" font-weight="600" text-transform="uppercase">Streak</text>
        <text x="35" y="23" fill="${palette.streakIcon}" font-size="14" font-weight="700" class="mono">${escapeXml(streakLabel)}</text>
      </g>
    </g>
  </g>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatCostValue(value: string): string {
  return value.replace(/\s+estimated$/i, '');
}

function sparklinePath(
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  areaBaseline = y + height,
): { line: string; area: string } {
  if (values.length === 0) {
    return {
      line: `M ${x} ${areaBaseline} L ${x + width} ${areaBaseline}`,
      area: `M ${x} ${areaBaseline} L ${x + width} ${areaBaseline} L ${x + width} ${areaBaseline} L ${x} ${areaBaseline} Z`,
    };
  }

  const safeValues = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...safeValues, 1);
  const step = safeValues.length === 1 ? 0 : width / (safeValues.length - 1);
  const points = safeValues.map((value, index) => {
    const px = x + step * index;
    const py = y + height - (value / max) * height;
    return [round(px), round(py)] as const;
  });
  const line = points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px} ${py}`).join(' ');
  const first = points[0] ?? [x, areaBaseline];
  const last = points[points.length - 1] ?? [x + width, areaBaseline];

  return {
    line,
    area: `${line} L ${last[0]} ${areaBaseline} L ${first[0]} ${areaBaseline} Z`,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function livePalette(
  tone: SurfaceTone,
  theme: 'light' | 'dark',
): { dot: string; dotSolid: string; text: string; background: string; border: string } {
  if (tone === 'live') {
    return {
      dot: '#10b981',
      dotSolid: '#34d399',
      text: theme === 'dark' ? '#34d399' : '#047857',
      background: theme === 'dark' ? '#064e3b' : '#ecfdf5',
      border: theme === 'dark' ? '#047857' : '#bbf7d0',
    };
  }
  if (tone === 'recent') {
    return {
      dot: '#f59e0b',
      dotSolid: '#f59e0b',
      text: theme === 'dark' ? '#fbbf24' : '#b45309',
      background: theme === 'dark' ? '#3a2403' : '#fffbeb',
      border: theme === 'dark' ? '#92400e' : '#fcd34d',
    };
  }
  if (tone === 'private') {
    return {
      dot: '#8b5cf6',
      dotSolid: '#a78bfa',
      text: theme === 'dark' ? '#c4b5fd' : '#6d28d9',
      background: theme === 'dark' ? '#22124d' : '#f5f3ff',
      border: theme === 'dark' ? '#5b21b6' : '#ddd6fe',
    };
  }
  return {
    dot: '#94a3b8',
    dotSolid: '#94a3b8',
    text: theme === 'dark' ? '#cbd5e1' : '#475569',
    background: theme === 'dark' ? '#111827' : '#f8fafc',
    border: theme === 'dark' ? '#334155' : '#e2e8f0',
  };
}

const lightPalette = {
  background: '#ffffff',
  foreground: '#24292f',
  muted: '#57606a',
  subtle: '#6e7781',
  border: '#e1e4e8',
  panel: '#f6f8fa',
  panelBorder: '#d0d7de',
  chartLine: '#0ea5e9',
  areaStartOpacity: '0.35',
  costIcon: '#f59e0b',
  modelIcon: '#7c3aed',
  modelIconBg: '#ede9fe',
  timeIcon: '#2563eb',
  timeIconBg: '#dbeafe',
  peakIcon: '#0891b2',
  peakIconBg: '#cffafe',
  streakIcon: '#ea580c',
  streakIconBg: '#ffedd5',
  milestoneBg: '#fef3c7',
  milestoneBorder: '#fcd34d',
  milestoneText: '#92400e',
};

const darkPalette = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  muted: '#8b949e',
  subtle: '#a1a1aa',
  border: '#30363d',
  panel: '#161b22',
  panelBorder: '#30363d',
  chartLine: '#38bdf8',
  areaStartOpacity: '0.5',
  costIcon: '#fbbf24',
  modelIcon: '#c4b5fd',
  modelIconBg: '#4c1d95',
  timeIcon: '#7dd3fc',
  timeIconBg: '#0e7490',
  peakIcon: '#67e8f9',
  peakIconBg: '#155e75',
  streakIcon: '#fdba74',
  streakIconBg: '#9a3412',
  milestoneBg: '#451a03',
  milestoneBorder: '#92400e',
  milestoneText: '#fcd34d',
};
