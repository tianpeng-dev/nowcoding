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

describe('Vercel build boundaries', () => {
  it('keeps database-backed route handlers on the Node runtime', () => {
    for (const route of dbBackedRoutes) {
      const source = readFileSync(route, 'utf8');

      expect(source, route).not.toMatch(/export const runtime = ['"]edge['"]/);
    }
  });

  it('imports engagement helpers without pulling in the core package barrel', () => {
    const source = readFileSync('apps/web/lib/public-surface.ts', 'utf8');
    const corePackageJson = JSON.parse(readFileSync('packages/core/package.json', 'utf8')) as {
      exports: Record<string, string>;
    };

    expect(source).toContain("from '@nowcoding/core/engagement'");
    expect(source).not.toContain("from '@nowcoding/core'");
    expect(corePackageJson.exports['./engagement']).toBe('./src/engagement.ts');
  });
});
