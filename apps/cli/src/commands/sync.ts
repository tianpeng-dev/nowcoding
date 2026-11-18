import { synchronize } from '@nowcoding/collector/sync';
import { runHeartbeat } from './heartbeat.js';

export interface SyncOptions {
  dryRun?: boolean;
  source?: string;
  strict?: boolean;
  watch?: boolean;
  watchIntervalMs?: number;
}

export const DEFAULT_WATCH_INTERVAL_MS = 5 * 60_000;
export const MIN_WATCH_INTERVAL_MS = 10_000;

export function normalizeWatchIntervalMs(interval: number | undefined): number {
  if (interval === undefined || !Number.isFinite(interval)) return DEFAULT_WATCH_INTERVAL_MS;
  return Math.max(interval, MIN_WATCH_INTERVAL_MS);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSyncOnce(opts: SyncOptions): Promise<void> {
  const result = await synchronize(opts);
  console.log(`Buckets: ${result.buckets}, sessions: ${result.sessions}`);
}

export async function runSync(opts: SyncOptions): Promise<void> {
  if (!opts.watch) {
    await runSyncOnce(opts);
    return;
  }

  const interval = normalizeWatchIntervalMs(opts.watchIntervalMs);
  while (true) {
    await runSyncOnce({ ...opts, watch: false });
    if (!opts.dryRun) {
      await runHeartbeat({ source: opts.source ?? 'sync' });
    }
    await sleep(interval);
  }
}
