import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { CLOUD_DEFAULT_ENDPOINT, deviceTokenSchema } from '@nowcoding/core/cloud';
import {
  type DeviceSetupStatusPayload,
  postDeviceSetupStatus as defaultPostDeviceSetupStatus,
} from '../lib/api.js';
import {
  type Config,
  loadConfig as defaultLoadConfig,
  saveConfig as defaultSaveConfig,
  normalizeConfig,
} from '../lib/config.js';
import { askYesNo as defaultAskYesNo } from '../lib/prompt.js';
import { runDaemon as defaultRunDaemon } from './daemon.js';
import { runSyncOnce as defaultRunSyncOnce } from './sync.js';

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 60;

export interface LoginOptions {
  endpoint?: string;
  arena?: boolean;
}

export interface FetchJsonInit {
  method?: string;
  body?: unknown;
}

export interface LoginDeps {
  fetchJson?: (url: string, init?: FetchJsonInit) => Promise<unknown>;
  openBrowser?: (url: string) => Promise<void>;
  saveConfig?: (cfg: Config) => Promise<void>;
  loadConfig?: typeof defaultLoadConfig;
  sleep?: (ms: number) => Promise<void>;
  hostname?: () => string;
  runSyncOnce?: typeof defaultRunSyncOnce;
  askYesNo?: typeof defaultAskYesNo;
  runDaemon?: typeof defaultRunDaemon;
  isInteractive?: () => boolean;
  reportSetupStatus?: (cfg: Config, payload: DeviceSetupStatusPayload) => Promise<{ ok: boolean }>;
}

interface StartResponse {
  verificationUrl?: unknown;
  pollToken?: unknown;
  userCode?: unknown;
}

interface PollResponse {
  status?: unknown;
  endpoint?: unknown;
  deviceToken?: unknown;
  username?: unknown;
  deviceId?: unknown;
  arenaJoined?: unknown;
}

export async function defaultFetchJson(url: string, init: FetchJsonInit = {}): Promise<unknown> {
  const headers: Record<string, string> = {};
  const requestInit: RequestInit = {
    method: init.method,
    headers,
  };

  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify(init.body);
  }

  const res = await fetch(url, requestInit);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Request failed (${res.status} ${res.statusText}) for ${url}${text ? `: ${text}` : ''}`,
    );
  }

  return res.json();
}

export async function openWithSystem(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await execFileAsync('open', [url]);
    return;
  }
  if (process.platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', '', url]);
    return;
  }
  await execFileAsync('xdg-open', [url]);
}

export async function runLogin(opts: LoginOptions = {}, deps: LoginDeps = {}): Promise<void> {
  const endpoint = (opts.endpoint ?? CLOUD_DEFAULT_ENDPOINT).replace(/\/$/, '');
  const fetchJson = deps.fetchJson ?? defaultFetchJson;
  const openBrowser = deps.openBrowser ?? openWithSystem;
  const saveConfig = deps.saveConfig ?? defaultSaveConfig;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const hostname = deps.hostname ?? os.hostname;
  const runSyncOnce = deps.runSyncOnce ?? defaultRunSyncOnce;
  const askYesNo = deps.askYesNo ?? defaultAskYesNo;
  const runDaemon = deps.runDaemon ?? defaultRunDaemon;
  const isInteractive =
    deps.isInteractive ?? (() => process.stdin.isTTY === true && process.stdout.isTTY === true);
  const reportSetupStatus = deps.reportSetupStatus ?? defaultPostDeviceSetupStatus;

  const started = (await fetchJson(`${endpoint}/api/auth/cli/start`, {
    method: 'POST',
    body: {
      deviceName: hostname(),
      joinArena: opts.arena === true,
    },
  })) as StartResponse;

  if (typeof started.verificationUrl !== 'string' || started.verificationUrl.length === 0) {
    throw new Error('Login start response did not include a verification URL.');
  }
  if (typeof started.pollToken !== 'string' || started.pollToken.length === 0) {
    throw new Error('Login start response did not include a poll token.');
  }
  console.log(`Open this URL to finish login: ${started.verificationUrl}`);
  console.log('Finish login in your browser. The CLI will continue automatically.');
  if (typeof started.userCode === 'string' && started.userCode.length > 0) {
    console.log(`Fallback device code: ${started.userCode}`);
  }
  try {
    await openBrowser(started.verificationUrl);
  } catch {
    console.warn(
      '[nowcoding] Could not open browser automatically. Use the printed URL to continue.',
    );
  }

  const current = await loadConfig();

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const polled = (await fetchJson(`${endpoint}/api/auth/cli/poll`, {
      method: 'POST',
      body: {
        pollToken: started.pollToken,
      },
    })) as PollResponse;

    if (polled.status === 'complete') {
      const deviceToken = deviceTokenSchema.parse(polled.deviceToken);
      const username = typeof polled.username === 'string' ? polled.username : null;
      const deviceId = typeof polled.deviceId === 'string' ? polled.deviceId : null;
      const configEndpoint = typeof polled.endpoint === 'string' ? polled.endpoint : endpoint;
      const nextConfig = normalizeConfig({
        ...(current ?? {}),
        mode: 'cloud',
        endpoint: configEndpoint,
        apiToken: deviceToken,
        cloud: {
          username,
          deviceId,
          arenaJoined: polled.arenaJoined === true,
        },
      });

      await saveConfig(nextConfig);
      console.log(`Logged in to NowCoding Cloud as ${username ?? 'unknown'}.`);
      console.log('Syncing recent usage...');
      try {
        await runSyncOnce({ watch: false });
      } catch {
        console.warn(
          '[nowcoding] First sync failed. Login is still complete; run `nowcoding sync` to retry.',
        );
      }

      let automaticSyncEnabled = false;
      let skippedReason: DeviceSetupStatusPayload['skippedReason'] | undefined = 'non_interactive';

      if (isInteractive()) {
        skippedReason = undefined;
        const enableAutomaticSync = await askYesNo('Enable automatic background sync?', false);
        if (enableAutomaticSync) {
          console.log('Installing background sync...');
          try {
            await runDaemon({ action: 'install' });
            try {
              await runDaemon({ action: 'start' });
            } catch {
              await runDaemon({ action: 'restart' });
            }
            automaticSyncEnabled = true;
            console.log('✓ Background sync enabled');
          } catch {
            automaticSyncEnabled = false;
            skippedReason = 'install_failed';
            console.warn(
              '[nowcoding] Automatic background sync was not enabled. Run `nowcoding daemon install` and `nowcoding daemon start` to retry.',
            );
          }
        } else {
          skippedReason = 'user_skipped';
          console.log('Skipped background sync. You can enable it later with:');
          console.log('nowcoding daemon install && nowcoding daemon start');
        }
      }

      try {
        await reportSetupStatus(nextConfig, {
          automaticSyncEnabled,
          source: 'login',
          ...(skippedReason ? { skippedReason } : {}),
          reportedAt: new Date().toISOString(),
        });
      } catch {
        console.warn('[nowcoding] Could not update onboarding sync status.');
      }

      const onboardingUrl = `${configEndpoint.replace(/\/$/, '')}/onboarding?source=cli-login`;
      try {
        await openBrowser(onboardingUrl);
      } catch {
        console.log(`Open onboarding: ${onboardingUrl}`);
      }
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Login timed out waiting for browser verification.');
}
