import { afterEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));

  return {
    accountSecurityEvents: { tableName: 'account_security_events' },
    getDb: vi.fn(() => ({ insert })),
    insert,
    values,
  };
});

vi.mock('@nowcoding/cloud-db', () => ({
  accountSecurityEvents: mocks.accountSecurityEvents,
  getDb: mocks.getDb,
}));

describe('security event helpers', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.insert.mockClear();
    mocks.values.mockClear();
    mocks.getDb.mockClear();
  });

  test('returns null for IP hashes when no server secret is configured', async () => {
    vi.stubEnv('ACCOUNT_SECURITY_EVENT_SECRET', '');
    vi.stubEnv('GITHUB_OAUTH_STATE_SECRET', '');
    vi.stubEnv('GITHUB_CLIENT_SECRET', '');
    vi.stubEnv('SESSION_SECRET', '');

    const { ipHashFromHeaders } = await import('../lib/security-events');

    await expect(
      ipHashFromHeaders(new Headers({ 'cf-connecting-ip': '203.0.113.10' })),
    ).resolves.toBeNull();
  });

  test('creates deterministic non-raw IP HMACs with a server secret', async () => {
    vi.stubEnv('ACCOUNT_SECURITY_EVENT_SECRET', 'event-secret');

    const { ipHashFromHeaders } = await import('../lib/security-events');
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.10' });

    const firstHash = await ipHashFromHeaders(headers);
    const secondHash = await ipHashFromHeaders(headers);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHash).not.toContain('203.0.113.10');
  });

  test('prefers Cloudflare IP before forwarded IP', async () => {
    vi.stubEnv('ACCOUNT_SECURITY_EVENT_SECRET', 'event-secret');

    const { ipHashFromHeaders } = await import('../lib/security-events');
    const cfHash = await ipHashFromHeaders(new Headers({ 'cf-connecting-ip': '203.0.113.10' }));
    const mixedHash = await ipHashFromHeaders(
      new Headers({
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.20, 198.51.100.21',
      }),
    );

    expect(mixedHash).toBe(cfHash);
  });

  test('uses the first forwarded IP when Cloudflare IP is absent', async () => {
    vi.stubEnv('ACCOUNT_SECURITY_EVENT_SECRET', 'event-secret');

    const { ipHashFromHeaders } = await import('../lib/security-events');
    const firstForwardedHash = await ipHashFromHeaders(
      new Headers({ 'x-forwarded-for': '198.51.100.20' }),
    );
    const forwardedListHash = await ipHashFromHeaders(
      new Headers({
        'x-forwarded-for': '198.51.100.20, 198.51.100.21',
      }),
    );

    expect(forwardedListHash).toBe(firstForwardedHash);
  });

  test('writes account security events with metadata defaults', async () => {
    const { writeAccountSecurityEvent } = await import('../lib/security-events');

    await writeAccountSecurityEvent({
      userId: 'user-1',
      eventType: 'github_sign_in',
    });

    expect(mocks.insert).toHaveBeenCalledWith(mocks.accountSecurityEvents);
    expect(mocks.values).toHaveBeenCalledWith({
      userId: 'user-1',
      deviceId: null,
      eventType: 'github_sign_in',
      metadata: {},
      ipHash: null,
    });
  });
});
