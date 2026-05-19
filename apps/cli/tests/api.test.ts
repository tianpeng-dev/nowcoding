import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchServerSettings,
  postDeviceSetupStatus,
  postHeartbeat,
  postIngest,
} from '../src/lib/api';
import type { Config } from '../src/lib/config';

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  endpoint: 'https://example.com/',
  apiToken: 'nc_live_testtoken',
  hostname: 'devbox',
  privacy: {
    uploadProject: false,
    uploadHostname: true,
    showCost: true,
    showLive: true,
  },
  sources: {
    cursor: {
      enabled: false,
      explicitlyOptedIn: false,
      optedInAt: null,
    },
  },
  mode: 'self-hosted',
  ...overrides,
});

const cfg: Config = makeConfig();

describe('fetchServerSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all four privacy fields from server settings', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadProject: true,
        uploadHostname: false,
        showCost: true,
        showLive: false,
      }),
    } as Response);

    await expect(fetchServerSettings(cfg)).resolves.toEqual({
      uploadProject: true,
      uploadHostname: false,
      showCost: true,
      showLive: false,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/usage/settings', {
      headers: { Authorization: 'Bearer nc_live_testtoken' },
    });
  });
});

describe('postIngest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts self-hosted ingest to the v1 endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        received: { buckets: 0, sessions: 0 },
        stored: { buckets: 0, sessions: 0 },
      }),
    } as Response);

    await postIngest(makeConfig({ mode: 'self-hosted', endpoint: 'https://self.example.com' }), {
      buckets: [],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://self.example.com/api/usage/ingest');
  });

  it('posts cloud ingest to the cloud endpoint with client version header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        received: { buckets: 0, sessions: 0 },
        stored: { buckets: 0, sessions: 0 },
      }),
    } as Response);
    const apiToken = `nc_dev_${'A'.repeat(43)}`;

    await postIngest(makeConfig({ mode: 'cloud', endpoint: 'https://nowcoding.cc', apiToken }), {
      buckets: [],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://nowcoding.cc/api/cloud/usage/ingest');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiToken}`,
          'X-NowCoding-Client': 'nowcoding-cli/0.1.0-alpha.3',
        }),
      }),
    );
  });

  it('uses the effective hostname header passed by sync privacy logic', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        received: { buckets: 0, sessions: 0 },
        stored: { buckets: 0, sessions: 0 },
      }),
    } as Response);

    await postIngest(cfg, { buckets: [] }, 'unknown');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/usage/ingest',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Hostname': 'unknown',
        }),
      }),
    );
  });
});

describe('postHeartbeat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts heartbeat JSON with auth and hostname headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, lastSeenAt: '2026-05-14T01:02:03.000Z' }),
    } as Response);

    await expect(
      postHeartbeat(
        cfg,
        {
          source: 'manual',
          model: 'gpt-5',
          project: 'nowcoding',
          observedAt: '2026-05-14T01:02:03.000Z',
        },
        'devbox-private',
      ),
    ).resolves.toEqual({ ok: true, lastSeenAt: '2026-05-14T01:02:03.000Z' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/usage/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nc_live_testtoken',
        'X-Hostname': 'devbox-private',
        'X-NowCoding-Client': expect.stringMatching(/^nowcoding-cli\//),
      },
      body: JSON.stringify({
        source: 'manual',
        model: 'gpt-5',
        project: 'nowcoding',
        observedAt: '2026-05-14T01:02:03.000Z',
      }),
    });
  });
});

describe('postDeviceSetupStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts cloud device setup status to the cloud endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    const apiToken = `nc_dev_${'A'.repeat(43)}`;
    const payload = {
      automaticSyncEnabled: false,
      source: 'login' as const,
      skippedReason: 'non_interactive' as const,
      reportedAt: '2026-05-19T01:02:03.000Z',
    };

    await expect(
      postDeviceSetupStatus(
        makeConfig({ mode: 'cloud', endpoint: 'https://nowcoding.cc', apiToken }),
        payload,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('https://nowcoding.cc/api/cloud/device/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'X-NowCoding-Client': 'nowcoding-cli/0.1.0-alpha.3',
      },
      body: JSON.stringify(payload),
    });
  });

  it('posts self-hosted device setup status to the self-hosted endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await postDeviceSetupStatus(
      makeConfig({ mode: 'self-hosted', endpoint: 'https://self.example.com' }),
      {
        automaticSyncEnabled: true,
        source: 'manual',
        reportedAt: '2026-05-19T01:02:03.000Z',
      },
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://self.example.com/api/device/setup');
  });

  it('rejects when device setup status returns non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => 'temporarily down',
    } as Response);

    await expect(
      postDeviceSetupStatus(makeConfig({ mode: 'cloud', endpoint: 'https://nowcoding.cc' }), {
        automaticSyncEnabled: false,
        source: 'login',
        skippedReason: 'install_failed',
        reportedAt: '2026-05-19T01:02:03.000Z',
      }),
    ).rejects.toThrow('device setup status failed: 503 Service Unavailable temporarily down');
  });
});
