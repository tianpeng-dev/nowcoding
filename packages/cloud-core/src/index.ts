export type CloudStatus = {
  ready: boolean;
  service: 'cloud-core';
};

export function getCloudStatus(): CloudStatus {
  return {
    ready: true,
    service: 'cloud-core',
  };
}

export * from './anti-abuse';
export * from './admin';
export * from './auth';
export * from './leaderboard';
