import { describe, expect, test } from 'vitest';

describe('onboarding data helpers', () => {
  test('builds onboarding profile, card, and badge links from the supplied cloud URL', async () => {
    const { buildOnboardingLinks } = await import('../lib/onboarding-data');

    expect(buildOnboardingLinks('https://cloud.example/', 'peng')).toEqual({
      profile: 'https://cloud.example/u/peng',
      card: 'https://cloud.example/u/peng/card.svg',
      badges: {
        today: 'https://cloud.example/u/peng/badge/today.svg',
        week: 'https://cloud.example/u/peng/badge/week.svg',
        total: 'https://cloud.example/u/peng/badge/total.svg',
        model: 'https://cloud.example/u/peng/badge/model.svg',
        streak: 'https://cloud.example/u/peng/badge/streak.svg',
        live: 'https://cloud.example/u/peng/badge/live.svg',
      },
    });
  });

  test('empty usage summary exposes no token fields beyond zero totals', async () => {
    const { summarizeUsageForOnboarding } = await import('../lib/onboarding-data');
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };

    await expect(summarizeUsageForOnboarding(db as never, 'user-1')).resolves.toEqual({
      hasUsage: false,
      totalTokens7d: 0,
      requestCount7d: 0,
      latestSyncAt: null,
    });
  });

  test('extracts automatic sync status only when explicitly enabled', async () => {
    const { extractAutomaticSyncStatus } = await import('../lib/onboarding-data');

    expect(
      extractAutomaticSyncStatus({
        automaticSync: {
          enabled: true,
          skippedReason: 'user_skipped',
          reportedAt: '2026-05-19T03:30:00.000Z',
        },
      }),
    ).toEqual({
      enabled: true,
      skippedReason: 'user_skipped',
      reportedAt: '2026-05-19T03:30:00.000Z',
    });
    expect(extractAutomaticSyncStatus({ automaticSync: { enabled: 'true' } })).toEqual({
      enabled: false,
      skippedReason: null,
      reportedAt: null,
    });
    expect(extractAutomaticSyncStatus(null)).toEqual({
      enabled: false,
      skippedReason: null,
      reportedAt: null,
    });
  });

  test('latest device query orders by non-null updated or created timestamps', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../lib/onboarding-data.ts', import.meta.url), 'utf8'),
    );

    expect(source).toContain('latestDeviceTimestamp');
    expect(source).toContain('coalesce');
    expect(source).toContain('devices.updatedAt');
    expect(source).toContain('devices.createdAt');
  });

  test('source includes onboarding sections and avoids raw device secrets', async () => {
    const [pageSource, loginSource] = await Promise.all([
      import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8'),
      ),
      import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../app/login/device/page.tsx', import.meta.url), 'utf8'),
      ),
    ]);

    for (const required of [
      'Device',
      'First sync',
      'Arena',
      'Profile',
      'Automatic sync',
      'Enabled',
      'Not enabled yet',
    ]) {
      expect(pageSource).toContain(required);
    }
    expect(pageSource).toContain('nowcoding daemon install');
    expect(pageSource).toContain('nowcoding daemon start');
    expect(loginSource).toContain('/onboarding');
    expect(loginSource).toMatch(/t\(['"]authorizedTerminal['"]\)/);
    for (const forbidden of ['deviceToken', 'tokenHash', 'nc_dev_']) {
      expect(pageSource).not.toContain(forbidden);
    }
  });
});
