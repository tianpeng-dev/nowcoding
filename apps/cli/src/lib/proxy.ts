import { ProxyAgent, setGlobalDispatcher } from 'undici';

type Env = Record<string, string | undefined>;

interface DispatcherDeps<TDispatcher = unknown> {
  ProxyAgent: new (uri: string) => TDispatcher;
  setGlobalDispatcher: (dispatcher: TDispatcher) => void;
}

const PROXY_ENV_KEYS = [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'ALL_PROXY',
  'all_proxy',
];

let installed = false;

export function getProxyUrl(env: Env = process.env): string | null {
  for (const key of PROXY_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function installProxyDispatcher(
  env: Env = process.env,
  deps: DispatcherDeps = { ProxyAgent, setGlobalDispatcher } as DispatcherDeps,
): boolean {
  if (installed) return true;

  const proxyUrl = getProxyUrl(env);
  if (!proxyUrl) return false;

  deps.setGlobalDispatcher(new deps.ProxyAgent(proxyUrl));
  installed = true;
  return true;
}
