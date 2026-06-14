import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dbBackedRoutes = [
  'apps/web/app/api/heatmap/route.ts',
  'apps/web/app/api/now/route.ts',
  'apps/web/app/api/stats/route.ts',
  'apps/web/app/badge/[type]/route.tsx',
  'apps/web/app/card.svg/route.tsx',
  'apps/web/app/card/route.tsx',
];

const localeDynamicPages = [
  'apps/web/app/[locale]/page.tsx',
  'apps/web/app/[locale]/setup/page.tsx',
  'apps/web/app/[locale]/usage/page.tsx',
];

describe('Vercel build boundaries', () => {
  it('keeps database-backed route handlers on the Node runtime', () => {
    for (const route of dbBackedRoutes) {
      const source = readFileSync(route, 'utf8');

      expect(source, route).not.toMatch(/export const runtime = ['"]edge['"]/);
    }
  });

  it('imports core schemas without pulling in the core package barrel', () => {
    const source = readFileSync('apps/web/lib/public-surface.ts', 'utf8');
    const corePackageJson = JSON.parse(readFileSync('packages/core/package.json', 'utf8')) as {
      exports: Record<string, string>;
    };

    expect(source).toContain("from '@nowcoding/core/schemas'");
    expect(source).not.toContain("from '@nowcoding/core'");
    expect(corePackageJson.exports['./schemas']).toBe('./src/schemas.ts');
  });

  it('keeps localized database-backed pages dynamic', () => {
    for (const page of localeDynamicPages) {
      const source = readFileSync(page, 'utf8');

      expect(source, page).toContain("export const dynamic = 'force-dynamic'");
      expect(source, page).toContain('export const revalidate = 0');
    }
  });

  it('does not pin every HTML document to the default locale', () => {
    const source = readFileSync('apps/web/app/layout.tsx', 'utf8');

    expect(source).toContain("import { getLocale } from 'next-intl/server'");
    expect(source).toContain('lang={locale}');
    expect(source).not.toContain('lang="en"');
    expect(source).not.toContain('lang={routing.defaultLocale}');
  });
});
