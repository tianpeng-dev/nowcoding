import type { PrivacySettings } from './types';
import { PRIVACY_DEFAULTS_FAIL_CLOSED } from './types';

// P0-3: Privacy must AND local with server, NEVER spread/merge.
// `{...local, ...server}` would let the server *relax* privacy when the user
// expected it tightened. The user's local config has hard veto.
//
// Server unreachable / undefined → treat each field as false (fail-closed).
export function effectivePrivacy(
  local: PrivacySettings,
  server: Partial<PrivacySettings> | undefined | null,
): PrivacySettings {
  if (!server) return { ...PRIVACY_DEFAULTS_FAIL_CLOSED };
  return {
    uploadProject: local.uploadProject && (server.uploadProject ?? false),
    uploadHostname: local.uploadHostname && (server.uploadHostname ?? false),
    showCost: local.showCost && (server.showCost ?? false),
    showLive: local.showLive && (server.showLive ?? false),
  };
}

export function applyPrivacyToProject(project: string, allow: boolean): string {
  return allow ? project : 'unknown';
}

export function applyPrivacyToHostname(hostname: string, allow: boolean): string {
  return allow ? hostname : 'unknown';
}
