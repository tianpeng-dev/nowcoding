import { describe, expect, it } from 'vitest';
import { getOwnerProfileFromEnv, getServerPrivacyFromEnv, parseEnv } from '../lib/env';

describe('web env config', () => {
  it('parses owner timezone and v1 privacy settings', () => {
    const input: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      NOWCODING_USERNAME: 'peng',
      NOWCODING_TIMEZONE: 'Asia/Shanghai',
      NOWCODING_UPLOAD_PROJECT: 'false',
      NOWCODING_UPLOAD_HOSTNAME: 'true',
      NOWCODING_SHOW_COST: 'true',
      NOWCODING_SHOW_LIVE: 'false',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example',
    };
    const env = parseEnv(input);

    expect(env.NOWCODING_TIMEZONE).toBe('Asia/Shanghai');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://project-ref.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_example');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('sb_secret_example');
    expect(getOwnerProfileFromEnv(env)).toMatchObject({
      username: 'peng',
      timezone: 'Asia/Shanghai',
    });
    expect(getServerPrivacyFromEnv(env)).toEqual({
      uploadProject: false,
      uploadHostname: true,
      showCost: true,
      showLive: false,
    });
  });

  it('preserves valid privacy settings when an optional URL is invalid', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      NOWCODING_WEBSITE_URL: 'not-a-url',
      NOWCODING_UPLOAD_HOSTNAME: 'false',
      NOWCODING_SHOW_COST: 'false',
      NOWCODING_SHOW_LIVE: 'false',
    });

    expect(getServerPrivacyFromEnv(env)).toEqual({
      uploadProject: false,
      uploadHostname: false,
      showCost: false,
      showLive: false,
    });
  });

  it('treats malformed API tokens as missing', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      NOWCODING_API_TOKEN: `nc_live_${'A'.repeat(31)}=`,
    });

    expect(env.NOWCODING_API_TOKEN).toBeUndefined();
  });
});
