import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { CLOUD_DEFAULT_ENDPOINT } from '@nowcoding/core/cloud';
import {
  type DeviceSetupStatusPayload,
  postDeviceSetupStatus as defaultPostDeviceSetupStatus,
} from '../lib/api.js';
import {
  type Config,
  loadConfig as defaultLoadConfig,
  saveConfig as defaultSaveConfig,
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

import {
  type FetchJsonInit,
  beginLogin,
  defaultFetchJson,
  pollLogin,
} from '@nowcoding/collector/device';
export { defaultFetchJson, type FetchJsonInit } from '@nowcoding/collector/device';

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

  const started = await beginLogin(endpoint, hostname(), opts.arena === true, fetchJson);
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
    const nextConfig = await pollLogin(endpoint, started.pollToken, current, fetchJson);
    if (nextConfig) {
      const username = nextConfig.cloud.username;
      const configEndpoint = nextConfig.endpoint;
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
