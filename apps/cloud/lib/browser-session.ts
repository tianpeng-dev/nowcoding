import {
  type GitHubIdentitySession,
  createSignedGitHubIdentitySession,
  getCloudUrl,
  isSafeReturnPath,
  verifyGitHubIdentitySession,
} from '@nowcoding/cloud-core';
import { type Database, getDb, users } from '@nowcoding/cloud-db';
import { eq } from 'drizzle-orm';
import { GITHUB_IDENTITY_COOKIE, reserveGitHubUser } from '../app/api/auth/_shared';

export const BROWSER_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type BrowserAccount = {
  id: string;
  username: string | null;
  githubId: string | null;
  githubLogin: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CurrentBrowserUser = {
  identity: GitHubIdentitySession;
  user: BrowserAccount;
};

type BrowserSessionCookieOptions = {
  httpOnly: boolean;
  maxAge: number;
  path: string;
  sameSite: 'lax';
  secure: boolean;
};

export function browserSessionCookieOptions(cloudUrl = getCloudUrl()): BrowserSessionCookieOptions {
  return {
    httpOnly: true,
    maxAge: BROWSER_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: cloudUrl.startsWith('https://'),
  };
}

export function createBrowserSessionCookieValue(
  identity: Omit<GitHubIdentitySession, 'expiresAt'>,
): string {
  return createSignedGitHubIdentitySession({
    ...identity,
    expiresAt: Date.now() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export function verifyBrowserIdentity(
  cookieValue: string | undefined,
): GitHubIdentitySession | null {
  if (!cookieValue) {
    return null;
  }

  return verifyGitHubIdentitySession(cookieValue);
}

export async function getCurrentBrowserUserFromCookie(
  cookieValue: string | undefined,
  db?: Database,
): Promise<CurrentBrowserUser | null> {
  const identity = verifyBrowserIdentity(cookieValue);

  if (!identity) {
    return null;
  }

  const user = await reserveGitHubUser(db ?? getDb(), identity);

  return {
    identity,
    user: {
      id: user.id,
      username: user.username,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function getCurrentBrowserUserReadOnlyFromCookie(
  cookieValue: string | undefined,
  db?: Database,
): Promise<CurrentBrowserUser | null> {
  const identity = verifyBrowserIdentity(cookieValue);

  if (!identity) {
    return null;
  }

  const [user] = await (db ?? getDb())
    .select({
      id: users.id,
      username: users.username,
      githubId: users.githubId,
      githubLogin: users.githubLogin,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.githubId, identity.githubId))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    identity,
    user,
  };
}

export function githubSignInHref(returnTo = '/'): string {
  const safeReturnTo = isSafeReturnPath(returnTo) ? returnTo : '/';

  return `/api/auth/github/start?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export { GITHUB_IDENTITY_COOKIE };
