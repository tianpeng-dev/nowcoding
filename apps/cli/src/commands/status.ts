import { loadConfig, loadSyncCache } from '../lib/config.js';

export async function runStatus(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log('Not initialized. Run `nowcoding init`.');
    return;
  }
  const cache = await loadSyncCache();
  console.log(`Endpoint: ${cfg.endpoint}`);
  console.log(`Hostname: ${cfg.hostname}`);
  console.log(`Privacy: ${JSON.stringify(cfg.privacy)}`);
  console.log(`Last synced: ${cache.lastSyncedAt ?? 'never'}`);
  console.log(`Cached files: ${Object.keys(cache.files).length}`);
  console.log(`Total uploaded: buckets=${cache.totalBuckets} sessions=${cache.totalSessions}`);
}
