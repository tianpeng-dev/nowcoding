import { pathToFileURL } from 'node:url';

export function normalizeBaseUrl(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    throw new Error('A http(s) base URL is required');
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('A http(s) base URL is required');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('A http(s) base URL is required');
  }

  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');

  return url.toString().replace(/\/+$/, '');
}

export function buildSmokeTargets(
  baseUrl,
  username = process.env.NOWCODING_SMOKE_USERNAME ?? 'tianpeng-dev',
  { strictProfile = Boolean(process.env.NOWCODING_SMOKE_USERNAME) } = {},
) {
  normalizeBaseUrl(baseUrl);
  const encodedUsername = encodeURIComponent(username);
  const optionalProfile = strictProfile
    ? {}
    : {
        optionalStatuses: [404],
        optionalReason: 'profile data may not exist yet',
      };

  return [
    { path: '/', expectedStatus: 200, expectedContentType: 'text/html' },
    {
      path: '/leaderboard',
      expectedStatus: 200,
      expectedContentType: 'text/html',
    },
    {
      path: '/api/leaderboard?range=30d&scope=all&metric=tokens',
      expectedStatus: 200,
      expectedContentType: 'application/json',
    },
    {
      path: `/u/${encodedUsername}`,
      expectedStatus: 200,
      expectedContentType: 'text/html',
      ...optionalProfile,
    },
    {
      path: `/u/${encodedUsername}/card.svg`,
      expectedStatus: 200,
      expectedContentType: 'image/svg+xml',
      ...optionalProfile,
    },
    {
      path: `/u/${encodedUsername}/badge/today.svg`,
      expectedStatus: 200,
      expectedContentType: 'image/svg+xml',
      ...optionalProfile,
    },
    {
      path: `/api/u/${encodedUsername}/stats?period=7d`,
      expectedStatus: 200,
      expectedContentType: 'application/json',
      ...optionalProfile,
    },
    {
      path: `/api/u/${encodedUsername}/now`,
      expectedStatus: 200,
      expectedContentType: 'application/json',
      ...optionalProfile,
    },
  ];
}

export function buildJsonPostRequest(url, body, headers = {}) {
  return {
    url,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    },
  };
}

function responseContentType(response) {
  return response.headers.get('content-type') ?? '';
}

async function responsePreview(response) {
  const text = await response.text();

  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function assertContentType({ path, response, expectedContentType }) {
  if (!expectedContentType) {
    return;
  }

  const contentType = responseContentType(response);

  if (!contentType.includes(expectedContentType)) {
    throw new Error(
      `${path} expected content-type containing ${expectedContentType}, got ${contentType || '[missing]'}`,
    );
  }
}

async function assertSmokeResponse({
  path,
  response,
  expectedStatus,
  expectedContentType,
  optionalStatuses = [],
  optionalReason,
  logger = console,
}) {
  if (optionalStatuses.includes(response.status)) {
    logger.log(
      `SKIP ${path} returned ${response.status}${optionalReason ? `; ${optionalReason}` : ''}`,
    );
    return;
  }

  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} expected ${expectedStatus}, got ${response.status}: ${await responsePreview(response)}`,
    );
  }

  assertContentType({ path, response, expectedContentType });
  logger.log(`OK ${path}`);
}

async function fetchWithRetry(url, init, fetchImpl, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
    }
  }

  throw lastError;
}

async function smokeGet(baseUrl, target, fetchImpl, logger) {
  const response = await fetchWithRetry(
    `${baseUrl}${target.path}`,
    {
      redirect: 'manual',
    },
    fetchImpl,
  );

  await assertSmokeResponse({ ...target, response, logger });
}

async function smokeJsonPost({ baseUrl, path, body, expectedStatus, headers, fetchImpl, logger }) {
  const request = buildJsonPostRequest(`${baseUrl}${path}`, body, headers);
  const response = await fetchWithRetry(request.url, request.init, fetchImpl);

  await assertSmokeResponse({
    path,
    response,
    expectedStatus,
    expectedContentType: 'application/json',
    logger,
  });
}

export async function runCloudSmoke({
  baseUrl = process.argv[2],
  cronSecret = process.env.CRON_SECRET,
  includeMutating = process.env.NOWCODING_SMOKE_INCLUDE_MUTATING === '1' ||
    process.argv.includes('--include-mutating'),
  strictProfile = Boolean(process.env.NOWCODING_SMOKE_USERNAME),
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  for (const target of buildSmokeTargets(normalizedBaseUrl, undefined, {
    strictProfile,
  })) {
    await smokeGet(normalizedBaseUrl, target, fetchImpl, logger);
  }

  await smokeJsonPost({
    baseUrl: normalizedBaseUrl,
    path: '/api/cloud/usage/ingest',
    body: { buckets: [], sessions: [] },
    expectedStatus: 401,
    fetchImpl,
    logger,
  });

  if (includeMutating) {
    logger.log('MUTATING /api/auth/cli/start creates a CLI auth flow');
    await smokeJsonPost({
      baseUrl: normalizedBaseUrl,
      path: '/api/auth/cli/start',
      body: { deviceName: 'smoke', joinArena: false },
      expectedStatus: 200,
      fetchImpl,
      logger,
    });

    await smokeJsonPost({
      baseUrl: normalizedBaseUrl,
      path: '/api/auth/cli/poll',
      body: { pollToken: 'invalid' },
      expectedStatus: 404,
      fetchImpl,
      logger,
    });
  } else {
    logger.log(
      'SKIP MUTATING /api/auth/cli/start; set NOWCODING_SMOKE_INCLUDE_MUTATING=1 or pass --include-mutating',
    );
  }

  if (includeMutating && cronSecret) {
    logger.log('MUTATING /api/jobs/leaderboard writes leaderboard snapshots');
    await smokeJsonPost({
      baseUrl: normalizedBaseUrl,
      path: '/api/jobs/leaderboard',
      body: {},
      headers: { authorization: `Bearer ${cronSecret}` },
      expectedStatus: 200,
      fetchImpl,
      logger,
    });
  } else if (includeMutating) {
    logger.log('SKIP /api/jobs/leaderboard because CRON_SECRET is not set');
  } else {
    logger.log(
      'SKIP MUTATING /api/jobs/leaderboard; set NOWCODING_SMOKE_INCLUDE_MUTATING=1 or pass --include-mutating',
    );
  }

  logger.log(`Smoke passed for ${normalizedBaseUrl}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCloudSmoke().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloud smoke failed: ${message}`);
    process.exitCode = 1;
  });
}
