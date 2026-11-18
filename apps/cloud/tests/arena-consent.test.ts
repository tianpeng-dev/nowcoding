import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getCurrentBrowserUserFromCookie = vi.fn();
  const ipHashFromHeaders = vi.fn(async () => 'ip-hash');
  const joinArenaForUser = vi.fn();
  const leaveArenaForUser = vi.fn();
  const readArenaConsentForUser = vi.fn();
  const writeAccountSecurityEvent = vi.fn();

  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
    },
    getCurrentBrowserUserFromCookie,
    ipHashFromHeaders,
    joinArenaForUser,
    leaveArenaForUser,
    readArenaConsentForUser,
    writeAccountSecurityEvent,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ left, op: 'eq', right }),
}));

vi.mock('@nowcoding/cloud-db', () => ({
  arenaConsents: {
    acceptedAt: 'arenaConsents.acceptedAt',
    joined: 'arenaConsents.joined',
    updatedAt: 'arenaConsents.updatedAt',
    userId: 'arenaConsents.userId',
  },
  getDb: () => mocks.db,
}));

vi.mock('../lib/browser-mutation', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/browser-mutation')>('../lib/browser-mutation');

  return actual;
});

vi.mock('../lib/browser-session', () => ({
  GITHUB_IDENTITY_COOKIE: 'nc_github_identity',
  getCurrentBrowserUserFromCookie: mocks.getCurrentBrowserUserFromCookie,
}));

vi.mock('../lib/security-events', () => ({
  ipHashFromHeaders: mocks.ipHashFromHeaders,
  writeAccountSecurityEvent: mocks.writeAccountSecurityEvent,
}));

describe('arena consent helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('joinArenaForUser upserts joined consent with acceptedAt', async () => {
    const { joinArenaForUser } = await import('../lib/arena-consent');
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const db = {
      insert: vi.fn(() => ({ values })),
    };

    await joinArenaForUser(db as never, 'user-1');

    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      joined: true,
      acceptedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: 'arenaConsents.userId',
      set: {
        joined: true,
        acceptedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
  });

  test('leaveArenaForUser records an explicit opt-out', async () => {
    const { leaveArenaForUser } = await import('../lib/arena-consent');
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const db = {
      insert: vi.fn(() => ({ values })),
    };

    await leaveArenaForUser(db as never, 'user-1');

    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      joined: false,
      updatedAt: expect.any(Date),
    });
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: 'arenaConsents.userId',
      set: {
        joined: false,
        updatedAt: expect.any(Date),
      },
    });
  });

  test('readArenaConsentForUser returns an existing consent row', async () => {
    const { readArenaConsentForUser } = await import('../lib/arena-consent');
    const acceptedAt = new Date('2026-05-19T01:00:00.000Z');
    const updatedAt = new Date('2026-05-19T02:00:00.000Z');
    const limit = vi.fn().mockResolvedValue([{ joined: true, acceptedAt, updatedAt }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    await expect(readArenaConsentForUser({ select } as never, 'user-1')).resolves.toEqual({
      joined: true,
      acceptedAt,
      updatedAt,
    });
    expect(where).toHaveBeenCalledWith({
      left: 'arenaConsents.userId',
      op: 'eq',
      right: 'user-1',
    });
  });

  test('readArenaConsentForUser returns false when no consent row exists', async () => {
    const { readArenaConsentForUser } = await import('../lib/arena-consent');
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    };

    await expect(readArenaConsentForUser(db as never, 'user-1')).resolves.toEqual({
      joined: false,
      acceptedAt: null,
      updatedAt: null,
    });
  });
});

describe('account arena API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentBrowserUserFromCookie.mockResolvedValue({
      user: { id: 'user-1' },
    });
    mocks.joinArenaForUser.mockResolvedValue(undefined);
    mocks.leaveArenaForUser.mockResolvedValue(undefined);
    mocks.readArenaConsentForUser.mockResolvedValue({
      joined: true,
      acceptedAt: new Date('2026-05-19T01:00:00.000Z'),
      updatedAt: new Date('2026-05-19T02:00:00.000Z'),
    });
  });

  test('GET reads consent for the current browser user', async () => {
    const acceptedAt = new Date('2026-05-19T01:00:00.000Z');
    const updatedAt = new Date('2026-05-19T02:00:00.000Z');
    const limit = vi.fn().mockResolvedValue([{ joined: true, acceptedAt, updatedAt }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    mocks.db.select.mockReturnValueOnce({ from });

    const { GET } = await import('../app/api/account/arena/route');
    const response = await GET(
      new NextRequest('https://nowcoding.cc/api/account/arena', {
        headers: { cookie: 'nc_github_identity=session' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getCurrentBrowserUserFromCookie).toHaveBeenCalledWith('session');
    expect(await response.json()).toEqual({
      arena: {
        joined: true,
        acceptedAt: '2026-05-19T01:00:00.000Z',
        updatedAt: '2026-05-19T02:00:00.000Z',
      },
    });
  });

  test('POST rejects cross-site browser mutations before resolving the user', async () => {
    const { POST } = await import('../app/api/account/arena/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/account/arena', {
        method: 'POST',
        headers: {
          cookie: 'nc_github_identity=session',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ joined: true }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.getCurrentBrowserUserFromCookie).not.toHaveBeenCalled();
  });

  test('POST updates consent and writes an account security event', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mocks.db.insert.mockReturnValueOnce({ values });
    mocks.db.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              joined: false,
              acceptedAt: null,
              updatedAt: new Date('2026-05-19T02:00:00.000Z'),
            },
          ]),
        })),
      })),
    });

    const { POST } = await import('../app/api/account/arena/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/account/arena', {
        method: 'POST',
        headers: {
          cookie: 'nc_github_identity=session',
          origin: 'https://nowcoding.cc',
          'x-forwarded-for': '203.0.113.5',
        },
        body: JSON.stringify({ joined: false }),
      }),
    );

    expect(response.status).toBe(200);
    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      joined: false,
      updatedAt: expect.any(Date),
    });
    expect(mocks.writeAccountSecurityEvent).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        eventType: 'arena_left',
        ipHash: 'ip-hash',
      },
      mocks.db,
    );
  });

  test('POST rejects malformed joined before mutating consent', async () => {
    const { POST } = await import('../app/api/account/arena/route');
    const response = await POST(
      new NextRequest('https://nowcoding.cc/api/account/arena', {
        method: 'POST',
        headers: {
          cookie: 'nc_github_identity=session',
          origin: 'https://nowcoding.cc',
        },
        body: JSON.stringify({ joined: 'false' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'joined_required' });
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.writeAccountSecurityEvent).not.toHaveBeenCalled();
  });

  test('route is browser-session scoped and avoids device-token auth', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../app/api/account/arena/route.ts', import.meta.url), 'utf8'),
    );

    expect(source).toContain('rejectCrossSiteBrowserMutation');
    expect(source).toContain('getCurrentBrowserUserFromCookie');
    expect(source).toContain('GITHUB_IDENTITY_COOKIE');
    for (const forbidden of [
      'Authorization',
      'authorization',
      'deviceToken',
      'tokenHash',
      'pollTokenHash',
      'userCodeHash',
      'nc_dev_',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
