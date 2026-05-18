import { afterEach, describe, expect, it, vi } from 'vitest';
import { runLogin } from '../src/commands/login';
import { main } from '../src/index';

const endpoint = 'https://cloud.example.com';
const returnedEndpoint = 'https://api.cloud.example.com';
const deviceToken = `nc_dev_${'A'.repeat(43)}`;

describe('login command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts CLI auth without Arena by default and saves returned device config', async () => {
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
    const saveConfig = vi.fn().mockResolvedValue(undefined);

    await runLogin(
      { endpoint },
      {
        fetchJson,
        openBrowser,
        saveConfig,
        loadConfig: vi.fn().mockResolvedValue(null),
        sleep: vi.fn().mockResolvedValue(undefined),
        hostname: () => 'peng-mac',
      },
    );

    expect(fetchJson).toHaveBeenNthCalledWith(1, `${endpoint}/api/auth/cli/start`, {
      method: 'POST',
      body: {
        deviceName: 'peng-mac',
        joinArena: false,
      },
    });
    expect(openBrowser).toHaveBeenCalledWith(
      'https://cloud.example.com/login/device?status=connected',
    );
    expect(log).toHaveBeenCalledWith(
      'Open this URL to finish login: https://cloud.example.com/login/device?status=connected',
    );
    expect(log).toHaveBeenCalledWith(
      'Finish login in your browser. The CLI will continue automatically.',
    );
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
      {
        fetchJson,
        openBrowser: vi.fn().mockResolvedValue(undefined),
        saveConfig: vi.fn().mockResolvedValue(undefined),
        loadConfig: vi.fn().mockResolvedValue(null),
        sleep: vi.fn().mockResolvedValue(undefined),
        hostname: () => 'peng-mac',
      },
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
        {
          fetchJson,
          openBrowser,
          saveConfig: vi.fn().mockResolvedValue(undefined),
          loadConfig: vi.fn().mockResolvedValue(null),
          sleep: vi.fn().mockResolvedValue(undefined),
          hostname: () => 'peng-mac',
        },
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
      {
        fetchJson,
        openBrowser,
        saveConfig,
        loadConfig: vi.fn().mockResolvedValue(null),
        sleep: vi.fn().mockResolvedValue(undefined),
        hostname: () => 'peng-mac',
      },
    );

    expect(openBrowser).toHaveBeenCalledWith('https://cloud.example.com/login/device');
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
      {
        fetchJson,
        openBrowser: vi.fn().mockRejectedValue(new Error('no opener')),
        saveConfig,
        loadConfig: vi.fn().mockResolvedValue(null),
        sleep: vi.fn().mockResolvedValue(undefined),
        hostname: () => 'peng-mac',
      },
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

  it('routes --arena through main', async () => {
    const login = await import('../src/commands/login');
    const runLoginSpy = vi.spyOn(login, 'runLogin').mockResolvedValue(undefined);

    await main(['login', '--arena']);

    expect(runLoginSpy).toHaveBeenCalledWith({ arena: true });
  });
});
