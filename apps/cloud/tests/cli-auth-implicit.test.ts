import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createGitHubOAuthState, hashSecret } from '../../../packages/cloud-core/src/auth';

const insertValues = vi.fn();
const joinArenaForUser = vi.fn();
const defaultDb = {
  insert: vi.fn(() => ({
    values: insertValues,
  })),
};
const getDb = vi.fn(() => ({
  insert: defaultDb.insert,
}));

vi.mock('@nowcoding/cloud-db', () => ({
  accountSecurityEvents: {
    deviceId: 'accountSecurityEvents.deviceId',
    eventType: 'accountSecurityEvents.eventType',
    ipHash: 'accountSecurityEvents.ipHash',
    metadata: 'accountSecurityEvents.metadata',
    userId: 'accountSecurityEvents.userId',
  },
  cliAuthFlows: {
    claimedAt: 'cliAuthFlows.claimedAt',
    completedAt: 'cliAuthFlows.completedAt',
    deviceId: 'cliAuthFlows.deviceId',
    deviceName: 'cliAuthFlows.deviceName',
    deviceToken: 'cliAuthFlows.deviceToken',
    expiresAt: 'cliAuthFlows.expiresAt',
    joinArena: 'cliAuthFlows.joinArena',
    pollTokenHash: 'cliAuthFlows.pollTokenHash',
    statusExpiresAt: 'cliAuthFlows.statusExpiresAt',
    statusNonceHash: 'cliAuthFlows.statusNonceHash',
    userCodeHash: 'cliAuthFlows.userCodeHash',
    userId: 'cliAuthFlows.userId',
  },
  devices: {
    id: 'devices.id',
    name: 'devices.name',
    tokenHash: 'devices.tokenHash',
    userId: 'devices.userId',
  },
  getDb,
  users: {
    avatarUrl: 'users.avatarUrl',
    displayName: 'users.displayName',
    id: 'users.id',
    username: 'users.username',
  },
}));

const exchangeGitHubCode = vi.fn();
const fetchGitHubUser = vi.fn();

vi.mock('@nowcoding/cloud-core', async () => {
  const actual =
    await vi.importActual<typeof import('@nowcoding/cloud-core')>('@nowcoding/cloud-core');

  return {
    ...actual,
    exchangeGitHubCode,
    fetchGitHubUser,
  };
});

vi.mock('../lib/arena-consent', () => ({
  joinArenaForUser,
}));

const completeCliAuthFlowByToken = vi.fn();
const reserveGitHubUser = vi.fn();

vi.mock('../app/api/auth/_shared', async () => {
  const actual =
    await vi.importActual<typeof import('../app/api/auth/_shared')>('../app/api/auth/_shared');

  return {
    ...actual,
    completeCliAuthFlowByToken,
    reserveGitHubUser,
  };
});

