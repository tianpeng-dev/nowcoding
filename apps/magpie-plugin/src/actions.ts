import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { localActivity } from '@nowcoding/collector/activity';
import { fetchServerSettings } from '@nowcoding/collector/api';
import { availableSources } from '@nowcoding/collector/collect';
import {
  CONFIG_DIR,
  loadConfig,
  loadSyncCache,
  normalizeConfig,
  saveConfig,
  writePrivateJson,
} from '@nowcoding/collector/config';
import { beginLogin, pollLogin } from '@nowcoding/collector/device';
import { synchronize, withDeviceLock } from '@nowcoding/collector/sync';
import { isApiToken } from '@nowcoding/collector/token';
import { CLOUD_DEFAULT_ENDPOINT } from '@nowcoding/core/cloud';
import { z } from 'zod';

const preferences = path.join(CONFIG_DIR, 'magpie.json');
const selection = z
  .array(z.string().refine((s) => availableSources.some((item) => item.source === s)))
  .max(availableSources.length);
async function selectedSources(): Promise<string[]> {
  try {
    return selection.parse(JSON.parse(await readFile(preferences, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
function validEndpoint(value: string) {
  const url = new URL(value);
  if (
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    ) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('请输入 HTTPS 服务地址或本机 HTTP 地址。');
  return url.href.replace(/\/$/, '');
}
const runFile = promisify(execFile);
async function openUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid browser URL');
  if (process.platform === 'darwin') await runFile('open', [url.href]);
  else if (process.platform === 'win32')
    await runFile('rundll32', ['url.dll,FileProtocolHandler', url.href]);
  else await runFile('xdg-open', [url.href]);
}

export function createActions() {
  let login: { pollToken: string; sources: string[]; expires: number } | undefined;
  return async (action: string, body: unknown) => {
    const config = await loadConfig();
    const sources = config?.selectedSources ?? (await selectedSources());
    const base = config && validEndpoint(config.endpoint);
    const profile =
      base &&
      (config?.mode === 'cloud'
        ? config.cloud.username
          ? `${base}/u/${encodeURIComponent(config.cloud.username)}`
          : null
        : base);
    switch (action) {
      case 'state': {
        const cache = await loadSyncCache();
        return {
          availableSources,
          sources,
          device: config && {
            endpoint: base,
            mode: config.mode,
            username: config.cloud.username,
            deviceId: config.cloud.deviceId,
          },
          profile,
          lastSync: cache.lastSyncedAt,
          lastError: cache.lastError,
          pendingLogin: !!login && login.expires > Date.now(),
        };
      }
      case 'sources': {
        const selected = [...new Set(selection.parse(body))];
        await withDeviceLock(async () => {
          const current = await loadConfig();
          await writePrivateJson(preferences, selected);
          if (current?.selectedSources) await saveConfig({ ...current, selectedSources: selected });
        });
        return { sources: selected };
      }
      case 'activity':
        return localActivity(sources);
      case 'sync': {
        if (!sources.length) throw new Error('请先选择编码工具。');
        const result = await synchronize({ sources, strict: true });
        return result;
      }
      case 'self-host': {
        const { endpoint, token } = z
          .object({ endpoint: z.string().min(1), token: z.string().refine(isApiToken) })
          .parse(body);
        if (!sources.length) throw new Error('请先选择编码工具。');
        const next = normalizeConfig({
          endpoint: validEndpoint(endpoint),
          apiToken: token,
          selectedSources: sources,
        });
        await fetchServerSettings(next);
        await withDeviceLock(() => saveConfig(next));
        return { connected: true };
      }
      case 'login': {
        if (!sources.length) throw new Error('请先选择编码工具。');
        const { arena } = z.object({ arena: z.boolean() }).parse(body);
        const started = await beginLogin(CLOUD_DEFAULT_ENDPOINT, hostname(), arena);
        if (new URL(started.verificationUrl).origin !== CLOUD_DEFAULT_ENDPOINT)
          throw new Error('Unexpected verification origin');
        login = { pollToken: started.pollToken, sources, expires: Date.now() + 120000 };
        await openUrl(started.verificationUrl);
        return { pending: true };
      }
      case 'poll': {
        return withDeviceLock(async () => {
          if (!login || Date.now() >= login.expires)
            throw new Error('设备授权已过期，请重新登录。');
          const next = await pollLogin(CLOUD_DEFAULT_ENDPOINT, login.pollToken, await loadConfig());
          if (!next) return { pending: true };
          if (new URL(next.endpoint).origin !== CLOUD_DEFAULT_ENDPOINT)
            throw new Error('Unexpected device endpoint');
          await saveConfig({ ...next, selectedSources: login.sources });
          login = undefined;
          return { pending: false };
        });
      }
      case 'open': {
        const target = z.enum(['profile', 'settings', 'card', 'devices']).parse(body);
        if (!base || !profile) throw new Error('请先连接设备。');
        if ((target === 'settings' || target === 'devices') && config?.mode !== 'cloud')
          throw new Error('需要 Cloud 账号。');
        const urls = {
          profile,
          card: `${profile}/card.svg`,
          settings: `${base}/account/settings`,
          devices: `${base}/account/devices`,
        };
        await openUrl(urls[target]);
        return { opened: true };
      }
      default:
        throw new Error('Unknown action');
    }
  };
}
