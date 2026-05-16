import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { runHeartbeat } from './heartbeat.js';
import { sleep as defaultSleep, normalizeWatchIntervalMs, runSyncOnce } from './sync.js';

const SERVICE_LABEL = 'dev.nowcoding.cli';
const execFile = promisify(execFileCallback);

export interface DaemonOptions {
  action?: string;
  intervalMs?: number;
  binPath?: string;
}

export interface DaemonStatus {
  installed: boolean;
  manager: 'launchd' | 'systemd' | 'unsupported';
  servicePath: string | null;
  logPaths: {
    out: string;
    err: string;
  };
}

export interface DaemonStatusOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  exists?: (file: string) => Promise<boolean>;
}

export interface ServiceTemplateOptions {
  binPath: string;
  homeDir: string;
  intervalMs: number;
}

export interface RunDaemonForegroundOptions {
  intervalMs?: number;
  maxRuns?: number;
  runSyncOnce?: typeof runSyncOnce;
  runHeartbeat?: typeof runHeartbeat;
  sleep?: (ms: number) => Promise<void>;
}

export type DaemonServiceAction = 'start' | 'stop' | 'restart' | 'uninstall';

export interface ControlDaemonServiceOptions {
  action: DaemonServiceAction;
  platform?: NodeJS.Platform;
  homeDir?: string;
  uid?: number;
  exists?: (file: string) => Promise<boolean>;
  execFile?: (file: string, args: string[]) => Promise<unknown>;
  rm?: (file: string, opts: { force: boolean }) => Promise<unknown>;
}

export async function runDaemon(opts: DaemonOptions = {}): Promise<void> {
  const action = opts.action ?? 'foreground';
  switch (action) {
    case 'foreground':
      await runDaemonForeground({ intervalMs: opts.intervalMs });
      break;
    case 'status': {
      const status = await buildDaemonStatus();
      printDaemonStatus(status);
      break;
    }
    case 'install':
      await installDaemonService({
        binPath: opts.binPath ?? resolveDaemonBinPath(),
        intervalMs: opts.intervalMs,
      });
      break;
    case 'start':
    case 'stop':
    case 'restart':
    case 'uninstall':
      await controlDaemonService({ action });
      break;
    default:
      throw new Error(`Unknown daemon action: ${action}`);
  }
}

export async function runDaemonForeground(opts: RunDaemonForegroundOptions = {}): Promise<void> {
  const interval = normalizeWatchIntervalMs(opts.intervalMs);
  const syncOnce = opts.runSyncOnce ?? runSyncOnce;
  const heartbeat = opts.runHeartbeat ?? runHeartbeat;
  const sleeper = opts.sleep ?? defaultSleep;
  let runs = 0;

  while (opts.maxRuns === undefined || runs < opts.maxRuns) {
    await syncOnce({ watch: false });
    await heartbeat({ source: 'daemon' });
    runs += 1;
    if (opts.maxRuns !== undefined && runs >= opts.maxRuns) break;
    await sleeper(interval);
  }
}

export async function buildDaemonStatus(opts: DaemonStatusOptions = {}): Promise<DaemonStatus> {
  const platform = opts.platform ?? process.platform;
  const homeDir = opts.homeDir ?? os.homedir();
  const exists = opts.exists ?? pathExists;
  const paths = daemonPaths(homeDir, platform);
  return {
    installed: paths.servicePath ? await exists(paths.servicePath) : false,
    manager: paths.manager,
    servicePath: paths.servicePath,
    logPaths: daemonLogPaths(homeDir),
  };
}

export async function installDaemonService(opts: {
  binPath: string;
  intervalMs?: number;
  platform?: NodeJS.Platform;
  homeDir?: string;
}): Promise<void> {
  const platform = opts.platform ?? process.platform;
  const homeDir = opts.homeDir ?? os.homedir();
  const intervalMs = normalizeWatchIntervalMs(opts.intervalMs);
  const binPath = ensureStableDaemonBinary(opts.binPath);
  const paths = daemonPaths(homeDir, platform);

  if (!paths.servicePath) {
    throw new Error(`Daemon install is not supported on ${platform}`);
  }

  await fs.mkdir(path.dirname(paths.servicePath), { recursive: true });
  await fs.mkdir(path.join(homeDir, '.nowcoding', 'logs'), { recursive: true });

  const content =
    platform === 'darwin'
      ? buildLaunchdPlist({ binPath, homeDir, intervalMs })
      : buildSystemdUnit({ binPath, homeDir, intervalMs });
  await fs.writeFile(paths.servicePath, content, { mode: 0o644 });
  console.log(`Installed ${paths.manager} service file: ${paths.servicePath}`);
  console.log('Start it with your service manager, or run `nowcoding daemon foreground` now.');
}

