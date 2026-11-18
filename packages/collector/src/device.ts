import { deviceTokenSchema } from '@nowcoding/core/cloud';
import { type NormalizedConfig, normalizeConfig } from './config';
export interface FetchJsonInit {
  method?: string;
  body?: unknown;
}

interface StartResponse {
  verificationUrl?: unknown;
  pollToken?: unknown;
  userCode?: unknown;
}

interface PollResponse {
  status?: unknown;
  endpoint?: unknown;
  deviceToken?: unknown;
  username?: unknown;
  deviceId?: unknown;
  arenaJoined?: unknown;
}

export async function defaultFetchJson(url: string, init: FetchJsonInit = {}): Promise<unknown> {
  const headers: Record<string, string> = {};
  const requestInit: RequestInit = {
    method: init.method,
    headers,
  };

  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify(init.body);
  }

  const res = await fetch(url, requestInit);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Request failed (${res.status} ${res.statusText}) for ${url}${text ? `: ${text}` : ''}`,
    );
  }

  return res.json();
}

export async function beginLogin(
  endpoint: string,
  deviceName: string,
  joinArena: boolean,
  fetchJson = defaultFetchJson,
) {
  const started = (await fetchJson(`${endpoint}/api/auth/cli/start`, {
    method: 'POST',
    body: {
      deviceName,
      joinArena,
    },
  })) as StartResponse;

  if (typeof started.verificationUrl !== 'string' || started.verificationUrl.length === 0) {
    throw new Error('Login start response did not include a verification URL.');
  }
  if (typeof started.pollToken !== 'string' || started.pollToken.length === 0) {
    throw new Error('Login start response did not include a poll token.');
  }

  return {
    verificationUrl: started.verificationUrl,
    pollToken: started.pollToken,
    userCode: started.userCode,
  };
}
export async function pollLogin(
  endpoint: string,
  pollToken: string,
  current: NormalizedConfig | null,
  fetchJson = defaultFetchJson,
) {
  const polled = (await fetchJson(`${endpoint}/api/auth/cli/poll`, {
    method: 'POST',
    body: {
      pollToken: pollToken,
    },
  })) as PollResponse;

  if (polled.status === 'complete') {
    const deviceToken = deviceTokenSchema.parse(polled.deviceToken);
    const username = typeof polled.username === 'string' ? polled.username : null;
    const deviceId = typeof polled.deviceId === 'string' ? polled.deviceId : null;
    const configEndpoint = typeof polled.endpoint === 'string' ? polled.endpoint : endpoint;
    const nextConfig = normalizeConfig({
      ...(current ?? {}),
      mode: 'cloud',
      endpoint: configEndpoint,
      apiToken: deviceToken,
      cloud: {
        username,
        deviceId,
        arenaJoined: polled.arenaJoined === true,
      },
    });

    return nextConfig;
  }
  if (polled.status !== 'pending')
    throw new Error(`Unexpected device login status: ${polled.status}`);
  return null;
}
