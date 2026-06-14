import { describe, expect, it } from 'vitest';
import {
  SETUP_PARSER_SOURCES,
  type SetupStatusMessages,
  buildSetupStatus,
  resolvePublicOrigin,
} from '../lib/setup-status';

const zhMessages = {
  primaryActionLabel: '开始广播',
  statusCards: {
    database: {
      label: '数据库',
      ready: 'DATABASE_URL 已配置。不要暴露连接字符串。',
      missing: '缺少 DATABASE_URL。添加 Supabase Postgres pooler URL 后重新部署。',
    },
    token: {
      label: 'API token',
      ready: 'NOWCODING_API_TOKEN 已配置。设置页面永远不会展示它。',
      missing: '缺少 NOWCODING_API_TOKEN。请在本地生成并添加到 Vercel。',
      malformed: 'NOWCODING_API_TOKEN 格式不正确。请用 npx nowcoding gen-token 重新生成。',
    },
    endpoint: {
      label: '端点',
    },
    profile: {
      label: '主页',
      default: 'NOWCODING_USERNAME 仍在使用默认值。请设置你的公开 handle。',
      configured: '公开 handle 为 {username}。',
    },
  },
  privacyRows: {
    projectNames: '项目名称',
    hostname: '主机名',
    estimatedCost: '预估成本',
    liveStatus: '实时状态',
    uploadedWhenAllowed: '本地配置允许时上传',
    hidden: '隐藏',
    hiddenPublicly: '公开隐藏',
    visibleAsEstimated: '以预估值展示',
    visible: '可见',
  },
} satisfies SetupStatusMessages;

