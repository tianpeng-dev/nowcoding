import { describe, expect, it } from 'vitest';
import {
  createCliFlowToken,
  createDeviceToken,
  createPollToken,
  createSignedGitHubIdentitySession,
  createUserCode,
  getCloudUrl,
  hashSecret,
  isSafeReturnPath,
  normalizeUserCode,
  verifyGitHubIdentitySession,
} from '../src/auth';

describe('auth utilities', () => {
  it('creates URL-safe device tokens with the expected prefix and length', () => {
    expect(createDeviceToken(() => Buffer.alloc(32, 1))).toMatch(/^nc_dev_[A-Za-z0-9_-]{43}$/);
  });

  it('creates URL-safe CLI flow tokens with the expected prefix and length', () => {
    expect(createCliFlowToken(() => Buffer.alloc(32, 1))).toMatch(/^nc_flow_[A-Za-z0-9_-]{43}$/);
  });

  it('creates distinct private poll tokens and public user codes', () => {
    const pollToken = createPollToken(() => Buffer.alloc(32, 1));
    const userCode = createUserCode(() => Buffer.alloc(16, 2));

    expect(pollToken).toMatch(/^nc_poll_[A-Za-z0-9_-]{43}$/);
    expect(userCode).toMatch(/^NC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(pollToken).not.toBe(userCode);
  });

  it('normalizes manually entered user codes', () => {
    expect(normalizeUserCode(' nc-abcd-2345 ')).toBe('NC-ABCD-2345');
    expect(normalizeUserCode('ABCD 2345')).toBe('NC-ABCD-2345');
    expect(normalizeUserCode('bad')).toBeNull();
  });

  it('hashes secrets as sha256 hex', async () => {
    await expect(hashSecret('secret')).resolves.toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates signed GitHub identity sessions with caller-provided expiry', () => {
    const session = {
      githubId: '123',
      githubLogin: 'peng',
      displayName: 'Peng',
      avatarUrl: 'https://example.com/avatar.png',
      expiresAt: Date.UTC(2026, 4, 26),
    };
    const sessionValue = createSignedGitHubIdentitySession(session, 'test-secret');

    expect(verifyGitHubIdentitySession(sessionValue, 'test-secret', Date.UTC(2026, 4, 19))).toEqual(
      session,
    );
  });

  it('accepts local return paths', () => {
    expect(isSafeReturnPath('/login/device?code=ABCD')).toBe(true);
  });

  it('rejects absolute external return URLs', () => {
    expect(isSafeReturnPath('https://evil.example.com')).toBe(false);
  });

  it('rejects protocol-relative return paths', () => {
    expect(isSafeReturnPath('//evil.com')).toBe(false);
  });

  it('rejects backslash return paths', () => {
    expect(isSafeReturnPath('/\\evil.com')).toBe(false);
  });

  it('rejects control characters in return paths', () => {
    expect(isSafeReturnPath('/\t/evil.com')).toBe(false);
  });

  it('rejects encoded backslash and control characters in return paths', () => {
    expect(isSafeReturnPath('/%5Cevil.com')).toBe(false);
    expect(isSafeReturnPath('/%09/evil.com')).toBe(false);
  });
});

describe('cloud URL defaults', () => {
  it('defaults official Cloud URLs to nowcoding.cc', () => {
    expect(getCloudUrl(undefined)).toBe('https://nowcoding.cc');
  });

  it('removes trailing slashes from configured Cloud URLs', () => {
    expect(getCloudUrl('https://nowcoding.cc///')).toBe('https://nowcoding.cc');
  });
});