export async function controlDaemonService(opts: ControlDaemonServiceOptions): Promise<void> {
  const platform = opts.platform ?? process.platform;
  const homeDir = opts.homeDir ?? os.homedir();
  const paths = daemonPaths(homeDir, platform);
  const exists = opts.exists ?? pathExists;
  const run = opts.execFile ?? ((file, args) => execFile(file, args));
  const rm = opts.rm ?? ((file, rmOpts) => fs.rm(file, rmOpts));

  if (!paths.servicePath) {
    throw new Error(`Daemon service control is not supported on ${platform}`);
  }
  if (!(await exists(paths.servicePath))) {
    throw new Error('Daemon is not installed. Run `nowcoding daemon install` first.');
  }

  switch (opts.action) {
    case 'start':
      await startDaemon(platform, paths.servicePath, run, opts.uid);
      console.log('Daemon started.');
      break;
    case 'stop':
      await stopDaemon(platform, paths.servicePath, run, opts.uid);
      console.log('Daemon stopped.');
      break;
    case 'restart':
      await stopDaemon(platform, paths.servicePath, run, opts.uid);
      await startDaemon(platform, paths.servicePath, run, opts.uid);
      console.log('Daemon restarted.');
      break;
    case 'uninstall':
      await uninstallDaemon(platform, paths.servicePath, run, opts.uid);
      await rm(paths.servicePath, { force: true });
      console.log(`Removed daemon service file: ${paths.servicePath}`);
      break;
  }
}

export function ensureStableDaemonBinary(binPath: string): string {
  const normalized = binPath.replace(/\\/g, '/');
  if (
    normalized.includes('/_npx/') ||
    normalized.includes('/.npm/_npx/') ||
    normalized.includes('/node_modules/.pnpm/dlx/')
  ) {
    throw new Error(
      [
        'Daemon install needs a stable nowcoding binary. Install globally with:',
        '  npm install -g nowcoding',
        'Then run:',
        '  nowcoding daemon install',
      ].join('\n'),
    );
  }
  return binPath;
}

export function buildLaunchdPlist(opts: ServiceTemplateOptions): string {
  const logs = daemonLogPaths(opts.homeDir);
  const intervalSeconds = Math.max(1, Math.round(opts.intervalMs / 1000));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(opts.binPath)}</string>
    <string>daemon</string>
    <string>foreground</string>
    <string>--interval-ms</string>
    <string>${opts.intervalMs}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logs.out)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logs.err)}</string>
</dict>
</plist>
`;
}

export function buildSystemdUnit(opts: ServiceTemplateOptions): string {
  const logs = daemonLogPaths(opts.homeDir);
  return `[Unit]
Description=NowCoding local usage sync daemon

[Service]
Type=simple
WorkingDirectory=${path.resolve(opts.homeDir)}
ExecStart=${opts.binPath} daemon foreground --interval-ms ${opts.intervalMs}
Restart=always
RestartSec=30
StandardOutput=append:${logs.out}
StandardError=append:${logs.err}

[Install]
WantedBy=default.target
`;
}

function printDaemonStatus(status: DaemonStatus): void {
  console.log(`Daemon manager: ${status.manager}`);
  console.log(`Daemon installed: ${status.installed ? 'yes' : 'no'}`);
  if (status.servicePath) console.log(`Service file: ${status.servicePath}`);
  console.log(`Logs: ${status.logPaths.out}`);
  console.log(`Errors: ${status.logPaths.err}`);
}

function daemonPaths(
  homeDir: string,
  platform: NodeJS.Platform,
): { manager: DaemonStatus['manager']; servicePath: string | null } {
  if (platform === 'darwin') {
    return {
      manager: 'launchd',
      servicePath: path.join(homeDir, 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`),
    };
  }
  if (platform === 'linux') {
    return {
      manager: 'systemd',
      servicePath: path.join(homeDir, '.config', 'systemd', 'user', 'nowcoding.service'),
    };
  }
  return { manager: 'unsupported', servicePath: null };
}

function daemonLogPaths(homeDir: string): DaemonStatus['logPaths'] {
  return {
    out: path.join(homeDir, '.nowcoding', 'logs', 'daemon.out.log'),
    err: path.join(homeDir, '.nowcoding', 'logs', 'daemon.err.log'),
  };
}

async function startDaemon(
  platform: NodeJS.Platform,
  servicePath: string,
  run: (file: string, args: string[]) => Promise<unknown>,
  uid: number | undefined,
): Promise<void> {
  if (platform === 'darwin') {
    const domain = launchdDomain(uid);
    await run('launchctl', ['bootstrap', domain, servicePath]);
    await run('launchctl', ['kickstart', '-k', `${domain}/${SERVICE_LABEL}`]);
    return;
  }
  await run('systemctl', ['--user', 'daemon-reload']);
  await run('systemctl', ['--user', 'enable', '--now', 'nowcoding.service']);
}

async function stopDaemon(
  platform: NodeJS.Platform,
  servicePath: string,
  run: (file: string, args: string[]) => Promise<unknown>,
  uid: number | undefined,
): Promise<void> {
  if (platform === 'darwin') {
    await run('launchctl', ['bootout', launchdDomain(uid), servicePath]);
    return;
  }
  await run('systemctl', ['--user', 'stop', 'nowcoding.service']);
}

async function uninstallDaemon(
  platform: NodeJS.Platform,
  servicePath: string,
  run: (file: string, args: string[]) => Promise<unknown>,
  uid: number | undefined,
): Promise<void> {
  if (platform === 'darwin') {
    await run('launchctl', ['bootout', launchdDomain(uid), servicePath]);
    return;
  }
  await run('systemctl', ['--user', 'disable', '--now', 'nowcoding.service']);
}

function launchdDomain(uid: number | undefined): string {
  return `gui/${uid ?? process.getuid?.() ?? os.userInfo().uid}`;
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function resolveDaemonBinPath(): string {
  return process.env.NOWCODING_DAEMON_BIN || process.argv[1] || 'nowcoding';
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
