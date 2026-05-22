export const CANONICAL_GITHUB_REPO = 'https://github.com/tianpeng-dev/nowcoding';
export const CANONICAL_GIT_CLONE_URL = `${CANONICAL_GITHUB_REPO}.git`;
export const NPM_PACKAGE_NAME = 'nowcoding';

export const COMMAND_BLOCK_LABELS = {
  primary: 'Start broadcasting your AI coding presence',
  oneShot: 'Share your current activity once',
  source: 'Verify from GitHub source',
} as const;

export const CLOUD_GLOBAL_COMMANDS = [
  `npm install -g ${NPM_PACKAGE_NAME}`,
  'nowcoding login',
  'nowcoding daemon install',
  'nowcoding daemon start',
  'nowcoding status',
] as const;

export const CLOUD_NPX_COMMANDS = ['npx nowcoding login', 'npx nowcoding sync'] as const;

export function selfHostedBroadcastCommands(endpointUrl: string): string[] {
  return [
    `npm install -g ${NPM_PACKAGE_NAME}`,
    `nowcoding init --endpoint ${endpointUrl}`,
    'nowcoding sync',
    'nowcoding daemon install',
    'nowcoding daemon start',
    'nowcoding status',
  ];
}

export const SOURCE_VERIFY_COMMANDS = [
  `git clone ${CANONICAL_GIT_CLONE_URL}`,
  'cd nowcoding',
  'corepack enable',
  'pnpm install',
  'pnpm --filter nowcoding build',
  'node apps/cli/bin/nowcoding.js --help',
] as const;
