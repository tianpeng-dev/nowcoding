import { describe, expect, it } from 'vitest';
import {
  LOCAL_PRIVACY_DEFAULTS,
  normalizeConfig,
  normalizePrivacySettings,
  normalizeSourcesConfig,
} from '../src/lib/config';

describe('config privacy defaults', () => {
  it('uses local privacy defaults with v1 display controls enabled', () => {
    expect(LOCAL_PRIVACY_DEFAULTS).toEqual({
      uploadProject: false,
      uploadHostname: true,
      showCost: true,
      showLive: true,
    });
  });

  it('normalizes legacy privacy settings with local display defaults', () => {
    expect(normalizePrivacySettings({ uploadProject: false, uploadHostname: true })).toEqual({
      uploadProject: false,
      uploadHostname: true,
      showCost: true,
      showLive: true,
    });
  });
});

describe('config source defaults', () => {
  it('defaults cursor source to disabled and not opted in', () => {
    expect(normalizeSourcesConfig(undefined)).toEqual({
      cursor: {
        enabled: false,
        explicitlyOptedIn: false,
        optedInAt: null,
      },
    });
  });

  it('requires all cursor opt-in fields to preserve enabled=true', () => {
    expect(
      normalizeSourcesConfig({
        cursor: {
          enabled: true,
          explicitlyOptedIn: true,
          optedInAt: '2026-05-14T00:00:00.000Z',
        },
      }),
    ).toEqual({
      cursor: {
        enabled: true,
        explicitlyOptedIn: true,
        optedInAt: '2026-05-14T00:00:00.000Z',
      },
    });
  });

  it('disables cursor when opt-in timestamp is missing or invalid', () => {
    expect(
      normalizeSourcesConfig({
        cursor: {
          enabled: true,
          explicitlyOptedIn: true,
          optedInAt: 'not-a-date',
        },
      }),
    ).toEqual({
      cursor: {
        enabled: false,
        explicitlyOptedIn: false,
        optedInAt: null,
      },
    });
  });
});

describe('config normalization', () => {
  it('treats existing endpoint/apiToken configs as self-hosted', () => {
    const cfg = normalizeConfig({
      endpoint: 'https://self.example.com',
      apiToken: `nc_live_${'A'.repeat(32)}`,
      hostname: 'devbox',
      privacy: {
        uploadProject: true,
        uploadHostname: false,
        showCost: false,
        showLive: false,
      },
    });

    expect(cfg.mode).toBe('self-hosted');
    expect(cfg.endpoint).toBe('https://self.example.com');
    expect(cfg.apiToken).toBe(`nc_live_${'A'.repeat(32)}`);
  });

  it('persists Cloud account metadata with a device token', () => {
    const cfg = normalizeConfig({
      mode: 'cloud',
      endpoint: 'https://nowcoding.cc',
      apiToken: `nc_dev_${'A'.repeat(43)}`,
      hostname: 'devbox',
      cloud: {
        username: 'peng',
        deviceId: 'dev_123',
        arenaJoined: true,
      },
    });

    expect(cfg.mode).toBe('cloud');
    expect(cfg.cloud).toEqual({
      username: 'peng',
      deviceId: 'dev_123',
      arenaJoined: true,
    });
  });
});
