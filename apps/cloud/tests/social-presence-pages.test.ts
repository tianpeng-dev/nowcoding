import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { assertNoPrivateFeedFields } from '../lib/now-feed';
import {
  HOMEPAGE_PRIMARY_HEADLINE,
  HOMEPAGE_SUBHEAD,
  PRIVACY_PROMISES,
  SHARE_DESTINATIONS,
  SOCIAL_PROOF_SIGNALS,
} from '../lib/social-positioning';

async function source(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

describe('cloud social presence positioning', () => {
  test('uses the shared social-first homepage contract', () => {
    expect(HOMEPAGE_PRIMARY_HEADLINE).toBe('headline');
    expect(HOMEPAGE_SUBHEAD).toBe('description');
    expect(SOCIAL_PROOF_SIGNALS).toContain('socialProof.signals.codingNow');
    expect(SHARE_DESTINATIONS).toContain('socialProof.shareDestinations.githubReadme');
    expect(PRIVACY_PROMISES[0]).toBe('socialProof.privacy.noPrivateContent');
  });

  test('homepage is the primary social surface without a separate now page CTA', async () => {
    const page = await source('../app/page.tsx');

    expect(page).toContain("t('headline')");
    expect(page).toContain("t('cta.startBroadcasting')");
    expect(page).not.toContain("t('cta.exploreLiveBuilders')");
    expect(page).not.toContain('href="/now"');
    expect(page).not.toContain("t('refactorCopy')");
    expect(page).not.toContain("t('liveBuilders.sectionDescription')");
    expect(page).toContain('loadLiveBuilderRows');
    const liveBuildersIndex = page.indexOf("t('liveBuilders.label')");
    const capabilitiesIndex = page.indexOf("t('capabilities.label')");
    expect(liveBuildersIndex).toBeGreaterThanOrEqual(0);
    expect(capabilitiesIndex).toBeGreaterThanOrEqual(0);
    expect(liveBuildersIndex).toBeLessThan(capabilitiesIndex);
  });

  test('standalone now pages redirect back to the homepage', async () => {
    const page = await source('../app/now/page.tsx');
    const localizedPage = await source('../app/[locale]/now/page.tsx');

    expect(page).toContain("redirect('/')");
    expect(page).not.toContain('loadLiveBuilderRows');
    expect(page).not.toContain("getTranslations('now')");
    expect(localizedPage).toContain("redirect({ href: '/', locale })");
    expect(localizedPage).not.toContain('NowPage');
  });

  test('navigation exposes theme and language controls without the now page link', async () => {
    const nav = await source('../app/components/cloud-nav.tsx');
    const languageToggle = await source('../app/components/language-toggle.tsx');

    expect(nav).toContain('LanguageToggle');
    expect(nav).toContain('ThemeToggle');
    expect(nav).not.toContain('href="/now"');
    expect(nav).not.toContain("active?: 'account' | 'arena' | 'home' | 'now';");
    expect(languageToggle).toContain("'use client'");
  });

  test('localized device login text comes from message files', async () => {
    const page = await source('../app/login/device/page.tsx');

    expect(page).toContain("getTranslations('deviceLogin')");
    expect(page).toContain("t('joinLeaderboard')");
    expect(page).not.toContain('Join NowCoding Arena');
    expect(page).not.toContain('Arena can publish');
  });

  test('root metadata and html lang follow the active locale', async () => {
    const layout = await source('../app/layout.tsx');

    expect(layout).toContain('generateMetadata');
    expect(layout).toContain('getRootLocale');
    expect(layout).toContain('REQUEST_LOCALE_HEADER');
    expect(layout).toContain("namespace: 'metadata'");
    expect(layout).toContain('lang={locale}');
  });

  test('profile puts share actions before activity proof', async () => {
    const page = await source('../app/u/[username]/page.tsx');

    expect(page).toContain("t('githubReadme')");
    expect(page).toContain('X / Twitter');
    expect(page).toContain("t('activityProof')");
    const shareIndex = page.indexOf("t('share')");
    const proofIndex = page.indexOf("t('activityProof')");
    expect(shareIndex).toBeGreaterThanOrEqual(0);
    expect(proofIndex).toBeGreaterThanOrEqual(0);
    expect(shareIndex).toBeLessThan(proofIndex);
  });

  test('arena is framed as opt-in discovery with required filters', async () => {
    const page = await source('../app/leaderboard/page.tsx');

    expect(page).toContain("getTranslations('leaderboard')");
    expect(page).toContain("t('headline')");
    expect(page).toContain("t('optInDiscovery')");
    expect(page).toContain("t('joinArena')");
    for (const metric of ['tokens', 'active_time', 'streak', 'time_saved']) {
      expect(page).toContain(metric);
    }
  });

  test('usage page is signed-in and secondary', async () => {
    const page = await source('../app/usage/page.tsx');

    expect(page).toContain("t('signInRequired')");
    expect(page).toContain("note={t('title')}");
    expect(page).toContain("getTranslations('usage')");
    expect(page).toContain("t('description')");
    expect(page).toContain("t('viewPublicPresence')");
  });

  test('live feed rows reject path-like private project fields', () => {
    expect(() =>
      assertNoPrivateFeedFields({
        username: 'peng',
        displayName: 'Peng',
        avatarUrl: null,
        state: 'live',
        source: 'codex',
        project: '/Users/peng/secret',
        streak: 1,
        lastActiveAt: '2026-05-23',
        profileHref: '/u/peng',
      }),
    ).toThrow('private_feed_field');
  });
});
