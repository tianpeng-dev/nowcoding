import { describe, expect, test, vi } from 'vitest';

const select = vi.fn();
const getDb = vi.fn(() => ({ select }));
const reserveGitHubUser = vi.fn(async () => ({
  id: 'user-1',
  username: 'peng',
  githubId: '123',
  githubLogin: 'peng',
  displayName: 'Peng',
  avatarUrl: 'https://example.com/avatar.png',
}));

vi.mock('@nowcoding/cloud-db', () => ({
  getDb,
  users: {
    id: 'id',
    username: 'username',
    githubId: 'githubId',
    githubLogin: 'githubLogin',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
  },
}));

vi.mock('../app/api/auth/_shared', () => ({
  GITHUB_IDENTITY_COOKIE: 'nc_github_identity',
  reserveGitHubUser,
}));

describe('browser session helpers', () => {
  test('creates seven day browser session cookie options', async () => {
    const { browserSessionCookieOptions } = await import('../lib/browser-session');

    expect(browserSessionCookieOptions('https://nowcoding.cc')).toEqual({
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });

  test('builds a safe GitHub sign-in href with returnTo', async () => {
    const { githubSignInHref } = await import('../lib/browser-session');

    expect(githubSignInHref('/account/devices')).toBe(
      '/api/auth/github/start?returnTo=%2Faccount%2Fdevices',
    );
    expect(githubSignInHref('https://evil.example')).toBe('/api/auth/github/start?returnTo=%2F');
    expect(githubSignInHref('/foo?next=https://evil.example')).toBe(
      '/api/auth/github/start?returnTo=%2F',
    );
    expect(githubSignInHref('/%5Cevil.example')).toBe('/api/auth/github/start?returnTo=%2F');
  });

  test('creates a verifiable seven day browser identity session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T00:00:00.000Z'));

    try {
      const {
        BROWSER_SESSION_MAX_AGE_SECONDS,
        createBrowserSessionCookieValue,
        verifyBrowserIdentity,
      } = await import('../lib/browser-session');

      const cookieValue = createBrowserSessionCookieValue({
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
      });
      const identity = verifyBrowserIdentity(cookieValue);

      expect(identity).toEqual({
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
        expiresAt: Date.now() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000,
      });
      expect(identity?.expiresAt).toBe(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } finally {
      vi.useRealTimers();
    }
  });

  test('resolves current browser user from a valid cookie', async () => {
    const { createBrowserSessionCookieValue, getCurrentBrowserUserFromCookie } = await import(
      '../lib/browser-session'
    );
    const cookieValue = createBrowserSessionCookieValue({
      githubId: '123',
      githubLogin: 'peng',
      displayName: 'Peng',
      avatarUrl: 'https://example.com/avatar.png',
    });

    await expect(getCurrentBrowserUserFromCookie(cookieValue)).resolves.toEqual({
      identity: expect.objectContaining({
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
      }),
      user: {
        id: 'user-1',
        username: 'peng',
        githubId: '123',
        githubLogin: 'peng',
        displayName: 'Peng',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(reserveGitHubUser).toHaveBeenCalledOnce();
  });

  test('returns null for missing or invalid browser identity cookies', async () => {
    const { getCurrentBrowserUserFromCookie, getCurrentBrowserUserReadOnlyFromCookie } =
      await import('../lib/browser-session');

    reserveGitHubUser.mockClear();
    getDb.mockClear();

    await expect(getCurrentBrowserUserFromCookie(undefined)).resolves.toBeNull();
    await expect(getCurrentBrowserUserFromCookie('not-a-session')).resolves.toBeNull();
    await expect(getCurrentBrowserUserReadOnlyFromCookie(undefined)).resolves.toBeNull();
    await expect(getCurrentBrowserUserReadOnlyFromCookie('not-a-session')).resolves.toBeNull();
    expect(reserveGitHubUser).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
});
