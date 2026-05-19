import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LoginDeps, runLogin } from '../src/commands/login';
import { main } from '../src/index';

const endpoint = 'https://cloud.example.com';
const returnedEndpoint = 'https://api.cloud.example.com';
const deviceToken = `nc_dev_${'A'.repeat(43)}`;

function defaultCompleteLoginDeps(overrides: LoginDeps = {}): LoginDeps {
  return {
    openBrowser: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    loadConfig: vi.fn().mockResolvedValue(null),
    sleep: vi.fn().mockResolvedValue(undefined),
    hostname: () => 'peng-mac',
    runSyncOnce: vi.fn().mockResolvedValue(undefined),
    isInteractive: () => false,
    reportSetupStatus: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('login command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts CLI auth without Arena by default and saves returned device config', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({
        verificationUrl: 'https://cloud.example.com/login/device?status=connected',
        pollToken: 'poll_123',
      })
      .mockResolvedValueOnce({
        status: 'complete',
        endpoint: returnedEndpoint,
        deviceToken,
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: false,
      });
    const saveConfig = vi.fn().mockResolvedValue(undefined);
    const runSyncOnce = vi.fn().mockResolvedValue(undefined);

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson,
        saveConfig,
        runSyncOnce,
      }),
    );

    expect(fetchJson).toHaveBeenNthCalledWith(1, `${endpoint}/api/auth/cli/start`, {
      method: 'POST',
      body: {
        deviceName: 'peng-mac',
        joinArena: false,
      },
    });
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'cloud',
        endpoint: returnedEndpoint,
        apiToken: deviceToken,
        cloud: {
          username: 'peng',
          deviceId: 'dev_123',
          arenaJoined: false,
        },
      }),
    );
    expect(runSyncOnce).toHaveBeenCalledWith({ watch: false });
  });

  it('opens the initial OAuth URL and logs the login result', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({
        verificationUrl: 'https://cloud.example.com/login/device?status=connected',
        pollToken: 'poll_123',
      })
      .mockResolvedValueOnce({
        status: 'complete',
        endpoint: returnedEndpoint,
        deviceToken,
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: false,
      });
    const openBrowser = vi.fn().mockResolvedValue(undefined);

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson,
        openBrowser,
      }),
    );

    expect(openBrowser).toHaveBeenNthCalledWith(
      1,
      'https://cloud.example.com/login/device?status=connected',
    );
    expect(log).toHaveBeenCalledWith(
      'Open this URL to finish login: https://cloud.example.com/login/device?status=connected',
    );
    expect(log).toHaveBeenCalledWith(
      'Finish login in your browser. The CLI will continue automatically.',
    );
    expect(log).toHaveBeenCalledWith('Logged in to NowCoding Cloud as peng.');
  });

  it('starts CLI auth with Arena enabled when requested', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({
        verificationUrl: 'https://cloud.example.com/login/device',
        pollToken: 'poll_123',
        userCode: 'NC-ABCD-2345',
      })
      .mockResolvedValueOnce({
        status: 'complete',
        deviceToken,
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: false,
      });

    await runLogin(
      { endpoint, arena: true },
      defaultCompleteLoginDeps({
        fetchJson,
      }),
    );

    expect(fetchJson).toHaveBeenNthCalledWith(1, `${endpoint}/api/auth/cli/start`, {
      method: 'POST',
      body: {
        deviceName: 'peng-mac',
        joinArena: true,
      },
    });
  });

  it('rejects immediately when start response omits pollToken', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const openBrowser = vi.fn().mockResolvedValue(undefined);
    const fetchJson = vi.fn().mockResolvedValueOnce({
      verificationUrl: 'https://cloud.example.com/login/device',
    });

    await expect(
      runLogin(
        { endpoint },
        defaultCompleteLoginDeps({
          fetchJson,
          openBrowser,
        }),
      ),
    ).rejects.toThrow('Login start response did not include a poll token.');

    expect(openBrowser).not.toHaveBeenCalled();
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('continues login when start response omits userCode', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const openBrowser = vi.fn().mockResolvedValue(undefined);
    const saveConfig = vi.fn().mockResolvedValue(undefined);
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({
        verificationUrl: 'https://cloud.example.com/login/device',
        pollToken: 'poll_123',
      })
      .mockResolvedValueOnce({
        status: 'complete',
        deviceToken,
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: false,
      });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson,
        openBrowser,
        saveConfig,
      }),
    );

    expect(openBrowser).toHaveBeenNthCalledWith(1, 'https://cloud.example.com/login/device');
    expect(log).toHaveBeenCalledWith(
      'Finish login in your browser. The CLI will continue automatically.',
    );
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Fallback device code:'));
    expect(saveConfig).toHaveBeenCalled();
  });

  it('prints verification URL and keeps polling when opening the browser fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({
        verificationUrl: 'https://cloud.example.com/login/device',
        pollToken: 'poll_123',
        userCode: 'NC-ABCD-2345',
      })
      .mockResolvedValueOnce({
        status: 'complete',
        deviceToken,
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: false,
      });
    const saveConfig = vi.fn().mockResolvedValue(undefined);

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson,
        openBrowser: vi.fn().mockRejectedValue(new Error('no opener')),
        saveConfig,
      }),
    );

    expect(log).toHaveBeenCalledWith(
      'Open this URL to finish login: https://cloud.example.com/login/device',
    );
    expect(log).toHaveBeenCalledWith(
      'Finish login in your browser. The CLI will continue automatically.',
    );
    expect(log).toHaveBeenCalledWith('Fallback device code: NC-ABCD-2345');
    expect(warn).toHaveBeenCalledWith(
      '[nowcoding] Could not open browser automatically. Use the printed URL to continue.',
    );
    expect(saveConfig).toHaveBeenCalled();
  });

  it('continues through setup when first sync fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runSyncOnce = vi.fn().mockRejectedValue(new Error('sync failed'));
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        runSyncOnce,
        reportSetupStatus,
      }),
    );

    expect(warn).toHaveBeenCalledWith(
      '[nowcoding] First sync failed. Login is still complete; run `nowcoding sync` to retry.',
    );
    expect(log).toHaveBeenCalledWith('Syncing recent usage...');
    const syncingLogCallIndex = log.mock.calls.findIndex(
      ([message]) => message === 'Syncing recent usage...',
    );
    expect(log.mock.invocationCallOrder[syncingLogCallIndex]).toBeLessThan(
      runSyncOnce.mock.invocationCallOrder[0],
    );
    expect(runSyncOnce).toHaveBeenCalledWith({ watch: false });
    expect(reportSetupStatus).toHaveBeenCalled();
  });

  it('interactive yes installs and starts daemon, reports enabled, and opens onboarding last', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const openBrowser = vi.fn().mockResolvedValue(undefined);
    const askYesNo = vi.fn().mockResolvedValue(true);
    const runDaemon = vi.fn().mockResolvedValue(undefined);
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        openBrowser,
        askYesNo,
        runDaemon,
        isInteractive: () => true,
        reportSetupStatus,
      }),
    );

    expect(askYesNo).toHaveBeenCalledWith('Enable automatic background sync?', false);
    expect(log).toHaveBeenCalledWith('Installing background sync...');
    expect(runDaemon).toHaveBeenNthCalledWith(1, { action: 'install' });
    expect(runDaemon).toHaveBeenNthCalledWith(2, { action: 'start' });
    expect(log).toHaveBeenCalledWith('✓ Background sync enabled');
    expect(reportSetupStatus).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: returnedEndpoint }),
      expect.objectContaining({
        automaticSyncEnabled: true,
        source: 'login',
        reportedAt: expect.any(String),
      }),
    );
    expect(reportSetupStatus.mock.calls[0]?.[1]).not.toHaveProperty('skippedReason');
    expect(openBrowser).toHaveBeenLastCalledWith(`${returnedEndpoint}/onboarding?source=cli-login`);
  });

  it('interactive yes restarts daemon when start fails and reports enabled', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const runDaemon = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('already loaded'))
      .mockResolvedValueOnce(undefined);
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        askYesNo: vi.fn().mockResolvedValue(true),
        runDaemon,
        isInteractive: () => true,
        reportSetupStatus,
      }),
    );

    expect(runDaemon).toHaveBeenNthCalledWith(1, { action: 'install' });
    expect(runDaemon).toHaveBeenNthCalledWith(2, { action: 'start' });
    expect(runDaemon).toHaveBeenNthCalledWith(3, { action: 'restart' });
    expect(reportSetupStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        automaticSyncEnabled: true,
        source: 'login',
      }),
    );
    expect(reportSetupStatus.mock.calls[0]?.[1]).not.toHaveProperty('skippedReason');
  });

  it('interactive no skips daemon and reports user_skipped', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const runDaemon = vi.fn().mockResolvedValue(undefined);
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        askYesNo: vi.fn().mockResolvedValue(false),
        runDaemon,
        isInteractive: () => true,
        reportSetupStatus,
      }),
    );

    expect(runDaemon).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Skipped background sync. You can enable it later with:');
    expect(log).toHaveBeenCalledWith('nowcoding daemon install && nowcoding daemon start');
    expect(reportSetupStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        automaticSyncEnabled: false,
        source: 'login',
        skippedReason: 'user_skipped',
      }),
    );
  });

  it('non-interactive login does not prompt or install and reports non_interactive', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const askYesNo = vi.fn().mockResolvedValue(true);
    const runDaemon = vi.fn().mockResolvedValue(undefined);
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        askYesNo,
        runDaemon,
        isInteractive: () => false,
        reportSetupStatus,
      }),
    );

    expect(askYesNo).not.toHaveBeenCalled();
    expect(runDaemon).not.toHaveBeenCalled();
    expect(reportSetupStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        automaticSyncEnabled: false,
        source: 'login',
        skippedReason: 'non_interactive',
      }),
    );
  });

  it('daemon failure does not reject after start and restart fail and reports install_failed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runDaemon = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('start failed'))
      .mockRejectedValueOnce(new Error('restart failed'));
    const reportSetupStatus = vi.fn().mockResolvedValue({ ok: true });

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        askYesNo: vi.fn().mockResolvedValue(true),
        runDaemon,
        isInteractive: () => true,
        reportSetupStatus,
      }),
    );

    expect(runDaemon).toHaveBeenNthCalledWith(1, { action: 'install' });
    expect(runDaemon).toHaveBeenNthCalledWith(2, { action: 'start' });
    expect(runDaemon).toHaveBeenNthCalledWith(3, { action: 'restart' });
    expect(warn).toHaveBeenCalledWith(
      '[nowcoding] Automatic background sync was not enabled. Run `nowcoding daemon install` and `nowcoding daemon start` to retry.',
    );
    expect(reportSetupStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        automaticSyncEnabled: false,
        source: 'login',
        skippedReason: 'install_failed',
      }),
    );
  });

  it('continues when setup status reporting fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const openBrowser = vi.fn().mockResolvedValue(undefined);

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        openBrowser,
        reportSetupStatus: vi.fn().mockRejectedValue(new Error('report failed')),
      }),
    );

    expect(warn).toHaveBeenCalledWith('[nowcoding] Could not update onboarding sync status.');
    expect(openBrowser).toHaveBeenLastCalledWith(`${returnedEndpoint}/onboarding?source=cli-login`);
  });

  it('prints onboarding URL when final browser open fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const openBrowser = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blocked'));
    const onboardingUrl = `${returnedEndpoint}/onboarding?source=cli-login`;

    await runLogin(
      { endpoint },
      defaultCompleteLoginDeps({
        fetchJson: vi
          .fn()
          .mockResolvedValueOnce({
            verificationUrl: 'https://cloud.example.com/login/device',
            pollToken: 'poll_123',
          })
          .mockResolvedValueOnce({
            status: 'complete',
            endpoint: returnedEndpoint,
            deviceToken,
            username: 'peng',
            deviceId: 'dev_123',
            arenaJoined: false,
          }),
        openBrowser,
      }),
    );

    expect(openBrowser).toHaveBeenNthCalledWith(1, 'https://cloud.example.com/login/device');
    expect(openBrowser).toHaveBeenNthCalledWith(2, onboardingUrl);
    expect(log).toHaveBeenCalledWith(`Open onboarding: ${onboardingUrl}`);
  });

  it('routes --arena through main', async () => {
    const login = await import('../src/commands/login');
    const runLoginSpy = vi.spyOn(login, 'runLogin').mockResolvedValue(undefined);

    await main(['login', '--arena']);

    expect(runLoginSpy).toHaveBeenCalledWith({ arena: true });
  });
});
