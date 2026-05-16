import os from 'node:os';
import {
  aggregateToBuckets,
  applyPrivacyToHostname,
  applyPrivacyToProject,
  effectivePrivacy,
  extractSessions,
} from '@nowcoding/core';
import { type ParserContext, allParsers } from '@nowcoding/parsers';
import { fetchServerSettings, postIngest } from '../lib/api.js';
import { loadConfig, loadSyncCache, saveSyncCache } from '../lib/config.js';
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
  const cfg = await loadConfig();
  if (!cfg) {
    console.error('No config found. Run `npx nowcoding init` first.');
    process.exit(1);
  }

  const server = await fetchServerSettings(cfg);
  const privacy = effectivePrivacy(cfg.privacy, server);
  console.log(
    `[privacy] local=${JSON.stringify(cfg.privacy)} server=${JSON.stringify(server)} effective=${JSON.stringify(privacy)}`,
  );

  const cache = await loadSyncCache();
  const ctx: ParserContext = {
    homeDir: os.homedir(),
    hostname: cfg.hostname,
    fileCache: cache.files,
    scannedFiles: [],
    allowProject: privacy.uploadProject,
  };

  const parsers = opts.source ? allParsers().filter((p) => p.source === opts.source) : allParsers();

  const allRecords = [];
  const totals = { records: 0, errors: 0 };

  for (const parser of parsers) {
    const detected = await parser.detect(ctx);
    if (!detected) {
      console.log(`[${parser.source}] not detected, skipping`);
      continue;
    }
    try {
      const r = await parser.parse(ctx);
      allRecords.push(...r.records);
      totals.records += r.records.length;
      totals.errors += r.errors.length;
      if (r.errors.length > 0) {
        console.error(`[${parser.source}] errors: ${r.errors.length}`);
        for (const e of r.errors.slice(0, 3)) {
          console.error(`  - ${e.path}: ${e.error}`);
        }
        if (opts.strict && r.errors.length > 0) {
          throw new Error(`strict mode: ${parser.source} had ${r.errors.length} error(s)`);
        }
      } else {
        console.log(`[${parser.source}] ${r.records.length} records parsed`);
      }
    } catch (e) {
      console.error(`[${parser.source}] failed:`, (e as Error).message);
      if (opts.strict) throw e;
    }
  }

  if (allRecords.length === 0) {
    console.log('No new records. Nothing to sync.');
    return;
  }

  const sanitized = allRecords.map((r) => ({
    ...r,
    project: applyPrivacyToProject(r.project, privacy.uploadProject),
  }));
  const buckets = aggregateToBuckets(sanitized);
  const sessions = extractSessions(sanitized);

  console.log(`Aggregated: ${buckets.length} buckets, ${sessions.length} sessions`);

  if (opts.dryRun) {
    console.log('--dry-run: not sending. Sample bucket:', buckets[0]);
    return;
  }

  const payload = {
    buckets: buckets.map((b) => ({
      source: b.source,
      model: b.model,
      project: b.project,
      bucketStart: b.bucketStart.toISOString(),
      inputTokens: Number(b.inputTokens),
      outputTokens: Number(b.outputTokens),
      cachedInputTokens: Number(b.cachedInputTokens),
      reasoningOutputTokens: Number(b.reasoningOutputTokens),
      totalTokens: Number(b.totalTokens),
      requestCount: Number(b.requestCount),
    })),
    sessions: sessions.map((s) => ({
      source: s.source,
      project: s.project,
      sessionHash: s.sessionHash,
      firstMessageAt: s.firstMessageAt.toISOString(),
      lastMessageAt: s.lastMessageAt.toISOString(),
      durationSeconds: s.durationSeconds,
      activeSeconds: s.activeSeconds,
      messageCount: s.messageCount,
      userMessageCount: s.userMessageCount,
      userPromptHours: s.userPromptHours,
    })),
  };

  const res = await postIngest(
    cfg,
    payload,
    applyPrivacyToHostname(cfg.hostname, privacy.uploadHostname),
  );
  console.log(
    `✓ Stored: buckets=${res.stored.buckets}/${res.received.buckets} sessions=${res.stored.sessions}/${res.received.sessions}`,
  );

  for (const f of ctx.scannedFiles) {
    cache.files[f.path] = { mtime: f.mtime, size: f.size };
  }
  cache.lastSyncedAt = new Date().toISOString();
  cache.totalBuckets += res.stored.buckets;
  cache.totalSessions += res.stored.sessions;
  await saveSyncCache(cache);
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
