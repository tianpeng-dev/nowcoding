import { isApiToken } from '@nowcoding/core/token';
import { SOURCE_VERIFY_COMMANDS, selfHostedBroadcastCommands } from './cli-commands';
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
  messages?: SetupStatusMessages;
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
  primaryActionLabel: string;
  primaryCommands: string[];
  sourceCommands: string[];
  statusCards: SetupStatusCard[];
  privacyRows: SetupPrivacyRow[];
  parsers: SetupParserRow[];
}

export interface SetupStatusMessages {
  primaryActionLabel: string;
  statusCards: {
    database: {
      label: string;
      ready: string;
      missing: string;
    };
    token: {
      label: string;
      ready: string;
      missing: string;
      malformed: string;
    };
    endpoint: {
      label: string;
    };
    profile: {
      label: string;
      default: string;
      configured: string;
    };
  };
  privacyRows: {
    projectNames: string;
    hostname: string;
    estimatedCost: string;
    liveStatus: string;
    uploadedWhenAllowed: string;
    hidden: string;
    hiddenPublicly: string;
    visibleAsEstimated: string;
    visible: string;
  };
}

export const DEFAULT_SETUP_STATUS_MESSAGES = {
  primaryActionLabel: 'Start broadcasting',
  statusCards: {
    database: {
      label: 'Database',
      ready: 'DATABASE_URL is configured. Do not expose the connection string.',
      missing: 'DATABASE_URL is missing. Add a Supabase Postgres pooler URL, then redeploy.',
    },
    token: {
      label: 'API token',
      ready: 'NOWCODING_API_TOKEN is configured. The setup page never displays it.',
      missing: 'NOWCODING_API_TOKEN is missing. Generate one locally and add it in Vercel.',
      malformed:
        'NOWCODING_API_TOKEN is malformed. Generate a new one with npx nowcoding gen-token.',
    },
    endpoint: {
      label: 'Endpoint',
    },
    profile: {
      label: 'Profile',
      default: 'NOWCODING_USERNAME is using the default value. Set your public handle.',
      configured: 'Public handle is {username}.',
    },
  },
  privacyRows: {
    projectNames: 'Project names',
    hostname: 'Hostname',
    estimatedCost: 'Estimated cost',
    liveStatus: 'Live status',
    uploadedWhenAllowed: 'uploaded when local config allows',
    hidden: 'hidden',
    hiddenPublicly: 'hidden publicly',
    visibleAsEstimated: 'visible as estimated',
    visible: 'visible',
  },
} as const satisfies SetupStatusMessages;

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
  const messages = input.messages ?? DEFAULT_SETUP_STATUS_MESSAGES;
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
    primaryActionLabel: messages.primaryActionLabel,
    primaryCommands: selfHostedBroadcastCommands(endpointUrl),
    sourceCommands: [...SOURCE_VERIFY_COMMANDS],
    statusCards: [
      {
        key: 'database',
        label: messages.statusCards.database.label,
        ok: dbSet,
        detail: dbSet ? messages.statusCards.database.ready : messages.statusCards.database.missing,
      },
      {
        key: 'token',
        label: messages.statusCards.token.label,
        ok: tokenSet,
        detail: tokenMalformed
          ? messages.statusCards.token.malformed
          : tokenSet
            ? messages.statusCards.token.ready
            : messages.statusCards.token.missing,
      },
      {
        key: 'endpoint',
        label: messages.statusCards.endpoint.label,
        ok: endpointUrl.startsWith('https://'),
        detail: endpointUrl,
      },
      {
        key: 'profile',
        label: messages.statusCards.profile.label,
        ok: username !== 'alice',
        detail:
          username === 'alice'
            ? messages.statusCards.profile.default
            : interpolate(messages.statusCards.profile.configured, { username }),
      },
    ],
    privacyRows: [
      {
        label: messages.privacyRows.projectNames,
        value: input.env.NOWCODING_UPLOAD_PROJECT
          ? messages.privacyRows.uploadedWhenAllowed
          : messages.privacyRows.hidden,
      },
      {
        label: messages.privacyRows.hostname,
        value: input.env.NOWCODING_UPLOAD_HOSTNAME
          ? messages.privacyRows.uploadedWhenAllowed
          : messages.privacyRows.hidden,
      },
      {
        label: messages.privacyRows.estimatedCost,
        value:
          input.env.NOWCODING_SHOW_COST === false
            ? messages.privacyRows.hiddenPublicly
            : messages.privacyRows.visibleAsEstimated,
      },
      {
        label: messages.privacyRows.liveStatus,
        value:
          input.env.NOWCODING_SHOW_LIVE === false
            ? messages.privacyRows.hiddenPublicly
            : messages.privacyRows.visible,
      },
    ],
    parsers: SETUP_PARSER_SOURCES.map((source) => ({
      source,
      status: 'waiting',
    })),
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
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
