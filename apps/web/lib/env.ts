import { isApiToken } from '@nowcoding/core/token';
import { z } from 'zod';

const envFields = {
  DATABASE_URL: z.string().url().optional(),
  DATABASE_MAX_CONNECTIONS: z.string().optional(),
  NOWCODING_USERNAME: z.string().min(1).default('alice'),
  NOWCODING_TIMEZONE: z.string().min(1).default('UTC'),
  NOWCODING_API_TOKEN: z.string().refine(isApiToken, 'Invalid API token format').optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NOWCODING_GITHUB_HANDLE: z.string().optional(),
  NOWCODING_DISPLAY_NAME: z.string().optional(),
  NOWCODING_BIO: z.string().optional(),
  NOWCODING_WEBSITE_URL: z.string().url().optional(),
  NOWCODING_LOCATION: z.string().optional(),
  NOWCODING_UPLOAD_PROJECT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  NOWCODING_UPLOAD_HOSTNAME: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  NOWCODING_SHOW_COST: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  NOWCODING_SHOW_LIVE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  CRON_SECRET: z.string().optional(),
};

const schema = z.object(envFields);

export type Env = z.infer<typeof schema>;
type EnvFields = typeof envFields;

let cached: Env | undefined;

function parseEnvField<K extends keyof EnvFields>(
  key: K,
  input: NodeJS.ProcessEnv,
  fieldErrors: Partial<Record<keyof EnvFields, string[]>>,
): z.infer<EnvFields[K]> {
  const parsed = envFields[key].safeParse(input[key]);
  if (parsed.success) return parsed.data;

  fieldErrors[key] = parsed.error.errors.map((error) => error.message);
  return envFields[key].parse(undefined);
}

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const fieldErrors: Partial<Record<keyof EnvFields, string[]>> = {};
  const env = {
    DATABASE_URL: parseEnvField('DATABASE_URL', input, fieldErrors),
    DATABASE_MAX_CONNECTIONS: parseEnvField('DATABASE_MAX_CONNECTIONS', input, fieldErrors),
    NOWCODING_USERNAME: parseEnvField('NOWCODING_USERNAME', input, fieldErrors),
    NOWCODING_TIMEZONE: parseEnvField('NOWCODING_TIMEZONE', input, fieldErrors),
    NOWCODING_API_TOKEN: parseEnvField('NOWCODING_API_TOKEN', input, fieldErrors),
    NEXT_PUBLIC_SUPABASE_URL: parseEnvField('NEXT_PUBLIC_SUPABASE_URL', input, fieldErrors),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: parseEnvField(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      input,
      fieldErrors,
    ),
    SUPABASE_SERVICE_ROLE_KEY: parseEnvField('SUPABASE_SERVICE_ROLE_KEY', input, fieldErrors),
    NOWCODING_GITHUB_HANDLE: parseEnvField('NOWCODING_GITHUB_HANDLE', input, fieldErrors),
    NOWCODING_DISPLAY_NAME: parseEnvField('NOWCODING_DISPLAY_NAME', input, fieldErrors),
    NOWCODING_BIO: parseEnvField('NOWCODING_BIO', input, fieldErrors),
    NOWCODING_WEBSITE_URL: parseEnvField('NOWCODING_WEBSITE_URL', input, fieldErrors),
    NOWCODING_LOCATION: parseEnvField('NOWCODING_LOCATION', input, fieldErrors),
    NOWCODING_UPLOAD_PROJECT: parseEnvField('NOWCODING_UPLOAD_PROJECT', input, fieldErrors),
    NOWCODING_UPLOAD_HOSTNAME: parseEnvField('NOWCODING_UPLOAD_HOSTNAME', input, fieldErrors),
    NOWCODING_SHOW_COST: parseEnvField('NOWCODING_SHOW_COST', input, fieldErrors),
    NOWCODING_SHOW_LIVE: parseEnvField('NOWCODING_SHOW_LIVE', input, fieldErrors),
    CRON_SECRET: parseEnvField('CRON_SECRET', input, fieldErrors),
  } satisfies Env;

  if (Object.keys(fieldErrors).length > 0) {
    console.warn('[env] invalid env, using field defaults:', fieldErrors);
  }
  return env;
}

export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}

export function getOwnerProfileFromEnv(env: Env) {
  return {
    username: env.NOWCODING_USERNAME,
    timezone: env.NOWCODING_TIMEZONE,
    displayName: env.NOWCODING_DISPLAY_NAME ?? env.NOWCODING_USERNAME,
    githubHandle: env.NOWCODING_GITHUB_HANDLE,
    bio: env.NOWCODING_BIO,
    websiteUrl: env.NOWCODING_WEBSITE_URL,
    location: env.NOWCODING_LOCATION,
    avatarUrl: env.NOWCODING_GITHUB_HANDLE
      ? `https://github.com/${env.NOWCODING_GITHUB_HANDLE}.png`
      : null,
  };
}

export function getOwnerProfile() {
  return getOwnerProfileFromEnv(getEnv());
}

export function getServerPrivacyFromEnv(env: Env) {
  return {
    uploadProject: env.NOWCODING_UPLOAD_PROJECT,
    uploadHostname: env.NOWCODING_UPLOAD_HOSTNAME,
    showCost: env.NOWCODING_SHOW_COST,
    showLive: env.NOWCODING_SHOW_LIVE,
  };
}

export function getServerPrivacy() {
  return getServerPrivacyFromEnv(getEnv());
}
