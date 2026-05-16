import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@nowcoding\/core$/,
        replacement: new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@nowcoding\/core\/(.+)$/,
        replacement: new URL('./packages/core/src/$1.ts', import.meta.url).pathname,
      },
    ],
  },
  test: {
    globals: false,
    environment: 'node',
    include: [
      'packages/*/tests/**/*.test.ts',
      'apps/*/tests/**/*.test.ts',
      'scripts/**/*.test.mjs',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/types.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
