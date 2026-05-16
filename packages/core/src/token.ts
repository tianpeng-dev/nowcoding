export const API_TOKEN_PATTERN = /^nc_live_[A-Za-z0-9_-]{32}$/;

export function isApiToken(value: string | undefined): value is string {
  return Boolean(value && API_TOKEN_PATTERN.test(value));
}
