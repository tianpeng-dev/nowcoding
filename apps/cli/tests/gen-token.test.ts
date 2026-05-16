import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runGenToken } from '../src/commands/gen-token';
import { runInit } from '../src/commands/init';
import { main } from '../src/index';
import { generateApiToken, isApiToken } from '../src/lib/token';

describe('API token helpers', () => {
  it('generates nc_live tokens from 24 random bytes', () => {
    const bytes = Buffer.from(Array.from({ length: 24 }, (_, i) => i));
    const token = generateApiToken(() => bytes);

    expect(token).toBe(`nc_live_${bytes.toString('base64url')}`);
    expect(token).toHaveLength(40);
    expect(isApiToken(token)).toBe(true);
  });

  it('validates only exact live API token format', () => {
    expect(isApiToken(`nc_live_${'A'.repeat(32)}`)).toBe(true);
    expect(isApiToken(`nc_live_${'A'.repeat(31)}`)).toBe(false);
    expect(isApiToken(`nc_live_${'A'.repeat(33)}`)).toBe(false);
    expect(isApiToken(`nc_test_${'A'.repeat(32)}`)).toBe(false);
    expect(isApiToken(`nc_live_${'A'.repeat(31)}=`)).toBe(false);
    expect(isApiToken('')).toBe(false);
  });
});

describe('gen-token command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints exactly one generated token', () => {
    const bytes = Buffer.alloc(24, 255);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runGenToken(() => bytes);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(`nc_live_${bytes.toString('base64url')}`);
  });

  it('is listed in CLI help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await main(['--help']);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('nowcoding gen-token'));
  });

  it('is routed by main', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await main(['gen-token']);

    expect(log).toHaveBeenCalledTimes(1);
    expect(isApiToken(String(log.mock.calls[0]?.[0]))).toBe(true);
  });
});

describe('init token validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects malformed live tokens before saving config', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      runInit({
        endpoint: 'https://now.example.com',
        token: 'nc_live_short',
        hostname: 'devbox',
      }),
    ).rejects.toThrow('process.exit');

    expect(console.error).toHaveBeenCalledWith(
      'Token must match nc_live_<32 base64url chars>. Generate one with: npx nowcoding gen-token',
    );
  });
});
