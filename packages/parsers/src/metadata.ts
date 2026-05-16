export type ParserSupportStatus = 'full' | 'partial' | 'generic' | 'disabled';
export type ParserDataKind = 'jsonl' | 'json' | 'sqlite' | 'csv-api' | 'mixed';

export interface ParserMetadata {
  source: string;
  displayName: string;
  status: ParserSupportStatus;
  dataKind: ParserDataKind;
  fixtureNames?: string[];
  defaultLocations: string[];
  privacyNotes: string;
  implementationNotes: string;
}

export const parserMetadata: ParserMetadata[] = [
  {
    source: 'claude-code',
    displayName: 'Claude Code',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.claude/projects/'],
    privacyNotes: 'Project names are sanitized unless project upload is enabled.',
    implementationNotes: 'Custom Anthropic message.usage parser.',
  },
  {
    source: 'cursor',
    displayName: 'Cursor',
    status: 'disabled',
    dataKind: 'mixed',
    defaultLocations: ['~/Library/Application Support/Cursor/User/globalStorage/state.vscdb'],
    privacyNotes: 'Disabled until explicit local opt-in is implemented.',
    implementationNotes: 'Requires separate opt-in and local parser work.',
  },
  {
    source: 'codex',
    displayName: 'Codex',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.codex/sessions/'],
    privacyNotes: 'Project can be derived from cwd only when project upload is enabled.',
    implementationNotes: 'Custom token_count parser using last_token_usage.',
  },
  {
    source: 'gemini-cli',
    displayName: 'Gemini CLI',
    status: 'full',
    dataKind: 'json',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: ['~/.gemini/tmp/*/chats/session-*.json'],
    privacyNotes: 'Gemini CLI tmp session paths are not uploaded; project remains unknown.',
    implementationNotes:
      'Custom Gemini CLI tmp chat parser for messages/history arrays with tokens and usageMetadata.',
  },
  {
    source: 'github-copilot-cli',
    displayName: 'GitHub Copilot CLI',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.copilot/session-state/*/events.jsonl'],
    privacyNotes: 'Project is derived from session context only when project upload is enabled.',
    implementationNotes: 'Custom session.shutdown modelMetrics parser.',
  },
  {
    source: 'opencode',
    displayName: 'OpenCode',
    status: 'full',
    dataKind: 'mixed',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: [
      '~/.local/share/opencode/opencode.db',
      '~/.local/share/opencode/storage/message/ses_*/*.json',
    ],
    privacyNotes: 'Project is derived from message root path only when project upload is enabled.',
    implementationNotes: 'Custom OpenCode SQLite message table parser with legacy JSON fallback.',
  },
  {
    source: 'openclaw',
    displayName: 'OpenClaw',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.openclaw*/agents/*/sessions/*.jsonl'],
    privacyNotes: 'Project is derived from agent id only when project upload is enabled.',
    implementationNotes: 'Custom OpenClaw agent session parser with usage field aliases.',
  },
  {
    source: 'pi',
    displayName: 'pi',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.pi/agent/sessions/*/*.jsonl'],
    privacyNotes: 'Project is derived from session cwd only when project upload is enabled.',
    implementationNotes: 'Custom pi-coding-agent session/message usage parser.',
  },
  {
    source: 'qwen-code',
    displayName: 'Qwen Code',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.qwen/tmp/*/chats/*.jsonl'],
    privacyNotes:
      'Project is derived from cwd or tmp project id only when project upload is enabled.',
    implementationNotes:
      'Custom Gemini CLI fork parser for assistant usageMetadata with uuid dedupe.',
  },
  {
    source: 'kimi-code',
    displayName: 'Kimi Code',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.kimi/sessions/*/*/wire.jsonl'],
    privacyNotes: 'Project is mapped from ~/.kimi/kimi.json only when project upload is enabled.',
    implementationNotes:
      'Custom Kimi wire StatusUpdate parser with config.toml model fallback and message_id dedupe.',
  },
  {
    source: 'amp',
    displayName: 'Amp',
    status: 'full',
    dataKind: 'json',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: ['~/.local/share/amp/threads/T-*.json'],
    privacyNotes: 'Amp thread parser does not emit project names.',
    implementationNotes:
      'Custom Amp thread parser for usageLedger events and legacy message usage.',
  },
  {
    source: 'droid',
    displayName: 'Droid',
    status: 'full',
    dataKind: 'jsonl',
    defaultLocations: ['~/.factory/sessions/*/*.jsonl'],
    privacyNotes:
      'Project is derived from Factory session slug only when project upload is enabled.',
    implementationNotes: 'Custom Factory session settings tokenUsage parser.',
  },
  {
    source: 'hermes',
    displayName: 'Hermes',
    status: 'full',
    dataKind: 'sqlite',
    fixtureNames: ['typical.sql', 'edge.sql', 'corrupt.sql'],
    defaultLocations: ['~/.hermes/state.db', '~/.hermes/profiles/*/state.db'],
    privacyNotes:
      'Project is derived from Hermes profile name only when project upload is enabled.',
    implementationNotes: 'Custom Hermes sessions table parser for local state.db token counters.',
  },
  {
    source: 'kiro',
    displayName: 'Kiro',
    status: 'full',
    dataKind: 'mixed',
    fixtureNames: ['typical.sql', 'edge.jsonl', 'corrupt.jsonl'],
    defaultLocations: [
      '~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/dev_data/devdata.sqlite',
      '~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/dev_data/tokens_generated.jsonl',
    ],
    privacyNotes:
      'Kiro parser emits unknown project; .chat files are read only for model metadata.',
    implementationNotes:
      'Custom Kiro tokens_generated SQLite parser with JSONL fallback and .chat model timeline.',
  },
  {
    source: 'cline',
    displayName: 'Cline',
    status: 'full',
    dataKind: 'json',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: [
      '~/Library/Application Support/*/User/globalStorage/saoudrizwan.claude-dev/',
    ],
    privacyNotes: 'Project is derived from task cwd only when project upload is enabled.',
    implementationNotes: 'Custom Cline taskHistory + ui_messages api_req_started parser.',
  },
  {
    source: 'roo-code',
    displayName: 'Roo Code',
    status: 'full',
    dataKind: 'json',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: [
      '~/Library/Application Support/*/User/globalStorage/rooveterinaryinc.roo-cline/',
    ],
    privacyNotes: 'Project is derived from task workspace only when project upload is enabled.',
    implementationNotes: 'Custom Roo Code task index/history_item + ui_messages parser.',
  },
  {
    source: 'antigravity',
    displayName: 'Antigravity',
    status: 'full',
    dataKind: 'mixed',
    fixtureNames: ['typical.json', 'edge.json', 'corrupt.txt'],
    defaultLocations: ['~/.gemini/antigravity/conversations/*.pb'],
    privacyNotes:
      'Project is derived from Antigravity workspace metadata only when project upload is enabled.',
    implementationNotes:
      'Custom Antigravity cascade parser that uses the running language server GetCascadeTrajectory RPC.',
  },
  {
    source: 'windsurf',
    displayName: 'Windsurf',
    status: 'disabled',
    dataKind: 'mixed',
    defaultLocations: ['~/.codeium/windsurf/cascade/', '~/Library/Application Support/Windsurf/'],
    privacyNotes:
      'Disabled because no stable local token usage schema is available; Windsurf as a VSCode host is covered by Cline/Roo Code parsers.',
    implementationNotes:
      'vibe-usage does not ship a standalone Windsurf token parser; do not treat speculative JSONL as usage.',
  },
];
