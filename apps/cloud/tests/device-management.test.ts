import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getCurrentBrowserUserFromCookie = vi.fn();
  const ipHashFromHeaders = vi.fn(async () => 'ip-hash');
  const writeAccountSecurityEvent = vi.fn();

  return {
    db: {
      select: vi.fn(),
      transaction: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    },
    tx: {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    },
    getCurrentBrowserUserFromCookie,
    ipHashFromHeaders,
    writeAccountSecurityEvent,
  };
});

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ conditions, op: 'and' }),
  desc: (column: unknown) => ({ column, op: 'desc' }),
  eq: (left: unknown, right: unknown) => ({ left, op: 'eq', right }),
  isNull: (column: unknown) => ({ column, op: 'isNull' }),
}));

vi.mock('../lib/browser-session', () => ({
  GITHUB_IDENTITY_COOKIE: 'nc_github_identity',
  browserSessionCookieOptions: () => ({
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    secure: true,
  }),
  getCurrentBrowserUserFromCookie: mocks.getCurrentBrowserUserFromCookie,
}));

vi.mock('../lib/security-events', () => ({
  ipHashFromHeaders: mocks.ipHashFromHeaders,
  writeAccountSecurityEvent: mocks.writeAccountSecurityEvent,
}));

vi.mock('../app/api/auth/_shared', () => ({
  CLI_STATUS_COOKIE: 'nc_cli_status',
}));

vi.mock('@nowcoding/cloud-db', () => ({
  accountSecurityEvents: {
    createdAt: 'accountSecurityEvents.createdAt',
    deviceId: 'accountSecurityEvents.deviceId',
    eventType: 'accountSecurityEvents.eventType',
    id: 'accountSecurityEvents.id',
    ipHash: 'accountSecurityEvents.ipHash',
    metadata: 'accountSecurityEvents.metadata',
    userId: 'accountSecurityEvents.userId',
  },
  devices: {
    cliVersion: 'devices.cliVersion',
    confirmedAt: 'devices.confirmedAt',
    createdAt: 'devices.createdAt',
    hostname: 'devices.hostname',
    id: 'devices.id',
    lastSeenAt: 'devices.lastSeenAt',
    name: 'devices.name',
    platform: 'devices.platform',
    revokedAt: 'devices.revokedAt',
    revokedReason: 'devices.revokedReason',
    tokenHash: 'devices.tokenHash',
    updatedAt: 'devices.updatedAt',
    userId: 'devices.userId',
  },
  getDb: () => mocks.db,
}));

function signedInRequest(
  url: string,
  init: Pick<RequestInit, 'body' | 'headers' | 'method'> = {},
): NextRequest {
  const headers = new Headers(init.headers);
  headers.set('cookie', headers.get('cookie') ?? 'nc_github_identity=session');
  const requestInit: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = { headers };

  if (init.body !== undefined) {
    requestInit.body = init.body;
  }
  if (init.method !== undefined) {
    requestInit.method = init.method;
  }

  return new NextRequest(url, requestInit);
}

function crossOriginRequest(url: string, init: RequestInit = {}): NextRequest {
  return signedInRequest(url, {
    ...init,
    headers: {
      origin: 'https://evil.example',
      ...init.headers,
    },
  });
}

function expectUserScopedWhere(whereArg: unknown, deviceId?: string): void {
  expect(whereArg).toMatchObject({
    conditions: expect.arrayContaining([{ left: 'devices.userId', op: 'eq', right: 'user-1' }]),
    op: 'and',
  });

  if (deviceId) {
    expect(whereArg).toMatchObject({
      conditions: expect.arrayContaining([{ left: 'devices.id', op: 'eq', right: deviceId }]),
      op: 'and',
    });
  }
}

function expectActiveDeviceWhere(whereArg: unknown): void {
  expect(whereArg).toMatchObject({
    conditions: expect.arrayContaining([{ column: 'devices.revokedAt', op: 'isNull' }]),
    op: 'and',
  });
}

function expectSecurityEventsUserScopedWhere(whereArg: unknown): void {
  expect(whereArg).toMatchObject({
    conditions: expect.arrayContaining([
      { left: 'accountSecurityEvents.userId', op: 'eq', right: 'user-1' },
    ]),
    op: 'and',
  });
}

