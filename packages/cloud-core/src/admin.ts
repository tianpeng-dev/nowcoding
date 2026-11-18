const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAdminGithubLogin(login: string, allowlist: string): boolean {
  const normalized = login.trim().toLowerCase();

  return allowlist
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function parsePostgresBigintId(value: string): bigint | null {
  const normalized = value.trim();

  if (!/^[0-9]+$/.test(normalized)) {
    return null;
  }

  const parsed = BigInt(normalized);

  if (parsed < 1n || parsed > POSTGRES_BIGINT_MAX) {
    return null;
  }

  return parsed;
}
