import { type ArenaOptions, runArena } from './commands/arena.js';
import { type DaemonOptions, runDaemon } from './commands/daemon.js';
import { runDoctor } from './commands/doctor.js';
import { runGenToken } from './commands/gen-token.js';
import { type HeartbeatOptions, runHeartbeat } from './commands/heartbeat.js';
import { type InitOptions, runInit } from './commands/init.js';
import { type LoginOptions, runLogin } from './commands/login.js';
import { runStatus } from './commands/status.js';
import { type SyncOptions, runSync } from './commands/sync.js';
import { installProxyDispatcher } from './lib/proxy.js';

const VERSION = '0.0.0';

const HELP = `nowcoding ${VERSION}

Usage:
  nowcoding init [--endpoint <url>] [--token <token>] [--hostname <name>]
  nowcoding sync [--dry-run] [--source <name>] [--strict] [--watch] [--watch-interval <ms>]
  nowcoding daemon [foreground|status|install|start|stop|restart|uninstall] [--interval-ms <ms>] [--bin <path>]
  nowcoding heartbeat [--source <name>] [--model <name>] [--project <name>]
  nowcoding login [--no-arena]
  nowcoding arena [status|connect|disconnect]
  nowcoding gen-token
  nowcoding doctor
  nowcoding status
  nowcoding --help
  nowcoding --version
`;

interface Parsed {
  command: string | undefined;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

function parseArgs(argv: string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else if (!command) {
      command = a;
    } else {
      positionals.push(a);
    }
  }
  return { command, flags, positionals };
}

export async function main(argv: string[]): Promise<void> {
  installProxyDispatcher();
  const { command, flags, positionals } = parseArgs(argv);

  if (flags.version || flags.v || command === 'version') {
    console.log(VERSION);
    return;
  }
  if (flags.help || flags.h || !command || command === 'help') {
    console.log(HELP);
    return;
  }

  try {
    switch (command) {
      case 'init':
        await runInit({
          endpoint: typeof flags.endpoint === 'string' ? flags.endpoint : undefined,
          token: typeof flags.token === 'string' ? flags.token : undefined,
          hostname: typeof flags.hostname === 'string' ? flags.hostname : undefined,
          yes: flags.yes === true,
        } satisfies InitOptions);
        break;
      case 'sync':
        await runSync({
          dryRun: flags['dry-run'] === true,
          source: typeof flags.source === 'string' ? flags.source : undefined,
          strict: flags.strict === true,
          watch: flags.watch === true,
          watchIntervalMs:
            typeof flags['watch-interval'] === 'string'
              ? Number(flags['watch-interval'])
              : undefined,
        } satisfies SyncOptions);
        break;
      case 'daemon':
        await runDaemon({
          action: positionals[0],
          intervalMs:
            typeof flags['interval-ms'] === 'string' ? Number(flags['interval-ms']) : undefined,
          binPath: typeof flags.bin === 'string' ? flags.bin : undefined,
        } satisfies DaemonOptions);
        break;
      case 'heartbeat':
        await runHeartbeat({
          source: typeof flags.source === 'string' ? flags.source : undefined,
          model: typeof flags.model === 'string' ? flags.model : undefined,
          project: typeof flags.project === 'string' ? flags.project : undefined,
        } satisfies HeartbeatOptions);
        break;
      case 'login':
        await runLogin({
          ...(flags['no-arena'] === true ? { arena: false } : {}),
        } satisfies LoginOptions);
        break;
      case 'arena':
        await runArena({
          action: positionals[0],
        } satisfies ArenaOptions);
        break;
      case 'gen-token':
        runGenToken();
        break;
      case 'doctor':
        await runDoctor();
        break;
      case 'status':
        await runStatus();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (e) {
    console.error('[nowcoding]', (e as Error).message);
    process.exit(1);
  }
}
