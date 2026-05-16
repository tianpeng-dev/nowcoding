import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadRoute() {
  vi.resetModules();
  process.env.NOWCODING_API_TOKEN = `nc_live_${'A'.repeat(32)}`;
  return import('../app/api/usage/settings/route');
}

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.NOWCODING_API_TOKEN = undefined;
});

describe('/api/usage/settings', () => {
  it('rejects requests without the API token', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('https://nowcoding.test/api/usage/settings') as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects requests with the wrong API token', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new Request('https://nowcoding.test/api/usage/settings', {
        headers: { authorization: 'Bearer nc_live_wrongtoken' },
      }) as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it('returns privacy settings with a valid API token', async () => {
    process.env.NOWCODING_SHOW_LIVE = 'false';
    const { GET } = await loadRoute();

    const response = await GET(
      new Request('https://nowcoding.test/api/usage/settings', {
        headers: { authorization: `Bearer nc_live_${'A'.repeat(32)}` },
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      uploadProject: false,
      uploadHostname: true,
      showCost: true,
      showLive: false,
      version: '1.0.0',
    });
  });
});
