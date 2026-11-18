import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRootFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const readme = readRootFile('apps/cloud/README.md');
const deployDoc = readRootFile('docs/cloud-deploy.md');
const envExample = readRootFile('apps/cloud/.env.example');

describe('cloud deployment docs', () => {
  it('documents the implemented direct GitHub OAuth flow', () => {
    expect(readme).toMatch(/current auth flow exchanges GitHub OAuth\s+directly/);
    expect(deployDoc).toMatch(/current auth flow exchanges GitHub OAuth\s+directly/);
    expect(readme).toContain('/api/auth/github/callback');
    expect(deployDoc).toContain('/api/auth/github/callback');
  });

  it('does not present reserved Supabase Auth env as required for current deploys', () => {
    expect(readme).toContain('Reserved for future Supabase Auth integration');
    expect(deployDoc).toContain('Reserved for future Supabase Auth integration');
    expect(envExample).toContain('# Optional future Supabase Auth integration');
    const staleSupabaseBrowserEnvDescription =
      'Public Supabase project URL used by ' + 'browser-facing auth flows';
    const staleSupabaseRedirectHeading = 'Supabase redirect ' + 'URL';

    expect(readme).not.toContain(staleSupabaseBrowserEnvDescription);
    expect(deployDoc).not.toContain(staleSupabaseRedirectHeading);
  });

  it('does not present reserved session secrets as required for current deploys', () => {
    expect(readme).toContain('Reserved for future session management');
    expect(deployDoc).toContain('Reserved for future session management');
    expect(envExample).toContain('# SESSION_SECRET=');
    expect(readme).not.toContain('Secret used to sign application session cookies');
  });
});
