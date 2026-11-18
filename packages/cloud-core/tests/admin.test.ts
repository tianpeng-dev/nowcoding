import { describe, expect, it } from 'vitest';
import { isAdminGithubLogin, isUuid, parsePostgresBigintId } from '../src/admin';

describe('admin authorization', () => {
  it('matches admin GitHub logins case-insensitively', () => {
    expect(isAdminGithubLogin('Peng', 'peng,alice')).toBe(true);
    expect(isAdminGithubLogin('bob', 'peng,alice')).toBe(false);
  });

  it('ignores allowlist whitespace and empty entries', () => {
    expect(isAdminGithubLogin(' alice ', ' peng, Alice, ,')).toBe(true);
    expect(isAdminGithubLogin(' ', 'peng,alice')).toBe(false);
  });

  it('validates UUID route parameters before database use', () => {
    expect(isUuid('018f5db9-c5f1-4ef4-9ff2-55fe8df55555')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('parses PostgreSQL bigint IDs within range only', () => {
    expect(parsePostgresBigintId('9223372036854775807')).toBe(9_223_372_036_854_775_807n);
    expect(parsePostgresBigintId('0')).toBeNull();
    expect(parsePostgresBigintId('9223372036854775808')).toBeNull();
    expect(parsePostgresBigintId('abc')).toBeNull();
  });
});
