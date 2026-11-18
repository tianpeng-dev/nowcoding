import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';

it('shares one snapshot between concurrent clients and resends a complete changed time bucket', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'nowcoding-sync-'));
  const uploads: { buckets: { totalTokens: number }[] }[] = [];
  // 用本机 HTTP 服务隔离远端持久化，验证真实解析、网络上传、设备锁和失败重试。
  let rejectUpload = false;
  const server = createServer(async (req, res) => {
    if (req.url?.endsWith('/settings')) {
      res.end(JSON.stringify({ uploadProject: false, uploadHostname: false }));
      return;
    }
    if (rejectUpload) {
      res.writeHead(503);
      res.end('service unavailable');
      return;
    }
    const chunks: Buffer[] = [];
    for await (const part of req) chunks.push(part);
    const body = Buffer.concat(chunks);
    const payload = JSON.parse(
      (req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString(),
    );
    uploads.push(payload);
    const counts = { buckets: payload.buckets.length, sessions: payload.sessions.length };
    res.end(JSON.stringify({ received: counts, stored: counts }));
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('missing port');
    vi.stubEnv('NOWCODING_CONFIG_DIR', path.join(folder, 'device'));
    vi.stubEnv('NOWCODING_SOURCE_HOME', folder);
    vi.resetModules();
    const { normalizeConfig, saveConfig, loadSyncCache } = await import('../src/config');
    const { synchronize } = await import('../src/sync');
    await saveConfig(
      normalizeConfig({ endpoint: `http://127.0.0.1:${addr.port}`, apiToken: 'local-test' }),
    );
    const dir = path.join(folder, '.codex/sessions');
    await mkdir(dir, { recursive: true });
    const fixture = await readFile(
      new URL('../../parsers/tests/fixtures/codex/typical.jsonl', import.meta.url),
      'utf8',
    );
    await writeFile(path.join(dir, 'one.jsonl'), fixture);
    const sync = () => synchronize({ source: 'codex', strict: true });
    await Promise.all([sync(), sync()]);
    expect(uploads).toHaveLength(1);
    const total = (payload: (typeof uploads)[number]) =>
      payload.buckets.reduce((sum, b) => sum + b.totalTokens, 0);
    const original = total(uploads[0]!);
    expect(original).toBeGreaterThan(0);
    await writeFile(path.join(dir, 'two.jsonl'), fixture);
    rejectUpload = true;
    await expect(sync()).rejects.toThrow('503');
    expect((await loadSyncCache()).lastError).toContain('503');
    rejectUpload = false;
    await sync();
    expect(uploads).toHaveLength(2);
    expect(total(uploads[1]!)).toBe(original * 2);
    expect((await loadSyncCache()).lastError).toBeNull();
  } finally {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(folder, { recursive: true, force: true });
  }
});
