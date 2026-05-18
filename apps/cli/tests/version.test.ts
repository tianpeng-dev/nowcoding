import { describe, expect, it, vi } from 'vitest';
import { main, VERSION } from '../src/index';

describe('CLI version', () => {
  it('exports the npm release candidate version', () => {
    expect(VERSION).toBe('0.1.0-alpha.1');
  });

  it('prints the npm release candidate version', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await main(['--version']);

    expect(log).toHaveBeenCalledWith('0.1.0-alpha.1');
  });
});