describe('setup status view model', () => {
  it('uses explicit website url before Vercel system urls', () => {
    expect(
      resolvePublicOrigin({
        websiteUrl: 'https://now.example.com/',
        vercelProjectProductionUrl: 'nowcoding.vercel.app',
        vercelUrl: 'preview.vercel.app',
      }),
    ).toBe('https://now.example.com');
  });

  it('falls back to Vercel production and preview urls with https', () => {
    expect(resolvePublicOrigin({ vercelProjectProductionUrl: 'prod.vercel.app' })).toBe(
      'https://prod.vercel.app',
    );
    expect(resolvePublicOrigin({ vercelUrl: 'preview.vercel.app' })).toBe(
      'https://preview.vercel.app',
    );
    expect(resolvePublicOrigin({})).toBe('http://localhost:3000');
  });

  it('rejects non-web website urls before falling back', () => {
    expect(
      resolvePublicOrigin({
        websiteUrl: 'javascript:alert(1)',
        vercelProjectProductionUrl: 'prod.vercel.app',
      }),
    ).toBe('https://prod.vercel.app');

    expect(resolvePublicOrigin({ websiteUrl: 'mailto:peng@example.com' })).toBe(
      'http://localhost:3000',
    );
  });

  it('rejects unsafe Vercel host strings', () => {
    expect(
      resolvePublicOrigin({
        vercelProjectProductionUrl: 'preview.vercel.app --flag',
        vercelUrl: 'safe-preview.vercel.app',
      }),
    ).toBe('https://safe-preview.vercel.app');

    expect(resolvePublicOrigin({ vercelUrl: 'preview.vercel.app?x=1' })).toBe(
      'http://localhost:3000',
    );
  });

  it('normalizes uppercase HTTPS scheme for Vercel urls', () => {
    expect(resolvePublicOrigin({ vercelUrl: 'HTTPS://PREVIEW.VERCEL.APP/path' })).toBe(
      'https://preview.vercel.app',
    );
  });

  it('builds setup commands without exposing the real token', () => {
    const setup = buildSetupStatus({
      env: {
        DATABASE_URL: 'postgres://example',
        NOWCODING_USERNAME: 'peng',
        NOWCODING_API_TOKEN: `nc_live_${'A'.repeat(32)}`,
        NOWCODING_WEBSITE_URL: 'https://peng.vercel.app',
        NOWCODING_SHOW_COST: true,
        NOWCODING_SHOW_LIVE: false,
        NOWCODING_UPLOAD_PROJECT: false,
        NOWCODING_UPLOAD_HOSTNAME: true,
      },
      vercel: {},
    });

    expect(setup.endpointUrl).toBe('https://peng.vercel.app');
    expect(setup.dashboardUrl).toBe('https://vercel.com/dashboard');
    expect(setup).not.toHaveProperty('cliInitCommand');
    expect(setup).not.toHaveProperty('syncCommand');
    expect(setup).not.toHaveProperty('heartbeatCommand');
    expect(setup).not.toHaveProperty('watchCommand');
    expect(setup.primaryActionLabel).toBe('Start broadcasting');
    expect(setup.primaryCommands).toEqual([
      'npm install -g nowcoding',
      'nowcoding init --endpoint https://peng.vercel.app',
      'nowcoding sync',
      'nowcoding daemon install',
      'nowcoding daemon start',
      'nowcoding status',
    ]);
    expect(setup.sourceCommands[0]).toBe('git clone https://github.com/tianpeng-dev/nowcoding.git');
    expect(JSON.stringify(setup)).not.toContain('<YOUR_TOKEN>');
    expect(JSON.stringify(setup)).not.toContain('--token');
    expect(JSON.stringify(setup)).not.toContain(`nc_live_${'A'.repeat(32)}`);
    expect(setup.statusCards).toContainEqual({
      key: 'token',
      label: 'API token',
      ok: true,
      detail: 'NOWCODING_API_TOKEN is configured. The setup page never displays it.',
    });
  });

  it('marks malformed API tokens as not ready', () => {
    const setup = buildSetupStatus({
      env: {
        NOWCODING_API_TOKEN: 'nc_live_short',
      },
      vercel: {},
    });

    expect(setup.statusCards).toContainEqual({
      key: 'token',
      label: 'API token',
      ok: false,
      detail: 'NOWCODING_API_TOKEN is malformed. Generate a new one with npx nowcoding gen-token.',
    });
  });

  it('marks missing deployment requirements', () => {
    const setup = buildSetupStatus({
      env: {
        NOWCODING_USERNAME: 'alice',
        NOWCODING_SHOW_COST: true,
        NOWCODING_SHOW_LIVE: true,
        NOWCODING_UPLOAD_PROJECT: false,
        NOWCODING_UPLOAD_HOSTNAME: true,
      },
      vercel: {},
    });

    expect(setup.statusCards).toEqual([
      {
        key: 'database',
        label: 'Database',
        ok: false,
        detail: 'DATABASE_URL is missing. Add a Supabase Postgres pooler URL, then redeploy.',
      },
      {
        key: 'token',
        label: 'API token',
        ok: false,
        detail: 'NOWCODING_API_TOKEN is missing. Generate one locally and add it in Vercel.',
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        ok: false,
        detail: 'http://localhost:3000',
      },
      {
        key: 'profile',
        label: 'Profile',
        ok: false,
        detail: 'NOWCODING_USERNAME is using the default value. Set your public handle.',
      },
    ]);
  });

  it('shows the privacy posture rows', () => {
    const setup = buildSetupStatus({
      env: {
        NOWCODING_UPLOAD_PROJECT: false,
        NOWCODING_UPLOAD_HOSTNAME: true,
        NOWCODING_SHOW_COST: false,
        NOWCODING_SHOW_LIVE: false,
      },
      vercel: {},
    });

    expect(setup.privacyRows).toEqual([
      { label: 'Project names', value: 'hidden' },
      { label: 'Hostname', value: 'uploaded when local config allows' },
      { label: 'Estimated cost', value: 'hidden publicly' },
      { label: 'Live status', value: 'hidden publicly' },
    ]);
  });

  it('uses locale-aware setup copy when supplied', () => {
    const setup = buildSetupStatus({
      env: {
        DATABASE_URL: 'postgres://example',
        NOWCODING_USERNAME: 'peng',
        NOWCODING_API_TOKEN: `nc_live_${'A'.repeat(32)}`,
        NOWCODING_UPLOAD_PROJECT: true,
      },
      vercel: {},
      messages: zhMessages,
    });

    expect(setup.primaryActionLabel).toBe('开始广播');
    expect(setup.statusCards).toContainEqual({
      key: 'profile',
      label: '主页',
      ok: true,
      detail: '公开 handle 为 peng。',
    });
    expect(setup.privacyRows[0]).toEqual({
      label: '项目名称',
      value: '本地配置允许时上传',
    });
    expect(setup.primaryCommands).toContain('nowcoding sync');
  });

  it('lists all v1 parsers in registry order as waiting', () => {
    const setup = buildSetupStatus({
      env: {},
      vercel: {},
    });

    expect(SETUP_PARSER_SOURCES).toEqual([
      'claude-code',
      'cursor',
      'codex',
      'gemini-cli',
      'github-copilot-cli',
      'opencode',
      'openclaw',
      'pi',
      'qwen-code',
      'kimi-code',
      'amp',
      'droid',
      'hermes',
      'kiro',
      'cline',
      'roo-code',
      'antigravity',
      'windsurf',
    ]);
    expect(setup.parsers).toEqual(
      SETUP_PARSER_SOURCES.map((source) => ({
        source,
        status: 'waiting',
      })),
    );
  });
});
