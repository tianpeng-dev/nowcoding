import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

const script = new URL('./seed-smoke-data.mjs', import.meta.url).pathname;

describe('seed-smoke-data', () => {
  test('rejects missing base URL before reading token values', () => {
    const result = runSeed({});

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Set NOWCODING_SMOKE_BASE_URL');
  });

  test('rejects malformed smoke tokens without making network requests', () => {
    const result = runSeed({
      NOWCODING_SMOKE_BASE_URL: 'https://nowcoding.example.test',
      NOWCODING_SMOKE_TOKEN: 'not-a-token',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NOWCODING_SMOKE_TOKEN is invalid');
    expect(result.stderr).not.toContain('POST /api/usage/ingest');
  });
});

function runSeed(env) {
  return spawnSync(process.execPath, [script], {
    env: {
      PATH: process.env.PATH,
      NODE_PATH: process.env.NODE_PATH,
      ...env,
    },
    encoding: 'utf8',
  });
}
