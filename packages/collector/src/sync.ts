import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { applyPrivacyToHostname, effectivePrivacy } from '@nowcoding/core';
import lockfile from 'proper-lockfile';
import { fetchServerSettings, postIngest } from './api';
import { availableSources, collect } from './collect';
import { CONFIG_DIR, loadConfig, loadSyncCache, saveSyncCache } from './config';

export async function withDeviceLock<T>(fn: () => Promise<T>): Promise<T> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(CONFIG_DIR, {
    lockfilePath: `${CONFIG_DIR}/sync.lock`,
    retries: { retries: 5, minTimeout: 150, maxTimeout: 750 },
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

export async function synchronize(
  opts: { source?: string; sources?: string[]; dryRun?: boolean; strict?: boolean } = {},
) {
  return withDeviceLock(async () => {
    const cfg = await loadConfig();
    if (!cfg) throw new Error('Connect a device or run nowcoding init first.');
    const cache = await loadSyncCache();
    try {
      const privacy = effectivePrivacy(cfg.privacy, await fetchServerSettings(cfg));
      const permitted = cfg.selectedSources ?? availableSources.map((item) => item.source);
      const sources = permitted.filter(
        (s) => (!opts.source || opts.source === s) && (!opts.sources || opts.sources.includes(s)),
      );
      const { buckets, sessions, errors, files } = await collect(sources, privacy.uploadProject);
      if (errors.length) {
        const detail = errors.map((e) => `${e.source}: ${e.message}`).join('\n');
        if (opts.strict) throw new Error(detail);
        console.warn(detail);
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

      if (opts.dryRun)
        return { buckets: payload.buckets.length, sessions: payload.sessions.length, errors };
      const hostname = applyPrivacyToHostname(cfg.hostname, privacy.uploadHostname);
      const destination = createHash('sha256')
        .update(JSON.stringify([cfg.endpoint, cfg.apiToken, hostname, privacy.uploadProject]))
        .digest('hex');
      const snapshots = cache.destination === destination ? { ...cache.snapshots } : {};
      let storedBuckets = 0;
      let storedSessions = 0;
      for (const source of sources.filter((s) => !errors.some((e) => e.source === s))) {
        const group = {
          buckets: payload.buckets.filter((b) => b.source === source),
          sessions: payload.sessions.filter((s) => s.source === source),
        };
        const fingerprint = createHash('sha256').update(JSON.stringify(group)).digest('hex');
        if (snapshots[source] === fingerprint) continue;
        for (
          let start = 0;
          start < Math.max(group.buckets.length, group.sessions.length);
          start += 500
        ) {
          const result = await postIngest(
            cfg,
            {
              buckets: group.buckets.slice(start, start + 500),
              sessions: group.sessions.slice(start, start + 500),
            },
            hostname,
          );
          storedBuckets += result.stored.buckets;
          storedSessions += result.stored.sessions;
        }
        snapshots[source] = fingerprint;
      }
      await saveSyncCache({
        ...cache,
        destination,
        snapshots,
        files: Object.fromEntries(files.map((f) => [f.path, { mtime: f.mtime, size: f.size }])),
        lastSyncedAt: new Date().toISOString(),
        lastError: errors.map((e) => `${e.source}: ${e.message}`).join('\n') || null,
        totalBuckets: cache.totalBuckets + storedBuckets,
        totalSessions: cache.totalSessions + storedSessions,
      });
      return { buckets: storedBuckets, sessions: storedSessions, errors };
    } catch (error) {
      if (!opts.dryRun)
        await saveSyncCache({
          ...cache,
          lastError: error instanceof Error ? error.message : String(error),
        });
      throw error;
    }
  });
}
