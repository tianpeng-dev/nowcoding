import { describe, expect, it, vi } from 'vitest';
import { getProxyUrl, installProxyDispatcher } from '../src/lib/proxy';

describe('proxy environment support', () => {
  it('prefers HTTPS proxy settings for outbound CLI requests', () => {
    expect(
      getProxyUrl({
        HTTPS_PROXY: 'http://127.0.0.1:7897',
        HTTP_PROXY: 'http://127.0.0.1:8080',
        ALL_PROXY: 'socks5h://127.0.0.1:7890',
      }),
    ).toBe('http://127.0.0.1:7897');
  });

  it('installs an undici dispatcher when a proxy env var exists', () => {
    const setGlobalDispatcher = vi.fn();
    const agent = { proxy: true };
    const ProxyAgent = vi.fn(() => agent);

    const installed = installProxyDispatcher(
      { https_proxy: 'http://127.0.0.1:7897' },
      { ProxyAgent, setGlobalDispatcher },
    );

    expect(installed).toBe(true);
    expect(ProxyAgent).toHaveBeenCalledWith('http://127.0.0.1:7897');
    expect(ProxyAgent.mock.instances).toHaveLength(1);
    expect(setGlobalDispatcher).toHaveBeenCalledWith(agent);
  });
});
