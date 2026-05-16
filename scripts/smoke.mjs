#!/usr/bin/env node

import { assertExpectedData } from './smoke-assertions.mjs';

const baseUrl = process.env.NOWCODING_SMOKE_BASE_URL;
const token = process.env.NOWCODING_SMOKE_TOKEN;
const publicOnly = process.env.NOWCODING_SMOKE_PUBLIC_ONLY === 'true';
const expectData = process.env.NOWCODING_SMOKE_EXPECT_DATA === 'true';

if (!baseUrl) {
  console.error('Set NOWCODING_SMOKE_BASE_URL, for example https://your-deployment.vercel.app');
  process.exit(1);
}

if (!token && !publicOnly) {
  console.error(
    'Set NOWCODING_SMOKE_TOKEN to check authenticated settings, or set NOWCODING_SMOKE_PUBLIC_ONLY=true to skip private-route smoke.',
  );
  process.exit(1);
}

let origin;

try {
  origin = new URL(baseUrl).origin;
} catch (error) {
  console.error(`Invalid NOWCODING_SMOKE_BASE_URL: ${baseUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const checks = [
  { path: '/', expectType: 'text/html' },
  { path: '/card.svg', expectType: 'image/svg+xml' },
  { path: '/badge/today.svg', expectType: 'image/svg+xml' },
  { path: '/badge/week.svg', expectType: 'image/svg+xml' },
  { path: '/badge/total.svg', expectType: 'image/svg+xml' },
  { path: '/badge/model.svg', expectType: 'image/svg+xml' },
  { path: '/badge/streak.svg', expectType: 'image/svg+xml' },
  { path: '/badge/live.svg', expectType: 'image/svg+xml' },
  { path: '/og/profile.png', expectType: 'image/png' },
  { path: '/api/stats', expectType: 'application/json' },
  { path: '/api/now', expectType: 'application/json' },
  { path: '/api/heatmap', expectType: 'application/json' },
];

let failures = 0;

async function checkRoute(path, expectType, options) {
  try {
    const response = await fetch(`${origin}${path}`, options);
    const contentType = response.headers.get('content-type') ?? '';
    const ok = response.ok && contentType.includes(expectType);

    console.log(`${ok ? 'ok' : 'fail'} ${path} ${response.status} ${contentType}`);

    if (!ok) {
      failures += 1;
      return;
    }

    if (expectData && expectType === 'application/json') {
      let json;
      try {
        json = await response.json();
      } catch (error) {
        failures += 1;
        console.log(
          `fail ${path} json-error ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }

      try {
        assertExpectedData(path, json);
        console.log(`ok ${path} data`);
      } catch (error) {
        failures += 1;
        console.log(
          `fail ${path} data-error ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    failures += 1;
    console.log(
      `fail ${path} fetch-error ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function checkRejected(path) {
  try {
    const response = await fetch(`${origin}${path}`);
    const ok = response.status === 401 || response.status === 403;

    console.log(`${ok ? 'ok' : 'fail'} ${path} unauthenticated ${response.status}`);

    if (!ok) {
      failures += 1;
    }
  } catch (error) {
    failures += 1;
    console.log(
      `fail ${path} unauthenticated fetch-error ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

for (const check of checks) {
  await checkRoute(check.path, check.expectType);
}

await checkRejected('/api/usage/settings');

if (token) {
  await checkRoute('/api/usage/settings', 'application/json', {
    headers: { authorization: `Bearer ${token}` },
  });
} else {
  console.log('skip authenticated /api/usage/settings because NOWCODING_SMOKE_PUBLIC_ONLY=true');
}

if (failures > 0) {
  process.exit(1);
}
