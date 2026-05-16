import { loadConfig as defaultLoadConfig } from '../lib/config.js';

export interface ArenaOptions {
  action?: string;
}

export interface ArenaDeps {
  loadConfig?: typeof defaultLoadConfig;
}

export async function runArena(opts: ArenaOptions = {}, deps: ArenaDeps = {}): Promise<void> {
  const action = opts.action ?? 'status';
  if (action !== 'status' && action !== 'connect' && action !== 'disconnect') {
    throw new Error(`Unknown arena action: ${action}`);
  }

  if (action === 'connect') {
    throw new Error('Arena connect is not wired to the Cloud API yet.');
  }
  if (action === 'disconnect') {
    throw new Error('Arena disconnect is not wired to the Cloud API yet.');
  }

  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const cfg = await loadConfig();
  if (!cfg || cfg.mode !== 'cloud') {
    throw new Error('Arena requires `nowcoding login` with a Cloud account.');
  }

  const username = cfg.cloud.username ?? 'unknown';
  console.log(cfg.cloud.arenaJoined ? `Arena: joined as ${username}` : 'Arena: not joined');
  console.log(`Device: ${cfg.cloud.deviceId ?? 'unknown'}`);
  console.log(`Endpoint: ${cfg.endpoint}`);
}
