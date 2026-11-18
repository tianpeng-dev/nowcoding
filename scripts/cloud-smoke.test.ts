import { describe, expect, it } from 'vitest';
import {
  buildJsonPostRequest,
  buildSmokeTargets,
  normalizeBaseUrl,
  runCloudSmoke,
} from './cloud-smoke.mjs';

function jsonResponse(status: number, contentType = 'application/json') {
  return new Response('{}', {
    status,
    headers: { 'content-type': contentType },
  });
}

function createFetch(responses: Record<string, Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    calls.push({ url: requestUrl, init });

    const response = responses[requestUrl];

    if (!response) {
      throw new Error(`Unexpected fetch: ${requestUrl}`);
    }

    return response;
  };

  return { calls, fetchImpl };
}

const defaultResponses = {
  'https://nowcoding.cc/': new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }),
  'https://nowcoding.cc/leaderboard': new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }),
  'https://nowcoding.cc/api/leaderboard?range=30d&scope=all&metric=tokens': jsonResponse(200),
  'https://nowcoding.cc/u/tianpeng-dev': new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }),
  'https://nowcoding.cc/u/tianpeng-dev/card.svg': new Response('<svg></svg>', {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
  }),
  'https://nowcoding.cc/u/tianpeng-dev/badge/today.svg': new Response('<svg></svg>', {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
  }),
  'https://nowcoding.cc/api/u/tianpeng-dev/stats?period=7d': jsonResponse(200),
  'https://nowcoding.cc/api/u/tianpeng-dev/now': jsonResponse(200),
  'https://nowcoding.cc/api/cloud/usage/ingest': jsonResponse(401),
};

describe('cloud-smoke helpers', () => {
  it('normalizes base URLs by removing trailing slashes', () => {
    expect(normalizeBaseUrl('https://nowcoding.cc///')).toBe('https://nowcoding.cc');
  });

  it('builds core smoke targets for a base URL', () => {
    expect(
      buildSmokeTargets('https://nowcoding.cc', 'tianpeng-dev').map((target) => target.path),
    ).toEqual([
      '/',
      '/leaderboard',
      '/api/leaderboard?range=30d&scope=all&metric=tokens',
      '/u/tianpeng-dev',
      '/u/tianpeng-dev/card.svg',
      '/u/tianpeng-dev/badge/today.svg',
      '/api/u/tianpeng-dev/stats?period=7d',
      '/api/u/tianpeng-dev/now',
    ]);
  });

  it('builds JSON POST requests with expected headers', () => {
    const request = buildJsonPostRequest('https://nowcoding.cc/api/auth/cli/start', {
      deviceName: 'smoke',
      joinArena: false,
    });

    expect(request.url).toBe('https://nowcoding.cc/api/auth/cli/start');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers).toEqual({
      'content-type': 'application/json',
    });
    expect(request.init.body).toBe('{"deviceName":"smoke","joinArena":false}');
  });

  it('does not call mutating endpoints by default', async () => {
    const fake = createFetch(defaultResponses);

    await runCloudSmoke({
      baseUrl: 'https://nowcoding.cc',
      cronSecret: 'secret',
      fetchImpl: fake.fetchImpl,
      logger: { log: () => {} },
    });

    expect(fake.calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/',
      '/leaderboard',
      '/api/leaderboard',
      '/u/tianpeng-dev',
      '/u/tianpeng-dev/card.svg',
      '/u/tianpeng-dev/badge/today.svg',
      '/api/u/tianpeng-dev/stats',
      '/api/u/tianpeng-dev/now',
      '/api/cloud/usage/ingest',
    ]);
  });

  it('retries transient fetch failures', async () => {
    const fake = createFetch(defaultResponses);
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === 'https://nowcoding.cc/api/u/tianpeng-dev/now') {
        const failures = fake.calls.filter(
          (call) => call.url === 'https://nowcoding.cc/api/u/tianpeng-dev/now',
        ).length;

        if (failures === 0) {
          fake.calls.push({ url: String(url), init });
          throw new TypeError('fetch failed');
        }
      }

      return fake.fetchImpl(url, init);
    };

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        fetchImpl,
        logger: { log: () => {} },
      }),
    ).resolves.toBeUndefined();
  });

  it('runs mutating endpoints only when explicitly requested', async () => {
    const fake = createFetch({
      ...defaultResponses,
      'https://nowcoding.cc/api/auth/cli/start': jsonResponse(200),
      'https://nowcoding.cc/api/auth/cli/poll': jsonResponse(404),
      'https://nowcoding.cc/api/jobs/leaderboard': jsonResponse(200),
    });

    await runCloudSmoke({
      baseUrl: 'https://nowcoding.cc',
      cronSecret: 'secret',
      includeMutating: true,
      fetchImpl: fake.fetchImpl,
      logger: { log: () => {} },
    });

    const mutatingCalls = fake.calls.filter((call) =>
      ['/api/auth/cli/start', '/api/jobs/leaderboard'].includes(new URL(call.url).pathname),
    );

    expect(mutatingCalls.map((call) => new URL(call.url).pathname)).toEqual([
      '/api/auth/cli/start',
      '/api/jobs/leaderboard',
    ]);
    expect(mutatingCalls.at(-1)?.init?.headers).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer secret',
    });
  });

  it('treats a missing profile card as optional', async () => {
    const fake = createFetch({
      ...defaultResponses,
      'https://nowcoding.cc/u/tianpeng-dev/card.svg': jsonResponse(404),
    });

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        fetchImpl: fake.fetchImpl,
        logger: { log: () => {} },
      }),
    ).resolves.toBeUndefined();
  });

  it('requires username-scoped surfaces when profile smoke is strict', async () => {
    const fake = createFetch({
      ...defaultResponses,
      'https://nowcoding.cc/u/tianpeng-dev/card.svg': jsonResponse(404),
    });

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        fetchImpl: fake.fetchImpl,
        logger: { log: () => {} },
      }),
    ).resolves.toBeUndefined();

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        strictProfile: true,
        fetchImpl: fake.fetchImpl,
        logger: { log: () => {} },
      }),
    ).rejects.toThrow('/u/tianpeng-dev/card.svg expected 200, got 404');
  });

  it('fails when a required response has the wrong status', async () => {
    const fake = createFetch({
      ...defaultResponses,
      'https://nowcoding.cc/leaderboard': new Response('missing', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
    });

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        fetchImpl: fake.fetchImpl,
        logger: { log: () => {} },
      }),
    ).rejects.toThrow('/leaderboard expected 200, got 404');
  });

  it('fails when a required response has the wrong content type', async () => {
    const fake = createFetch({
      ...defaultResponses,
      'https://nowcoding.cc/api/leaderboard?range=30d&scope=all&metric=tokens': new Response(
        '<html></html>',
        {
          status: 200,
          headers: { 'content-type': 'text/html' },
        },
      ),
    });

    await expect(
      runCloudSmoke({
        baseUrl: 'https://nowcoding.cc',
        fetchImpl: fake.fetchImpl,
        logger: { log: () => {} },
      }),
    ).rejects.toThrow(
      '/api/leaderboard?range=30d&scope=all&metric=tokens expected content-type containing application/json',
    );
  });
});
