import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const authenticateDeviceRequest = vi.fn();

  return {
    authenticateDeviceRequest,
    db: {
      select: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ left, op: 'eq', right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    kind: 'sql',
    strings: Array.from(strings),
    values,
  }),
}));

vi.mock('@nowcoding/cloud-db', () => ({
  devices: {
    clientInfo: 'devices.clientInfo',
    id: 'devices.id',
    updatedAt: 'devices.updatedAt',
  },
  getDb: () => mocks.db,
}));

vi.mock('../lib/device-auth', () => ({
  authenticateDeviceRequest: mocks.authenticateDeviceRequest,
}));

function setupUpdateReturning() {
  const returning = vi.fn().mockResolvedValue([
    {
      updatedAt: new Date('2026-05-19T04:00:00.000Z'),
    },
  ]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  mocks.db.update.mockReturnValue({ set });

  return { returning, set, where };
}

describe('device setup status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateDeviceRequest.mockResolvedValue({
      id: 'device-1',
      userId: 'user-1',
    });
  });

  test('authenticates device bearer requests and stores automatic sync status atomically', async () => {
    const { set, where } = setupUpdateReturning();
    const { POST } = await import('../app/api/cloud/device/setup/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        headers: { authorization: 'Bearer nc_dev_status' },
        body: JSON.stringify({
          automaticSyncEnabled: true,
          source: 'daemon',
          skippedReason: null,
          reportedAt: '2026-05-19T03:30:00.000Z',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      updatedAt: '2026-05-19T04:00:00.000Z',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.authenticateDeviceRequest).toHaveBeenCalledWith('Bearer nc_dev_status');
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      clientInfo: expect.objectContaining({
        kind: 'sql',
        strings: expect.arrayContaining([expect.stringContaining('jsonb_set')]),
      }),
      updatedAt: expect.any(Date),
    });
    const [setPayload] = set.mock.calls[0] as unknown as [{ clientInfo: { values: unknown[] } }];
    expect(JSON.parse(setPayload.clientInfo.values.at(-1) as string)).toEqual({
      enabled: true,
      source: 'daemon',
      skippedReason: null,
      reportedAt: '2026-05-19T03:30:00.000Z',
    });
    expect(where).toHaveBeenCalledWith({
      left: 'devices.id',
      op: 'eq',
      right: 'device-1',
    });
  });

  test('rejects missing or invalid device authorization', async () => {
    mocks.authenticateDeviceRequest.mockResolvedValueOnce(null);

    const { POST } = await import('../app/api/cloud/device/setup/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        body: JSON.stringify({ automaticSyncEnabled: true }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('rejects null or non-object JSON payloads as invalid payloads', async () => {
    const { POST } = await import('../app/api/cloud/device/setup/route');
    const nullResponse = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        headers: { authorization: 'Bearer nc_dev_status' },
        body: 'null',
      }),
    );
    const arrayResponse = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        headers: { authorization: 'Bearer nc_dev_status' },
        body: JSON.stringify([{ automaticSyncEnabled: true }]),
      }),
    );

    expect(nullResponse.status).toBe(400);
    await expect(nullResponse.json()).resolves.toEqual({
      error: 'invalid_payload',
    });
    expect(arrayResponse.status).toBe(400);
    await expect(arrayResponse.json()).resolves.toEqual({
      error: 'invalid_payload',
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('rejects payloads without an automaticSyncEnabled boolean', async () => {
    const { POST } = await import('../app/api/cloud/device/setup/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        headers: { authorization: 'Bearer nc_dev_status' },
        body: JSON.stringify({ automaticSyncEnabled: 'true' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'automatic_sync_enabled_required',
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  test('defaults invalid source and skippedReason values safely', async () => {
    const { set } = setupUpdateReturning();
    const { POST } = await import('../app/api/cloud/device/setup/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/cloud/device/setup', {
        method: 'POST',
        headers: { authorization: 'Bearer nc_dev_status' },
        body: JSON.stringify({
          automaticSyncEnabled: false,
          source: 'browser',
          skippedReason: 'tokenHash',
          reportedAt: 'not-a-date',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const [setPayload] = set.mock.calls[0] as unknown as [{ clientInfo: { values: unknown[] } }];
    const automaticSync = JSON.parse(setPayload.clientInfo.values.at(-1) as string) as Record<
      string,
      unknown
    >;
    const { reportedAt } = automaticSync;
    expect(automaticSync).toMatchObject({
      enabled: false,
      source: 'login',
      skippedReason: null,
    });
    expect(typeof reportedAt).toBe('string');
    expect(new Date(reportedAt as string).toString()).not.toBe('Invalid Date');
  });

  test('route is device-token scoped and avoids browser cookie auth or raw token fields', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../app/api/cloud/device/setup/route.ts', import.meta.url), 'utf8'),
    );

    expect(source).toContain('authenticateDeviceRequest');
    expect(source).toContain('automaticSyncEnabled');
    for (const required of ['clientInfo', 'automaticSync']) {
      expect(source).toContain(required);
    }
    expect(source).toContain('jsonb_set');
    expect(source).toContain('coalesce');
    for (const forbidden of [
      'GITHUB_IDENTITY_COOKIE',
      'getCurrentBrowserUser',
      'cookies()',
      'deviceToken',
      'tokenHash',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
