import { describe, expect, test } from 'vitest';
import { DEFAULT_ACCOUNT_SETTINGS, deviceBearerToken } from '../lib/account-settings';

describe('account settings helpers', () => {
  test('returns conservative functional V2 Cloud defaults', () => {
    expect(DEFAULT_ACCOUNT_SETTINGS).toEqual({
      uploadProject: false,
      uploadHostname: false,
      showCost: true,
      showLive: true,
    });
  });

  test('extracts nc_dev_ bearer tokens only', () => {
    expect(deviceBearerToken('Bearer nc_dev_token')).toBe('nc_dev_token');
    expect(deviceBearerToken('bearer   nc_dev_token   ')).toBe('nc_dev_token');
    expect(deviceBearerToken('Bearer other_token')).toBeNull();
    expect(deviceBearerToken(null)).toBeNull();
  });
});
