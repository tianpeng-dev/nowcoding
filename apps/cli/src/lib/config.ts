import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PrivacySettings } from '@nowcoding/core';
import { CLOUD_DEFAULT_ENDPOINT, type CloudMode } from '@nowcoding/core/cloud';

export interface Config {
  endpoint: string;
  apiToken: string;
  hostname: string;
  privacy: PrivacySettings;
  sources: SourcesConfig;
  mode?: CloudMode;
  cloud?: CloudConfig;
  // Legacy v1.0 field; read only during migration.
  cursorOptIn?: boolean;
}

export interface CloudConfig {
  username: string | null;
  deviceId: string | null;
  arenaJoined: boolean;
}

export interface NormalizedConfig extends Config {
  mode: CloudMode;
  cloud: CloudConfig;
}

export const CONFIG_DIR = path.join(os.homedir(), '.nowcoding');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const CACHE_PATH = path.join(CONFIG_DIR, 'cache', 'sync-state.json');

export const LOCAL_PRIVACY_DEFAULTS: PrivacySettings = {
  uploadProject: false,
  uploadHostname: true,
  showCost: true,
  showLive: true,
};

export interface SourcesConfig {
  cursor: {
    enabled: boolean;
    explicitlyOptedIn: boolean;
    optedInAt: string | null;
  };
}

export const LOCAL_SOURCES_DEFAULTS: SourcesConfig = {
  cursor: {
    enabled: false,
    explicitlyOptedIn: false,
    optedInAt: null,
  },
};

export function normalizePrivacySettings(
  input: Partial<PrivacySettings> | undefined,
): PrivacySettings {
  return {
    ...LOCAL_PRIVACY_DEFAULTS,
    ...input,
    uploadProject: input?.uploadProject ?? LOCAL_PRIVACY_DEFAULTS.uploadProject,
  };
}

export function normalizeSourcesConfig(input: Partial<SourcesConfig> | undefined): SourcesConfig {
  const cursor = input?.cursor;
  const optedInAt =
    typeof cursor?.optedInAt === 'string' && !Number.isNaN(Date.parse(cursor.optedInAt))
      ? cursor.optedInAt
      : null;
  const explicitlyOptedIn = cursor?.explicitlyOptedIn === true;
  const enabled = cursor?.enabled === true && explicitlyOptedIn && optedInAt !== null;

  return {
    cursor: {
      enabled,
      explicitlyOptedIn: enabled ? explicitlyOptedIn : false,
      optedInAt: enabled ? optedInAt : null,
    },
  };
}

export function normalizeConfig(
  input: Partial<Config> & { endpoint?: string; apiToken?: string },
): NormalizedConfig {
  const mode: CloudMode = input.mode === 'cloud' ? 'cloud' : 'self-hosted';

  return {
    endpoint: input.endpoint ?? (mode === 'cloud' ? CLOUD_DEFAULT_ENDPOINT : ''),
    apiToken: input.apiToken ?? '',
    hostname: input.hostname ?? os.hostname(),
    privacy: normalizePrivacySettings(input.privacy),
    sources: normalizeSourcesConfig(input.sources),
    mode,
    cloud: {
      username: input.cloud?.username ?? null,
      deviceId: input.cloud?.deviceId ?? null,
      arenaJoined: input.cloud?.arenaJoined === true,
    },
    cursorOptIn: input.cursorOptIn,
  };
}

export async function loadConfig(): Promise<NormalizedConfig | null> {
  try {
    const buf = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(buf) as Partial<Config>;
    return normalizeConfig(parsed);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function saveConfig(cfg: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export interface SyncStateCache {
  version: 1;
  files: Record<string, { mtime: number; size: number }>;
  lastSyncedAt: string | null;
  totalBuckets: number;
  totalSessions: number;
}

export async function loadSyncCache(): Promise<SyncStateCache> {
  try {
    const buf = await fs.readFile(CACHE_PATH, 'utf8');
    return JSON.parse(buf) as SyncStateCache;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        version: 1,
        files: {},
        lastSyncedAt: null,
        totalBuckets: 0,
        totalSessions: 0,
      };
    }
    throw e;
  }
}

export async function saveSyncCache(cache: SyncStateCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), { mode: 0o600 });
}
