import { isApiToken } from '@nowcoding/core/token';
import type { Env } from './env';

export const SETUP_PARSER_SOURCES = [
  'claude-code',
  'cursor',
  'codex',
  'gemini-cli',
  'github-copilot-cli',
  'opencode',
  'openclaw',
  'pi',
  'qwen-code',
  'kimi-code',
  'amp',
  'droid',
  'hermes',
  'kiro',
  'cline',
  'roo-code',
  'antigravity',
  'windsurf',
] as const;

type SetupParserSource = (typeof SETUP_PARSER_SOURCES)[number];

export interface SetupVercelEnv {
  vercelProjectProductionUrl?: string;
  vercelUrl?: string;
  vercelEnv?: string;
}

export interface SetupStatusInput {
  env: Partial<Env>;
  vercel: SetupVercelEnv;
}

export interface SetupStatusCard {
  key: 'database' | 'token' | 'endpoint' | 'profile';
  label: string;
  ok: boolean;
  detail: string;
}

export interface SetupPrivacyRow {
  label: string;
  value: string;
}

export interface SetupParserRow {
  source: SetupParserSource;
  status: 'waiting';
}

export interface SetupStatus {
  endpointUrl: string;
  dashboardUrl: string;
  cliInitCommand: string;
  syncCommand: string;
  heartbeatCommand: string;
  watchCommand: string;
  statusCards: SetupStatusCard[];
  privacyRows: SetupPrivacyRow[];
  parsers: SetupParserRow[];
}

export function resolvePublicOrigin(input: {
  websiteUrl?: string;
  vercelProjectProductionUrl?: string;
  vercelUrl?: string;
}): string {
  const explicit = normalizeOrigin(input.websiteUrl);
  if (explicit) return explicit;

  const production = normalizeVercelHost(input.vercelProjectProductionUrl);
  if (production) return production;

  const preview = normalizeVercelHost(input.vercelUrl);
  if (preview) return preview;

  return 'http://localhost:3000';
}

export function buildSetupStatus(input: SetupStatusInput): SetupStatus {
  const endpointUrl = resolvePublicOrigin({
    websiteUrl: input.env.NOWCODING_WEBSITE_URL,
    vercelProjectProductionUrl: input.vercel.vercelProjectProductionUrl,
    vercelUrl: input.vercel.vercelUrl,
  });
  const dbSet = Boolean(input.env.DATABASE_URL);
  const tokenValue = input.env.NOWCODING_API_TOKEN;
  const tokenSet = isApiToken(tokenValue);
  const tokenMalformed = Boolean(tokenValue && !tokenSet);
  const username = input.env.NOWCODING_USERNAME ?? 'alice';

  return {
    endpointUrl,
    dashboardUrl: 'https://vercel.com/dashboard',
    cliInitCommand: `npx nowcoding init --endpoint ${endpointUrl}`,
    syncCommand: 'npx nowcoding sync',
    heartbeatCommand: 'npx nowcoding heartbeat',
    watchCommand: 'npx nowcoding sync --watch',
    statusCards: [
      {
        key: 'database',
        label: 'Database',
        ok: dbSet,
        detail: dbSet
          ? 'DATABASE_URL is configured. Do not expose the connection string.'
          : 'DATABASE_URL is missing. Add a Supabase Postgres pooler URL, then redeploy.',
      },
      {
        key: 'token',
        label: 'API token',
        ok: tokenSet,
        detail: tokenMalformed
          ? 'NOWCODING_API_TOKEN is malformed. Generate a new one with npx nowcoding gen-token.'
          : tokenSet
            ? 'NOWCODING_API_TOKEN is configured. The setup page never displays it.'
            : 'NOWCODING_API_TOKEN is missing. Generate one locally and add it in Vercel.',
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        ok: endpointUrl.startsWith('https://'),
        detail: endpointUrl,
      },
      {
        key: 'profile',
        label: 'Profile',
        ok: username !== 'alice',
        detail:
          username === 'alice'
            ? 'NOWCODING_USERNAME is using the default value. Set your public handle.'
            : `Public handle is ${username}.`,
      },
    ],
    privacyRows: [
      {
        label: 'Project names',
        value: input.env.NOWCODING_UPLOAD_PROJECT ? 'uploaded when local config allows' : 'hidden',
      },
      {
        label: 'Hostname',
        value: input.env.NOWCODING_UPLOAD_HOSTNAME ? 'uploaded when local config allows' : 'hidden',
      },
      {
        label: 'Estimated cost',
        value: input.env.NOWCODING_SHOW_COST === false ? 'hidden publicly' : 'visible as estimated',
      },
      {
        label: 'Live status',
        value: input.env.NOWCODING_SHOW_LIVE === false ? 'hidden publicly' : 'visible',
      },
    ],
    parsers: SETUP_PARSER_SOURCES.map((source) => ({
      source,
      status: 'waiting',
    })),
  };
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return isWebOrigin(url) ? url.origin : null;
  } catch {
    return null;
  }
}

function normalizeVercelHost(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!isWebOrigin(url)) return null;
    if (url.search || url.hash) return null;
    if (url.hostname.includes(' ') || url.username || url.password) return null;

    return url.origin;
  } catch {
    return null;
  }
}

function isWebOrigin(url: URL): boolean {
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== 'null';
}
