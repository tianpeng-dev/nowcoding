import os from 'node:os';
import {
  type Config,
  LOCAL_PRIVACY_DEFAULTS,
  LOCAL_SOURCES_DEFAULTS,
  saveConfig,
} from '../lib/config.js';
import { ask, askHidden } from '../lib/prompt.js';
import { isApiToken } from '../lib/token.js';

export interface InitOptions {
  endpoint?: string;
  token?: string;
  hostname?: string;
  yes?: boolean;
}

export async function runInit(opts: InitOptions): Promise<void> {
  const endpoint = opts.endpoint ?? (await ask('Endpoint URL', 'https://yourname.vercel.app'));
  const apiToken = opts.token ?? (await askHidden('API token (nc_live_...)'));
  const hostname = opts.hostname ?? os.hostname() ?? 'unknown';

  if (!isApiToken(apiToken)) {
    console.error(
      'Token must match nc_live_<32 base64url chars>. Generate one with: npx nowcoding gen-token',
    );
    process.exit(1);
  }
  if (!/^https?:\/\//.test(endpoint)) {
    console.error('Endpoint must be a full URL (https://...)');
    process.exit(1);
  }

  const cfg: Config = {
    endpoint: endpoint.replace(/\/$/, ''),
    apiToken,
    hostname,
    privacy: LOCAL_PRIVACY_DEFAULTS,
    sources: LOCAL_SOURCES_DEFAULTS,
  };
  await saveConfig(cfg);
  console.log('✓ Config saved to ~/.nowcoding/config.json (mode 0600)');
  console.log('  Run: npx nowcoding sync');
}
