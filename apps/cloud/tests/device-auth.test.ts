import { describe, expect, test, vi } from 'vitest';

const where = vi.fn(() => ({ limit }));
const limit = vi.fn();
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

vi.mock('@nowcoding/cloud-db', () => ({
  devices: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    revokedAt: 'revokedAt',
  },
  getDb: () => ({ select }),
}));

describe('device auth helper', () => {
  test('accepts nc_dev_ bearer tokens and rejects revoked or missing devices', async () => {
    limit.mockResolvedValueOnce([{ id: 'device-1', userId: 'user-1' }]);

    const { authenticateDeviceRequest } = await import('../lib/device-auth');
    await expect(authenticateDeviceRequest('Bearer nc_dev_test')).resolves.toEqual({
      id: 'device-1',
      userId: 'user-1',
    });

    limit.mockResolvedValueOnce([]);
    await expect(authenticateDeviceRequest('Bearer nc_dev_missing')).resolves.toBeNull();

    await expect(authenticateDeviceRequest('Bearer bad')).resolves.toBeNull();
  });
});