describe('implicit CLI auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOWCODING_CLOUD_URL = 'https://nowcoding.cc';
    process.env.GITHUB_CLIENT_ID = 'github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.GITHUB_OAUTH_STATE_SECRET = 'test-state-secret';

    insertValues.mockResolvedValue(undefined);
    getDb.mockImplementation(() => ({
      insert: defaultDb.insert,
    }));
    exchangeGitHubCode.mockResolvedValue('github-access-token');
    fetchGitHubUser.mockResolvedValue({
      id: 123,
      login: 'peng',
      name: 'Peng',
      avatar_url: 'https://example.com/avatar.png',
    });
    reserveGitHubUser.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
    });
    completeCliAuthFlowByToken.mockResolvedValue(true);
    joinArenaForUser.mockResolvedValue(undefined);
  });

  test('CLI start returns a GitHub verification URL backed by a hidden flow token', async () => {
    const { POST } = await import('../app/api/auth/cli/start/route');
    const response = await POST(
      new Request('https://nowcoding.cc/api/auth/cli/start', {
        method: 'POST',
        body: JSON.stringify({ deviceName: 'Peng MacBook', joinArena: false }),
      }) as NextRequest,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      verificationUrl: string;
      pollToken: string;
      userCode?: string;
      expiresAt: string;
    };

    expect(body.pollToken).toMatch(/^nc_poll_/);
    expect(body.userCode).toBeUndefined();

    const verificationUrl = new URL(body.verificationUrl);
    expect(verificationUrl.origin).toBe('https://nowcoding.cc');
    expect(verificationUrl.pathname).toBe('/api/auth/github/start');

    const returnTo = verificationUrl.searchParams.get('returnTo');
    expect(returnTo).toMatch(/^\/login\/device\?flow=nc_flow_/);

    const flowToken = new URL(returnTo ?? '', 'https://nowcoding.cc').searchParams.get('flow');
    expect(flowToken).toMatch(/^nc_flow_[A-Za-z0-9_-]{43}$/);
    await expect(hashSecret(flowToken ?? '')).resolves.toBe(
      insertValues.mock.calls[0]?.[0].userCodeHash,
    );
    expect(insertValues.mock.calls[0]?.[0].joinArena).toBe(false);
  });

  test('GitHub callback completes a valid CLI flow token and redirects confirmed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T00:00:00.000Z'));

    try {
      const { GET } = await import('../app/api/auth/github/callback/route');
      const { BROWSER_SESSION_MAX_AGE_SECONDS, verifyBrowserIdentity } = await import(
        '../lib/browser-session'
      );
      const flowToken = 'nc_flow_abc123';
      const state = createGitHubOAuthState(
        `/login/device?flow=${encodeURIComponent(flowToken)}`,
        'test-state-secret',
      );
      const request = new NextRequest(
        `https://nowcoding.cc/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(
          state,
        )}`,
        {
          headers: {
            cookie: `nc_github_oauth_state=${state}`,
          },
        },
      );

      const response = await GET(request);

      expect(exchangeGitHubCode).toHaveBeenCalledWith(
        'oauth-code',
        'https://nowcoding.cc/api/auth/github/callback',
      );
      expect(reserveGitHubUser).toHaveBeenCalledWith(expect.anything(), {
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
        expiresAt: expect.any(Number),
      });
      expect(completeCliAuthFlowByToken).toHaveBeenCalledWith(
        expect.anything(),
        flowToken,
        { id: '00000000-0000-0000-0000-000000000001' },
        { statusNonce: expect.stringMatching(/^nc_status_/) },
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://nowcoding.cc/login/device?status=confirmed',
      );
      const setCookie = response.headers.get('set-cookie') ?? '';
      const identityCookie = setCookie.match(/(?:^|,\s*)nc_github_identity=([^;]+)/)?.[1];
      expect(setCookie).toContain('nc_github_identity=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=lax');
      expect(setCookie).toContain('nc_cli_status=');
      const statusCookie = setCookie.match(/(?:^|,\s*)nc_cli_status=([^;]+)/)?.[1];
      expect(statusCookie).toMatch(/^nc_status_/);
      expect(statusCookie).not.toBe('pending');
      expect(statusCookie).toBe(completeCliAuthFlowByToken.mock.calls[0]?.[3]?.statusNonce);
      expect(setCookie).not.toContain('nc_dev_');
      expect(identityCookie).toBeDefined();
      expect(verifyBrowserIdentity(identityCookie)).toEqual({
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
        expiresAt: Date.now() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('GitHub callback signs in the browser for normal OAuth returnTo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T00:00:00.000Z'));

    try {
      const { GET } = await import('../app/api/auth/github/callback/route');
      const { BROWSER_SESSION_MAX_AGE_SECONDS, verifyBrowserIdentity } = await import(
        '../lib/browser-session'
      );
      const state = createGitHubOAuthState('/account/settings', 'test-state-secret');
      const request = new NextRequest(
        `https://nowcoding.cc/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(
          state,
        )}`,
        {
          headers: {
            cookie: `nc_github_oauth_state=${state}`,
          },
        },
      );

      const response = await GET(request);
      const setCookie = response.headers.get('set-cookie') ?? '';
      const identityCookie = setCookie.match(/(?:^|,\s*)nc_github_identity=([^;]+)/)?.[1];

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://nowcoding.cc/account/settings');
      expect(setCookie).toContain('nc_github_identity=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toMatch(/SameSite=lax/i);
      expect(setCookie).not.toContain('nc_cli_status=');
      expect(setCookie).not.toContain('nc_dev_');
      expect(identityCookie).toBeDefined();
      expect(verifyBrowserIdentity(identityCookie)).toEqual({
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
        expiresAt: Date.now() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('GitHub callback never returns a device token to the browser', async () => {
    const { GET } = await import('../app/api/auth/github/callback/route');
    const state = createGitHubOAuthState(
      '/login/device?flow=nc_flow_browser_boundary',
      'test-state-secret',
    );
    const request = new NextRequest(
      `https://nowcoding.cc/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(
        state,
      )}`,
      {
        headers: {
          cookie: `nc_github_oauth_state=${state}`,
        },
      },
    );

    const response = await GET(request);
    const body = await response.text();
    const headers = Array.from(response.headers.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    expect(body).not.toContain('nc_dev_');
    expect(headers).not.toContain('nc_dev_');
  });

  test('GitHub callback redirects invalid when a CLI flow token cannot be completed', async () => {
    completeCliAuthFlowByToken.mockResolvedValue(false);

    const { GET } = await import('../app/api/auth/github/callback/route');
    const state = createGitHubOAuthState('/login/device?flow=nc_flow_missing', 'test-state-secret');
    const request = new NextRequest(
      `https://nowcoding.cc/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(
        state,
      )}`,
      {
        headers: {
          cookie: `nc_github_oauth_state=${state}; nc_cli_status=nc_status_old`,
        },
      },
    );

    const response = await GET(request);

    expect(completeCliAuthFlowByToken).toHaveBeenCalledWith(
      expect.anything(),
      'nc_flow_missing',
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000001',
      }),
      { statusNonce: expect.stringMatching(/^nc_status_/) },
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://nowcoding.cc/login/device?status=invalid',
    );
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('nc_cli_status=;');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).not.toContain('nc_github_identity=');
  });

  test('device tokens are minted from the CLI-held poll token, not the browser callback', async () => {
    const [callbackSource, pollSource] = await Promise.all([
      import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../app/api/auth/github/callback/route.ts', import.meta.url), 'utf8'),
      ),
      import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../app/api/auth/cli/poll/route.ts', import.meta.url), 'utf8'),
      ),
    ]);

    expect(callbackSource).not.toContain('createDeviceToken');
    expect(pollSource).toContain('createDeviceToken');
  });

  test('CLI status endpoint does not accept raw poll tokens', async () => {
    const { GET } = await import('../app/api/auth/cli/status/route');
    const request = new NextRequest('https://nowcoding.cc/api/auth/cli/status', {
      headers: {
        cookie: 'nc_cli_status=nc_poll_should_not_work',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  test('poll route keeps non-secret status and does not delete the flow immediately', async () => {
    const pollSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../app/api/auth/cli/poll/route.ts', import.meta.url), 'utf8'),
    );

    expect(pollSource).toContain('claimedAt');
    expect(pollSource).not.toContain('.delete(cliAuthFlows)');
  });

  test('device confirmation page presents device-added success', async () => {
    const [pageSource, clientSource] = await Promise.all([
      import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../app/login/device/page.tsx', import.meta.url), 'utf8'),
      ),
      import('node:fs/promises').then((fs) =>
        fs.readFile(
          new URL('../app/login/device/device-status-client.tsx', import.meta.url),
          'utf8',
        ),
      ),
    ]);

    expect(pageSource).toMatch(/t\(['"]deviceAdded['"]\)/);
    expect(clientSource).toContain('Device token saved by the CLI');
    expect(clientSource).toContain(
      'Device details unavailable. Check your terminal or run nowcoding login again.',
    );
    expect(pageSource).toContain('/account/devices');
    for (const secretPattern of ['nc_dev_', 'pollToken', 'flowToken', 'tokenHash']) {
      expect(clientSource).not.toContain(secretPattern);
    }
  });

  test('poll route marks a newly claimed device as confirmed', async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        pollTokenHash: 'poll-hash',
        userId: 'user-1',
        deviceId: null,
        deviceToken: null,
        deviceName: 'Peng MacBook',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        claimedAt: null,
        joinArena: true,
      },
    ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi
      .fn()
      .mockImplementationOnce(() => ({ from }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ username: 'peng' }]),
          })),
        })),
      }));
    const insertDeviceValues = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 'device-1' }]),
    }));
    const tx = {
      insert: vi.fn(() => ({
        values: insertDeviceValues,
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                deviceToken: 'nc_dev_test',
                deviceId: 'device-1',
                userId: 'user-1',
                joinArena: true,
              },
            ]),
          })),
        })),
      })),
    };
    const db = {
      select,
      transaction: vi.fn(async (callback) => callback(tx)),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    };
    getDb.mockReturnValueOnce(db as never);

    const { POST } = await import('../app/api/auth/cli/poll/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/auth/cli/poll', {
        method: 'POST',
        body: JSON.stringify({ pollToken: 'nc_poll_success' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(insertDeviceValues).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  test('poll route persists Arena consent when a claimed flow requested Arena', async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        pollTokenHash: 'poll-hash',
        userId: 'user-1',
        deviceId: null,
        deviceToken: null,
        deviceName: 'Peng MacBook',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        claimedAt: null,
        joinArena: true,
      },
    ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi
      .fn()
      .mockImplementationOnce(() => ({ from }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ username: 'peng' }]),
          })),
        })),
      }));
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'device-1' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                deviceToken: 'nc_dev_test',
                deviceId: 'device-1',
                userId: 'user-1',
                joinArena: true,
              },
            ]),
          })),
        })),
      })),
    };
    const db = {
      select,
      transaction: vi.fn(async (callback) => callback(tx)),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    };
    getDb.mockReturnValueOnce(db as never);

    const { POST } = await import('../app/api/auth/cli/poll/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/auth/cli/poll', {
        method: 'POST',
        body: JSON.stringify({ pollToken: 'nc_poll_success' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(joinArenaForUser).toHaveBeenCalledWith(tx, 'user-1');
  });

  test('poll route does not clear a new device token when Arena consent fails', async () => {
    joinArenaForUser.mockRejectedValueOnce(new Error('consent failed'));
    const limit = vi.fn().mockResolvedValue([
      {
        pollTokenHash: 'poll-hash',
        userId: 'user-1',
        deviceId: null,
        deviceToken: null,
        deviceName: 'Peng MacBook',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        claimedAt: null,
        joinArena: true,
      },
    ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'device-1' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                deviceToken: 'nc_dev_test',
                deviceId: 'device-1',
                userId: 'user-1',
                joinArena: true,
              },
            ]),
          })),
        })),
      })),
    };
    const db = {
      select,
      transaction: vi.fn(async (callback) => callback(tx)),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    };
    getDb.mockReturnValueOnce(db as never);

    const { POST } = await import('../app/api/auth/cli/poll/route');
    await expect(
      POST(
        new NextRequest('https://nowcoding.cc/api/auth/cli/poll', {
          method: 'POST',
          body: JSON.stringify({ pollToken: 'nc_poll_success' }),
        }),
      ),
    ).rejects.toThrow('consent failed');

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(joinArenaForUser).toHaveBeenCalledWith(tx, 'user-1');
    expect(db.update).not.toHaveBeenCalled();
  });

  test('poll route rolls back device creation when a concurrent claim wins', async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        pollTokenHash: 'poll-hash',
        userId: 'user-1',
        deviceId: null,
        deviceToken: null,
        deviceName: 'Peng MacBook',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        claimedAt: null,
        joinArena: true,
      },
    ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'orphan-device' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    };
    const transaction = vi.fn(async (callback) => callback(tx));
    const db = {
      select,
      transaction,
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'orphan-device' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    };
    getDb.mockReturnValueOnce(db as never);

    const { POST } = await import('../app/api/auth/cli/poll/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/auth/cli/poll', {
        method: 'POST',
        body: JSON.stringify({ pollToken: 'nc_poll_race' }),
      }),
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'device_token_unavailable',
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  test('CLI status endpoint returns only non-secret account and device status', async () => {
    const chainRows = (rows: unknown[]) => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(rows),
        })),
      })),
    });
    const select = vi
      .fn()
      .mockImplementationOnce(() =>
        chainRows([
          {
            userId: 'user-1',
            deviceId: 'device-1',
            deviceName: 'Peng MacBook',
            joinArena: true,
            claimedAt: new Date('2026-05-19T00:01:00.000Z'),
            pollTokenHash: 'pollTokenHash-secret',
            userCodeHash: 'userCodeHash-secret',
            statusNonceHash: 'statusNonceHash-secret',
            deviceToken: 'nc_dev_should_not_leak',
          },
        ]),
      )
      .mockImplementationOnce(() =>
        chainRows([
          {
            username: 'peng',
            displayName: 'Peng',
            avatarUrl: 'https://example.com/avatar.png',
          },
        ]),
      )
      .mockImplementationOnce(() =>
        chainRows([
          {
            name: 'Peng MacBook',
          },
        ]),
      );
    getDb.mockReturnValueOnce({ select } as never);

    const { GET } = await import('../app/api/auth/cli/status/route');
    const response = await GET(
      new NextRequest('https://nowcoding.cc/api/auth/cli/status', {
        headers: {
          cookie: 'nc_cli_status=nc_status_browser_nonce',
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      status: 'claimed',
      account: {
        username: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
      },
      device: {
        id: 'device-1',
        name: 'Peng MacBook',
        claimed: true,
      },
      arenaJoined: true,
    });

    const responseText = JSON.stringify(body);
    for (const secret of [
      'pollTokenHash',
      'userCodeHash',
      'statusNonceHash',
      'deviceToken',
      'nc_poll_',
      'nc_flow_',
      'nc_dev_',
    ]) {
      expect(responseText).not.toContain(secret);
    }
  });
});
