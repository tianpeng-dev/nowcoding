export type AccountSettings = {
  uploadProject: boolean;
  uploadHostname: boolean;
  showCost: boolean;
  showLive: boolean;
};

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  uploadProject: false,
  uploadHostname: false,
  showCost: true,
  showLive: true,
};

export function deviceBearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  const token = match?.[1]?.trim();

  return token?.startsWith('nc_dev_') ? token : null;
}
