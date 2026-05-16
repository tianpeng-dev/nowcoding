const TOOL_THEME_COLORS = {
  'claude-code': '#d97757',
  cursor: '#f4f4f5',
  codex: '#10a37f',
  'gemini-cli': '#4285f4',
  'github-copilot-cli': '#8957e5',
  opencode: '#f97316',
  openclaw: '#38bdf8',
  pi: '#22c55e',
  'qwen-code': '#615ced',
  'kimi-code': '#00d2ff',
  amp: '#ff4f8b',
  droid: '#ff6b35',
  hermes: '#eab308',
  kiro: '#ef4444',
  cline: '#f59e0b',
  'roo-code': '#7c3aed',
  antigravity: '#34d399',
  windsurf: '#06b6d4',
} as const satisfies Record<string, string>;

const FALLBACK_COLORS = [
  '#10a37f',
  '#d97757',
  '#4285f4',
  '#8957e5',
  '#00d2ff',
  '#ff4f8b',
  '#f59e0b',
  '#22c55e',
] as const;

export function getAiCodingThemeColor(value: string): string {
  const key = normalizeThemeKey(value);
  const exact = TOOL_THEME_COLORS[key as keyof typeof TOOL_THEME_COLORS];
  if (exact) return exact;

  if (key.includes('claude') || key.includes('anthropic')) return TOOL_THEME_COLORS['claude-code'];
  if (key.includes('codex') || key.includes('openai') || key.includes('gpt')) {
    return TOOL_THEME_COLORS.codex;
  }
  if (key.includes('gemini') || key.includes('google')) return TOOL_THEME_COLORS['gemini-cli'];
  if (key.includes('copilot') || key.includes('github')) {
    return TOOL_THEME_COLORS['github-copilot-cli'];
  }
  if (key.includes('qwen')) return TOOL_THEME_COLORS['qwen-code'];
  if (key.includes('kimi') || key.includes('moonshot')) return TOOL_THEME_COLORS['kimi-code'];
  if (key.includes('cursor')) return TOOL_THEME_COLORS.cursor;
  if (key.includes('cline')) return TOOL_THEME_COLORS.cline;
  if (key.includes('amp')) return TOOL_THEME_COLORS.amp;
  if (key.includes('droid') || key.includes('factory')) return TOOL_THEME_COLORS.droid;

  return FALLBACK_COLORS[hashThemeKey(key) % FALLBACK_COLORS.length] ?? FALLBACK_COLORS[0];
}

export function themeColorToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeThemeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function hashThemeKey(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}
