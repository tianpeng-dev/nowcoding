import { afterEach, describe, expect, it, vi } from 'vitest';
import { runArena } from '../src/commands/arena';
import { normalizeConfig } from '../src/lib/config';

describe('arena command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints local Arena status for a cloud config joined as peng', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const cfg = normalizeConfig({
      mode: 'cloud',
      endpoint: 'https://nowcoding.cc',
      apiToken: `nc_dev_${'A'.repeat(43)}`,
      cloud: {
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: true,
      },
    });

    await runArena({ action: 'status' }, { loadConfig: vi.fn().mockResolvedValue(cfg) });

    expect(log).toHaveBeenCalledWith('Arena: joined as peng');
    expect(log).toHaveBeenCalledWith('Device: dev_123');
    expect(log).toHaveBeenCalledWith('Endpoint: https://nowcoding.cc');
  });

  it('rejects status when config is missing or self-hosted', async () => {
    await expect(
      runArena({ action: 'status' }, { loadConfig: vi.fn().mockResolvedValue(null) }),
    ).rejects.toThrow('Arena requires `nowcoding login` with a Cloud account.');

    const selfHosted = normalizeConfig({
      endpoint: 'https://self.example.com',
      apiToken: `nc_live_${'A'.repeat(32)}`,
    });

    await expect(
      runArena({ action: 'status' }, { loadConfig: vi.fn().mockResolvedValue(selfHosted) }),
    ).rejects.toThrow('Arena requires `nowcoding login` with a Cloud account.');
  });
});
