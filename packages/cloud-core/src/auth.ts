import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type RandomBytes = (size: number) => Buffer;
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type GitHubOAuthState = {
  returnTo: string;
  nonce: string;
  expiresAt: number;
};

export type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export type GitHubIdentitySession = {
  githubId: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  expiresAt: number;
};

export function createDeviceToken(random: RandomBytes = randomBytes): string {
  return `nc_dev_${random(32).toString('base64url')}`;
}

export function createPollToken(random: RandomBytes = randomBytes): string {
  return `nc_poll_${random(32).toString('base64url')}`;
}

export function createCliFlowToken(random: RandomBytes = randomBytes): string {
  return `nc_flow_${random(32).toString('base64url')}`;
}

export function createUserCode(random: RandomBytes = randomBytes): string {
  const bytes = random(8);
  const code = Array.from(bytes.subarray(0, 8), (byte) => {
    return USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
  }).join('');

  return `NC-${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeUserCode(userCode: string): string | null {
  const compact = userCode
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
  const code = compact.startsWith('NC') ? compact : `NC${compact}`;

  if (!/^NC[A-Z2-9]{8}$/.test(code)) {
    return null;
  }

  return `NC-${code.slice(2, 6)}-${code.slice(6)}`;
}

export function createUrlToken(random: RandomBytes = randomBytes): string {
  return random(32).toString('base64url');
}

export async function hashSecret(secret: string): Promise<string> {
  return createHash('sha256').update(secret).digest('hex');
}

function hasUnsafePathCharacters(path: string): boolean {
  for (const character of path) {
    const code = character.charCodeAt(0);

    if (character === '\\' || code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function decodeReturnPath(path: string): string | null {
  let decoded = path;

  for (let index = 0; index < 3; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);

      if (nextDecoded === decoded) {
        return decoded;
      }

      decoded = nextDecoded;
    } catch {
      return null;
    }
  }

  return decoded;
}

export function isSafeReturnPath(path: string, trustedOrigin = 'https://nowcoding.cc'): boolean {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('://') ||
    hasUnsafePathCharacters(path)
  ) {
    return false;
  }

  const decodedPath = decodeReturnPath(path);

  if (
    !decodedPath ||
    !decodedPath.startsWith('/') ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('://') ||
    hasUnsafePathCharacters(decodedPath)
  ) {
    return false;
  }

  try {
    const trustedUrl = new URL(trustedOrigin);
    const parsedReturnUrl = new URL(decodedPath, trustedUrl.origin);

    return parsedReturnUrl.origin === trustedUrl.origin && parsedReturnUrl.pathname.startsWith('/');
  } catch {
    return false;
  }
}

export function getCloudUrl(cloudUrl = process.env.NOWCODING_CLOUD_URL): string {
  return (cloudUrl ?? 'https://nowcoding.cc').replace(/\/+$/, '');
}

export function getGitHubStateSecret(): string {
  return (
    process.env.GITHUB_OAUTH_STATE_SECRET ??
    process.env.GITHUB_CLIENT_SECRET ??
    'nowcoding-dev-state-secret'
  );
}

export function createGitHubOAuthState(
  returnTo: string,
  secret = getGitHubStateSecret(),
  now = Date.now(),
): string {
  const state: GitHubOAuthState = {
    returnTo,
    nonce: createUrlToken(),
    expiresAt: now + 10 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');

  return `${payload}.${signature}`;
}

export function createGitHubIdentitySession(
  githubUser: GitHubUser,
  secret = getGitHubStateSecret(),
  now = Date.now(),
): string {
  const session: GitHubIdentitySession = {
    githubId: String(githubUser.id),
    githubLogin: githubUser.login,
    displayName: githubUser.name,
    avatarUrl: githubUser.avatar_url,
    expiresAt: now + 10 * 60 * 1000,
  };

  return createSignedGitHubIdentitySession(session, secret);
}

export function createSignedGitHubIdentitySession(
  session: GitHubIdentitySession,
  secret = getGitHubStateSecret(),
): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');

  return `${payload}.${signature}`;
}

export function verifyGitHubIdentitySession(
  sessionValue: string,
  secret = getGitHubStateSecret(),
  now = Date.now(),
): GitHubIdentitySession | null {
  const [payload, signature] = sessionValue.split('.');

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<GitHubIdentitySession>;

    if (
      typeof parsed.githubId !== 'string' ||
      typeof parsed.githubLogin !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < now ||
      (parsed.displayName !== null && typeof parsed.displayName !== 'string') ||
      (parsed.avatarUrl !== null && typeof parsed.avatarUrl !== 'string')
    ) {
      return null;
    }

    return {
      githubId: parsed.githubId,
      githubLogin: parsed.githubLogin,
      displayName: parsed.displayName ?? null,
      avatarUrl: parsed.avatarUrl ?? null,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function verifyGitHubOAuthState(
  stateValue: string,
  secret = getGitHubStateSecret(),
  now = Date.now(),
): GitHubOAuthState | null {
  const [payload, signature] = stateValue.split('.');

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<GitHubOAuthState>;

    if (
      typeof parsed.returnTo !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < now ||
      !isSafeReturnPath(parsed.returnTo)
    ) {
      return null;
    }

    return parsed as GitHubOAuthState;
  } catch {
    return null;
  }
}

export async function exchangeGitHubCode(
  code: string,
  redirectUri: string,
  clientId = process.env.GITHUB_CLIENT_ID,
  clientSecret = process.env.GITHUB_CLIENT_SECRET,
): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenResponse = (await response.json()) as GitHubTokenResponse;

  if (!response.ok || !tokenResponse.access_token) {
    throw new Error(
      tokenResponse.error_description ?? tokenResponse.error ?? 'GitHub token exchange failed',
    );
  }

  return tokenResponse.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'x-github-api-version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error('GitHub user fetch failed');
  }

  return (await response.json()) as GitHubUser;
}
