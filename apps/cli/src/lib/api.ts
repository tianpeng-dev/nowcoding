import { gzipSync } from 'node:zlib';
import type { Config } from './config.js';

export const CLIENT_VERSION = 'nowcoding-cli/0.1.0-alpha.3';

type EndpointKind = 'ingest' | 'heartbeat' | 'settings' | 'deviceSetup';

function endpointPath(cfg: Config, kind: EndpointKind): string {
  if (cfg.mode === 'cloud') {
    switch (kind) {
      case 'ingest':
        return '/api/cloud/usage/ingest';
      case 'heartbeat':
        return '/api/cloud/usage/heartbeat';
      case 'settings':
        return '/api/account/settings';
      case 'deviceSetup':
        return '/api/cloud/device/setup';
    }
  }

  switch (kind) {
    case 'ingest':
      return '/api/usage/ingest';
    case 'heartbeat':
      return '/api/usage/heartbeat';
    case 'settings':
      return '/api/usage/settings';
    case 'deviceSetup':
      return '/api/device/setup';
  }
}

function endpointUrl(cfg: Config, kind: EndpointKind): string {
  return `${cfg.endpoint.replace(/\/$/, '')}${endpointPath(cfg, kind)}`;
}

export interface IngestPayload {
  buckets: unknown[];
  sessions?: unknown[];
}

export interface IngestResponse {
  received: { buckets: number; sessions: number };
  stored: { buckets: number; sessions: number };
}

export interface HeartbeatPayload {
  source: string;
  model?: string;
  project: string;
  observedAt: string;
}

export interface HeartbeatResponse {
  ok: boolean;
  lastSeenAt: string;
}

export interface DeviceSetupStatusPayload {
  automaticSyncEnabled: boolean;
  source: 'login' | 'daemon' | 'manual';
  skippedReason?: 'user_skipped' | 'non_interactive' | 'install_failed';
  reportedAt: string;
}

export async function postIngest(
  cfg: Config,
  payload: IngestPayload,
  hostname = cfg.hostname,
): Promise<IngestResponse> {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const gzipped = gzipSync(body);
  const useGzip = gzipped.byteLength < body.byteLength;

  const res = await fetch(endpointUrl(cfg, 'ingest'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiToken}`,
      'X-Hostname': hostname,
      'X-NowCoding-Client': CLIENT_VERSION,
      ...(useGzip ? { 'Content-Encoding': 'gzip' } : {}),
    },
    body: useGzip ? gzipped : body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ingest failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as IngestResponse;
}

export async function postHeartbeat(
  cfg: Config,
  payload: HeartbeatPayload,
  hostname = cfg.hostname,
): Promise<HeartbeatResponse> {
  const res = await fetch(endpointUrl(cfg, 'heartbeat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiToken}`,
      'X-Hostname': hostname,
      'X-NowCoding-Client': CLIENT_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`heartbeat failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as HeartbeatResponse;
}

export async function postDeviceSetupStatus(
  cfg: Config,
  payload: DeviceSetupStatusPayload,
): Promise<{ ok: boolean }> {
  const res = await fetch(endpointUrl(cfg, 'deviceSetup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiToken}`,
      'X-NowCoding-Client': CLIENT_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`device setup status failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as { ok: boolean };
}

export interface ServerSettings {
  uploadProject: boolean;
  uploadHostname: boolean;
  showCost: boolean;
  showLive: boolean;
}

export async function fetchServerSettings(cfg: Config): Promise<ServerSettings | null> {
  try {
    const res = await fetch(endpointUrl(cfg, 'settings'), {
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ServerSettings;
    return {
      uploadProject: !!json.uploadProject,
      uploadHostname: !!json.uploadHostname,
      showCost: !!json.showCost,
      showLive: !!json.showLive,
    };
  } catch {
    return null;
  }
}