describe('account device APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValue({
      identity: { githubLogin: 'peng' },
      user: { githubLogin: 'peng', id: 'user-1', username: 'peng' },
    });
  });

  test('session returns the signed-in user', async () => {
    const { GET } = await import('../app/api/account/session/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/session'));

    expect(mocks.getCurrentBrowserUserFromCookie).toHaveBeenCalledWith('session');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: 'user-1', username: 'peng' },
    });
  });

  test('session returns unauthorized without a signed-in user', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { GET } = await import('../app/api/account/session/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/session'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  test('sign-out clears browser session without revoking devices', async () => {
    const { POST } = await import('../app/api/auth/sign-out/route');
    const response = await POST(
      signedInRequest('https://nowcoding.cc/api/auth/sign-out', {
        method: 'POST',
      }),
    );

    expect(mocks.getCurrentBrowserUserFromCookie).toHaveBeenCalledWith('session');
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').toContain('nc_github_identity=;');
    expect(response.headers.get('set-cookie') ?? '').toContain('nc_cli_status=;');
    expect(response.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('sign-out clears browser cookies even when already signed out', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { POST } = await import('../app/api/auth/sign-out/route');
    const response = await POST(
      signedInRequest('https://nowcoding.cc/api/auth/sign-out', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').toContain('nc_github_identity=;');
    expect(response.headers.get('set-cookie') ?? '').toContain('nc_cli_status=;');
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('sign-out rejects cross-origin browser mutations', async () => {
    const { POST } = await import('../app/api/auth/sign-out/route');
    const response = await POST(
      crossOriginRequest('https://nowcoding.cc/api/auth/sign-out', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(mocks.getCurrentBrowserUserFromCookie).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('sign-out rejects same-site fetch metadata when origin is cross-origin', async () => {
    const { POST } = await import('../app/api/auth/sign-out/route');
    const response = await POST(
      crossOriginRequest('https://nowcoding.cc/api/auth/sign-out', {
        headers: { 'sec-fetch-site': 'same-site' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(mocks.getCurrentBrowserUserFromCookie).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test("device list returns only the signed-in user's device fields", async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        id: 'device-1',
        name: 'Peng MacBook',
        userId: 'user-1',
      },
    ]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    mocks.db.select.mockReturnValue({ from });

    const { GET } = await import('../app/api/account/devices/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/devices'));

    expect(response.status).toBe(200);
    expect(mocks.db.select).toHaveBeenCalledWith(
      expect.not.objectContaining({ tokenHash: expect.anything() }),
    );
    expectUserScopedWhere((where.mock.calls as unknown[][])[0]?.[0]);
    expectActiveDeviceWhere((where.mock.calls as unknown[][])[0]?.[0]);
    await expect(response.json()).resolves.toEqual({
      devices: [{ id: 'device-1', name: 'Peng MacBook', userId: 'user-1' }],
    });
  });

  test('device list returns unauthorized without a signed-in user', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { GET } = await import('../app/api/account/devices/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/devices'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  test("device revoke writes an audit event for the signed-in user's device", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: 'device-1',
        name: 'Peng MacBook',
        userId: 'user-1',
      },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    mocks.db.update.mockReturnValue({ set });
    mocks.tx.update.mockReturnValue({ set });

    const { POST } = await import('../app/api/account/devices/[id]/revoke/route');
    const response = await POST(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith({
      revokedAt: expect.any(Date),
      revokedReason: 'user_revoked',
      updatedAt: expect.any(Date),
    });
    expectUserScopedWhere((where.mock.calls as unknown[][])[0]?.[0], 'device-1');
    expectActiveDeviceWhere((where.mock.calls as unknown[][])[0]?.[0]);
    expect(mocks.writeAccountSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        eventType: 'device_revoked',
        ipHash: 'ip-hash',
        userId: 'user-1',
      }),
      mocks.tx,
    );
  });

  test('device revoke is idempotent for an already revoked user device', async () => {
    const updateReturning = vi.fn().mockResolvedValue([]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const selectLimit = vi.fn().mockResolvedValue([
      {
        id: 'device-1',
        name: 'Peng MacBook',
        userId: 'user-1',
        revokedAt: new Date('2026-05-19T00:00:00.000Z'),
      },
    ]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const from = vi.fn(() => ({ where: selectWhere }));
    mocks.tx.update.mockReturnValue({ set });
    mocks.tx.select.mockReturnValue({ from });

    const { POST } = await import('../app/api/account/devices/[id]/revoke/route');
    const response = await POST(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alreadyRevoked: true,
      device: {
        id: 'device-1',
        revokedAt: '2026-05-19T00:00:00.000Z',
      },
    });
    expectUserScopedWhere((selectWhere.mock.calls as unknown[][])[0]?.[0], 'device-1');
    expect(mocks.writeAccountSecurityEvent).not.toHaveBeenCalled();
  });

  test('device revoke rejects cross-origin browser mutations', async () => {
    const { POST } = await import('../app/api/account/devices/[id]/revoke/route');
    const response = await POST(
      crossOriginRequest('https://nowcoding.cc/api/account/devices/device-1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(mocks.getCurrentBrowserUserFromCookie).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  test('device revoke returns unauthorized without a signed-in user', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { POST } = await import('../app/api/account/devices/[id]/revoke/route');
    const response = await POST(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  test('security events do not expose ip hashes', async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-1',
        deviceId: 'device-1',
        eventType: 'device_revoked',
        metadata: {},
        ipHash: 'internal-ip-hash',
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    mocks.db.select.mockReturnValue({ from });

    const { GET } = await import('../app/api/account/security-events/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/security-events'));

    expect(response.status).toBe(200);
    expect(mocks.db.select).toHaveBeenCalledWith(
      expect.not.objectContaining({ ipHash: expect.anything() }),
    );
    expectSecurityEventsUserScopedWhere((where.mock.calls as unknown[][])[0]?.[0]);
    expect(orderBy).toHaveBeenCalledWith({
      column: 'accountSecurityEvents.createdAt',
      op: 'desc',
    });
    expect(limit).toHaveBeenCalledWith(50);
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          id: 'event-1',
          userId: 'user-1',
          deviceId: 'device-1',
          eventType: 'device_revoked',
          metadata: {},
          createdAt: '2026-05-19T00:00:00.000Z',
        },
      ],
    });
  });

  test('security events return unauthorized without a signed-in user', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { GET } = await import('../app/api/account/security-events/route');
    const response = await GET(signedInRequest('https://nowcoding.cc/api/account/security-events'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  test('device rename rejects blank names', async () => {
    const { PATCH } = await import('../app/api/account/devices/[id]/route');
    const response = await PATCH(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1', {
        body: JSON.stringify({ name: '   ' }),
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_device_name',
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('device rename updates only active devices', async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: 'device-1',
        name: 'Renamed MacBook',
        userId: 'user-1',
      },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    mocks.db.update.mockReturnValue({ set });
    mocks.tx.update.mockReturnValue({ set });

    const { PATCH } = await import('../app/api/account/devices/[id]/route');
    const response = await PATCH(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1', {
        body: JSON.stringify({ name: '  Renamed MacBook  ' }),
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith({
      name: 'Renamed MacBook',
      updatedAt: expect.any(Date),
    });
    expectUserScopedWhere((where.mock.calls as unknown[][])[0]?.[0], 'device-1');
    expectActiveDeviceWhere((where.mock.calls as unknown[][])[0]?.[0]);
    expect(mocks.writeAccountSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        eventType: 'device_renamed',
        ipHash: 'ip-hash',
        metadata: { name: 'Renamed MacBook' },
        userId: 'user-1',
      }),
      mocks.tx,
    );
  });

  test('device rename rejects cross-origin browser mutations', async () => {
    const { PATCH } = await import('../app/api/account/devices/[id]/route');
    const response = await PATCH(
      crossOriginRequest('https://nowcoding.cc/api/account/devices/device-1', {
        body: JSON.stringify({ name: 'Renamed MacBook' }),
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(mocks.getCurrentBrowserUserFromCookie).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  test('device rename returns unauthorized without a signed-in user', async () => {
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValueOnce(null);

    const { PATCH } = await import('../app/api/account/devices/[id]/route');
    const response = await PATCH(
      signedInRequest('https://nowcoding.cc/api/account/devices/device-1', {
        body: JSON.stringify({ name: 'Renamed MacBook' }),
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'device-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});

describe('account page source boundaries', () => {
  test('account settings page exists and does not render token data', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../app/account/settings/page.tsx', import.meta.url), 'utf8'),
    );

    expect(source).toContain('Account settings');
    expect(source).not.toContain('tokenHash');
    expect(source).not.toContain('rawToken');
  });

  test('account devices page exists and does not render token hashes', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../app/account/devices/page.tsx', import.meta.url), 'utf8'),
    );

    expect(source).toContain('Authorized devices');
    expect(source).toContain('isNull(devices.revokedAt)');
    expect(source).not.toContain('accountApiRequest');
    expect(source).not.toContain('fetch(new URL');
    expect(source).not.toContain('tokenHash');
    expect(source).not.toContain('x-forwarded-host');
    expect(source).not.toContain('.get("host")');
    expect(source).not.toContain('headers()');
  });
});
