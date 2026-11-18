'use client';

import { useEffect, useState } from 'react';

const MAX_STATUS_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1_500;
const UNAVAILABLE_MESSAGE =
  'Device details unavailable. Check your terminal or run nowcoding login again.';

type DisplayState = 'checking' | 'ready' | 'unavailable';

type CliDeviceStatus = {
  status: 'confirmed' | 'claimed';
  account: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  device: {
    id: string | null;
    name: string;
    claimed: boolean;
  };
  arenaJoined: boolean;
};

function accountLabel(status: CliDeviceStatus | null) {
  if (!status) {
    return 'Pending: checking account session';
  }

  const username = status.account.username ? `@${status.account.username}` : 'Unknown account';

  return status.account.displayName ? `${status.account.displayName} (${username})` : username;
}

function deviceLabel(status: CliDeviceStatus | null) {
  if (!status) {
    return 'Pending: waiting for device details';
  }

  return status.device.name || 'NowCoding CLI';
}

function tokenLabel(status: CliDeviceStatus | null, displayState: DisplayState) {
  if (status?.device.claimed || status?.status === 'claimed') {
    return 'Device token saved by the CLI';
  }

  if (displayState === 'checking') {
    return 'Pending: waiting for the CLI to save its device token';
  }

  return UNAVAILABLE_MESSAGE;
}

export default function DeviceStatusClient() {
  const [status, setStatus] = useState<CliDeviceStatus | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>('checking');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(attempt: number) {
      try {
        const response = await fetch('/api/auth/cli/status', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setDisplayState('unavailable');
          return;
        }

        const nextStatus = (await response.json()) as CliDeviceStatus;
        setStatus(nextStatus);

        if (nextStatus.device.claimed || nextStatus.status === 'claimed') {
          setDisplayState('ready');
          return;
        }
      } catch {
        // A missing status cookie or transient network error is safe to treat as
        // pending. The terminal remains the source of truth for device token save.
      }

      if (cancelled) {
        return;
      }

      if (attempt >= MAX_STATUS_ATTEMPTS) {
        setDisplayState('unavailable');
        return;
      }

      timer = setTimeout(() => void load(attempt + 1), POLL_INTERVAL_MS);
    }

    void load(1);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <section className="device-summary" aria-label="Device confirmation status">
      {displayState === 'unavailable' ? (
        <p className="notice device-unavailable">{UNAVAILABLE_MESSAGE}</p>
      ) : null}
      <div>
        <span className="summary-label">Account</span>
        <span>{accountLabel(status)}</span>
      </div>
      <div>
        <span className="summary-label">Device</span>
        <span>{deviceLabel(status)}</span>
      </div>
      <div>
        <span className="summary-label">Token status</span>
        <span>{tokenLabel(status, displayState)}</span>
      </div>
    </section>
  );
}
