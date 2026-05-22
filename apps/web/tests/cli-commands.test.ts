import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_GITHUB_REPO,
  CLOUD_GLOBAL_COMMANDS,
  CLOUD_NPX_COMMANDS,
  COMMAND_BLOCK_LABELS,
  NPM_PACKAGE_NAME,
  SOURCE_VERIFY_COMMANDS,
  selfHostedBroadcastCommands,
} from '../lib/cli-commands';

const repoRoot = process.cwd();
const canonicalRepo = 'https://github.com/tianpeng-dev/nowcoding';
const canonicalCloneCommand = `git clone ${canonicalRepo}.git`;
const englishSocialFirstSentence =
  'NowCoding shows what builders are coding with AI right now, then turns that live activity into profiles, README cards, badges, and social proof.';
const chineseSocialFirstSentence =
  'NowCoding 展示开发者此刻正在用 AI 创作什么，并把这种实时状态变成主页、README 卡片、徽章和可传播的社交证明。';
const globalDaemonCommandBlock = CLOUD_GLOBAL_COMMANDS.join('\n');
const sourceVerifyBlock = SOURCE_VERIFY_COMMANDS.join('\n');

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as T;
}

function readTextFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

type PackageMetadata = {
  homepage: string;
  repository: {
    type: string;
    url: string;
    directory?: string;
  };
  bugs: {
    url: string;
  };
};

describe('CLI command contract', () => {
  it('uses the official GitHub repository and npm package', () => {
    expect(CANONICAL_GITHUB_REPO).toBe(canonicalRepo);
    expect(NPM_PACKAGE_NAME).toBe('nowcoding');
  });

  it('frames CLI setup as social presence broadcasting', () => {
    expect(COMMAND_BLOCK_LABELS).toEqual({
      primary: 'Start broadcasting your AI coding presence',
      oneShot: 'Share your current activity once',
      source: 'Verify from GitHub source',
    });
  });

  it('keeps daemon setup on the global binary path', () => {
    expect(CLOUD_GLOBAL_COMMANDS).toEqual([
      'npm install -g nowcoding',
      'nowcoding login',
      'nowcoding daemon install',
      'nowcoding daemon start',
      'nowcoding status',
    ]);
    expect(CLOUD_GLOBAL_COMMANDS.join('\n')).not.toContain('npx nowcoding daemon');
  });

  it('keeps one-shot npx sync separate from daemon setup', () => {
    expect(CLOUD_NPX_COMMANDS).toEqual(['npx nowcoding login', 'npx nowcoding sync']);
  });

  it('builds self-hosted broadcast commands for the current deployment', () => {
    expect(selfHostedBroadcastCommands('https://peng.vercel.app')).toEqual([
      'npm install -g nowcoding',
      'nowcoding init --endpoint https://peng.vercel.app',
      'nowcoding sync',
      'nowcoding daemon install',
      'nowcoding daemon start',
      'nowcoding status',
    ]);
  });

  it('documents source verification from GitHub', () => {
    expect(SOURCE_VERIFY_COMMANDS).toEqual([
      canonicalCloneCommand,
      'cd nowcoding',
      'corepack enable',
      'pnpm install',
      'pnpm --filter nowcoding build',
      'node apps/cli/bin/nowcoding.js --help',
    ]);
  });

  it('keeps package metadata on the current public GitHub repository', () => {
    const rootPackage = readJsonFile<PackageMetadata>('package.json');
    const cliPackage = readJsonFile<PackageMetadata>('apps/cli/package.json');

    expect(rootPackage.homepage).toBe(`${canonicalRepo}#readme`);
    expect(rootPackage.repository).toEqual({
      type: 'git',
      url: `git+${canonicalRepo}.git`,
    });
    expect(rootPackage.bugs.url).toBe(`${canonicalRepo}/issues`);

    expect(cliPackage.homepage).toBe(`${canonicalRepo}#readme`);
    expect(cliPackage.repository).toEqual({
      type: 'git',
      url: `git+${canonicalRepo}.git`,
      directory: 'apps/cli',
    });
    expect(cliPackage.bugs.url).toBe(`${canonicalRepo}/issues`);
  });

  it('keeps README daemon setup on global commands and source verification on the public repo', () => {
    for (const readmePath of ['README.md', 'README_zh.md', 'apps/cli/README.md']) {
      const readme = readTextFile(readmePath);

      expect(readme).toContain(globalDaemonCommandBlock);
      expect(readme).toContain(sourceVerifyBlock);
      expect(readme).not.toContain('npx nowcoding daemon');
    }
  });

  it('keeps README product introductions social-first', () => {
    expect(readTextFile('README.md')).toContain(englishSocialFirstSentence);
    expect(readTextFile('apps/cli/README.md')).toContain(englishSocialFirstSentence);
    expect(readTextFile('README_zh.md')).toContain(chineseSocialFirstSentence);
  });
});
