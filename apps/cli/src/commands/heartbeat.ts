import {
  applyPrivacyToHostname,
  applyPrivacyToProject,
  effectivePrivacy,
} from '@nowcoding/core/privacy';
import { type HeartbeatPayload, fetchServerSettings, postHeartbeat } from '../lib/api.js';
import { loadConfig } from '../lib/config.js';

export interface HeartbeatOptions {
  source?: string;
  model?: string;
  project?: string;
  observedAt?: string;
}

export function buildHeartbeatPayload(opts: HeartbeatOptions = {}): HeartbeatPayload {
  const source = opts.source?.trim() || 'manual';
  const model = opts.model?.trim();
  const project = opts.project?.trim() || 'unknown';

  return {
    source,
    ...(model ? { model } : {}),
    project,
    observedAt: opts.observedAt ?? new Date().toISOString(),
  };
}

export async function runHeartbeat(opts: HeartbeatOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.error('No config found. Run `npx nowcoding init` first.');
    process.exit(1);
  }

  const server = await fetchServerSettings(cfg);
  const privacy = effectivePrivacy(cfg.privacy, server);
  if (!privacy.showLive) {
    console.log('[privacy] live heartbeat disabled, skipping');
    return;
  }

  const payload = buildHeartbeatPayload(opts);
  const res = await postHeartbeat(
    cfg,
    {
      ...payload,
      project: applyPrivacyToProject(payload.project, privacy.uploadProject),
    },
    applyPrivacyToHostname(cfg.hostname, privacy.uploadHostname),
  );
  console.log(`✓ Heartbeat recorded at ${res.lastSeenAt}`);
}
