import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDaemonStatus,
  buildLaunchdPlist,
  buildSystemdUnit,
  controlDaemonService,
  ensureStableDaemonBinary,
  runDaemonForeground,
} from '../src/commands/daemon';

describe('runDaemonForeground', () => {
  it('runs sync and heartbeat in a foreground loop', async () => {
    const runSyncOnce = vi.fn().mockResolvedValue(undefined);
    const runHeartbeat = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runDaemonForeground({
      intervalMs: 12345,
      maxRuns: 2,
      runSyncOnce,
      runHeartbeat,
      sleep,
    });

    expect(runSyncOnce).toHaveBeenCalledTimes(2);
    expect(runSyncOnce).toHaveBeenCalledWith({ watch: false });
    expect(runHeartbeat).toHaveBeenCalledTimes(2);
    expect(runHeartbeat).toHaveBeenCalledWith({ source: 'daemon' });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(12345);
  });
});

describe('daemon service helpers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports status when the service is not installed', async () => {
    const status = await buildDaemonStatus({
      platform: 'darwin',
      homeDir: '/Users/peng',
      exists: async () => false,
    });

    expect(status).toEqual({
      installed: false,
      manager: 'launchd',
      servicePath: '/Users/peng/Library/LaunchAgents/dev.nowcoding.cli.plist',
      logPaths: {
        out: '/Users/peng/.nowcoding/logs/daemon.out.log',
        err: '/Users/peng/.nowcoding/logs/daemon.err.log',
      },
    });
  });

  it('rejects transient npx and dlx binary paths', () => {
    expect(() =>
      ensureStableDaemonBinary('/Users/peng/.npm/_npx/abc/node_modules/.bin/nowcoding'),
    ).toThrow('Daemon install needs a stable nowcoding binary');
    expect(() =>
      ensureStableDaemonBinary('/Users/peng/app/node_modules/.pnpm/dlx/abc/nowcoding'),
    ).toThrow('Daemon install needs a stable nowcoding binary');
  });

  it('builds a launchd plist for foreground daemon mode', () => {
    expect(
      buildLaunchdPlist({
        binPath: '/usr/local/bin/nowcoding',
        homeDir: '/Users/peng',
        intervalMs: 30 * 60_000,
      }),
    ).toContain('<string>/usr/local/bin/nowcoding</string>');
    expect(
      buildLaunchdPlist({
        binPath: '/usr/local/bin/nowcoding',
        homeDir: '/Users/peng',
        intervalMs: 30 * 60_000,
      }),
    ).toContain('<string>foreground</string>');
  });

  it('builds a systemd user unit for foreground daemon mode', () => {
    const unit = buildSystemdUnit({
      binPath: '/usr/local/bin/nowcoding',
      homeDir: '/home/peng',
      intervalMs: 30 * 60_000,
    });

    expect(unit).toContain('ExecStart=/usr/local/bin/nowcoding daemon foreground');
    expect(unit).toContain(`WorkingDirectory=${path.resolve('/home/peng')}`);
  });

  it('starts an installed launchd service', async () => {
    const execFile = vi.fn().mockResolvedValue(undefined);

    await controlDaemonService({
      action: 'start',
      platform: 'darwin',
      homeDir: '/Users/peng',
      uid: 501,
      exists: async () => true,
      execFile,
    });

    expect(execFile).toHaveBeenCalledWith('launchctl', [
      'bootstrap',
      'gui/501',
      '/Users/peng/Library/LaunchAgents/dev.nowcoding.cli.plist',
    ]);
    expect(execFile).toHaveBeenCalledWith('launchctl', [
      'kickstart',
      '-k',
      'gui/501/dev.nowcoding.cli',
    ]);
  });

  it('starts an installed systemd user service', async () => {
    const execFile = vi.fn().mockResolvedValue(undefined);

    await controlDaemonService({
      action: 'start',
      platform: 'linux',
      homeDir: '/home/peng',
      exists: async () => true,
      execFile,
    });

    expect(execFile).toHaveBeenCalledWith('systemctl', ['--user', 'daemon-reload']);
    expect(execFile).toHaveBeenCalledWith('systemctl', [
      '--user',
      'enable',
      '--now',
      'nowcoding.service',
    ]);
  });

  it('fails service control when daemon is not installed', async () => {
    await expect(
      controlDaemonService({
        action: 'start',
        platform: 'linux',
        homeDir: '/home/peng',
        exists: async () => false,
        execFile: vi.fn(),
      }),
    ).rejects.toThrow('not installed');
  });

  it('uninstalls a systemd user service and removes the unit file', async () => {
    const execFile = vi.fn().mockResolvedValue(undefined);
    const rm = vi.fn().mockResolvedValue(undefined);

    await controlDaemonService({
      action: 'uninstall',
      platform: 'linux',
      homeDir: '/home/peng',
      exists: async () => true,
      execFile,
      rm,
    });

    expect(execFile).toHaveBeenCalledWith('systemctl', [
      '--user',
      'disable',
      '--now',
      'nowcoding.service',
    ]);
    expect(rm).toHaveBeenCalledWith('/home/peng/.config/systemd/user/nowcoding.service', {
      force: true,
    });
  });

  it('restarts launchd by stopping and starting the service', async () => {
    const execFile = vi.fn().mockResolvedValue(undefined);

    await controlDaemonService({
      action: 'restart',
      platform: 'darwin',
      homeDir: '/Users/peng',
      uid: 501,
      exists: async () => true,
      execFile,
    });

    expect(execFile.mock.calls.map((call) => call[0])).toEqual([
      'launchctl',
      'launchctl',
      'launchctl',
    ]);
    expect(execFile.mock.calls[0]?.[1]).toEqual([
      'bootout',
      'gui/501',
      '/Users/peng/Library/LaunchAgents/dev.nowcoding.cli.plist',
    ]);
    expect(execFile.mock.calls[1]?.[1]).toEqual([
      'bootstrap',
      'gui/501',
      '/Users/peng/Library/LaunchAgents/dev.nowcoding.cli.plist',
    ]);
  });
});
