# Supported parsers

NowCoding v1.0 registers 18 parser sources. Support levels are explicit:
`full` means source-specific parser logic with tests, `generic` means
best-effort common JSONL parsing, and `disabled` means the source is registered
but skipped for safety or incomplete opt-in.

Every non-disabled parser source has fixture coverage. The fixture contract
does not make a `generic` parser source-specific; it proves that the source is
detected, scanned, privacy-sanitized, and parsed correctly when its logs match
the common JSONL usage shape.

| Source name | Default path under `~/` | Status | Notes |
|---|---|---|---|
| `claude-code` | `.claude/projects/` | ✅ full | Custom Anthropic shape, role-aware |
| `cursor` | n/a | ⛔ disabled | Requires local opt-in and parser implementation |
| `codex` | `.codex/sessions/` | ✅ full | Codex token_count events via last_token_usage |
| `gemini-cli` | `.gemini/tmp/*/chats/session-*.json` | ✅ full | Gemini CLI tmp chat JSON with tokens / usageMetadata |
| `github-copilot-cli` | `.copilot/session-state/*/events.jsonl` | ✅ full | Copilot CLI session.shutdown modelMetrics |
| `opencode` | `.local/share/opencode/opencode.db` + `storage/message/ses_*/*.json` | ✅ full | OpenCode SQLite message table and legacy JSON messages |
| `openclaw` | `.openclaw*/agents/*/sessions/*.jsonl` | ✅ full | OpenClaw assistant message usage aliases |
| `pi` | `.pi/agent/sessions/*/*.jsonl` | ✅ full | pi-coding-agent assistant message usage |
| `qwen-code` | `.qwen/tmp/*/chats/*.jsonl` | ✅ full | Qwen assistant usageMetadata with uuid dedupe |
| `kimi-code` | `.kimi/sessions/*/*/wire.jsonl` | ✅ full | Kimi StatusUpdate token_usage with model/project config |
| `amp` | `.local/share/amp/threads/T-*.json` | ✅ full | Amp usageLedger events and legacy message usage |
| `droid` | `.factory/sessions/*/*.jsonl` | ✅ full | Factory session settings tokenUsage |
| `hermes` | `.hermes/state.db` + `.hermes/profiles/*/state.db` | ✅ full | Hermes sessions SQLite token counters |
| `kiro` | `Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/dev_data/devdata.sqlite` + `tokens_generated.jsonl` | ✅ full | Kiro token DB, JSONL fallback, and `.chat` model timeline |
| `cline` | `Library/Application Support/*/User/globalStorage/saoudrizwan.claude-dev/` | ✅ full | Cline taskHistory + ui_messages api_req_started |
| `roo-code` | `Library/Application Support/*/User/globalStorage/rooveterinaryinc.roo-cline/` | ✅ full | Roo Code task index/history_item + ui_messages |
| `antigravity` | `.gemini/antigravity/conversations/*.pb` + running language server RPC | ✅ full | Cascade IDs from `.pb`, usage from `GetCascadeTrajectory` |
| `windsurf` | n/a | ⛔ disabled | No standalone reference parser or stable local token schema; Windsurf host data is covered by Cline/Roo Code |

## What "generic" means here

A generic parser:
- Exists in `packages/parsers/src/registry.ts`
- Has a sensible default `rootSubpath`
- Reads `*.jsonl` recursively under that path
- Parses common usage shapes: `{ timestamp, model, usage }` or
  `{ created_at, message: { model, role, usage } }`
- Has typical / edge / corrupt fixture coverage for the common JSONL contract
- Returns zero records gracefully when the path or jsonl shape doesn't match

If your tool's data shape is different, extend `JsonlParser` directly and
implement `toRecord()`. See [packages/parsers/src/claude-code.ts](../packages/parsers/src/claude-code.ts)
for an example.

## Adding a new parser

1. Create `packages/parsers/src/<source>.ts`:
   ```ts
   import { CommonJsonlParser } from './_base/common-jsonl-parser';
   import type { JsonlParserConfig } from './_base/jsonl-parser';

   export class MyToolParser extends CommonJsonlParser {
     readonly source = 'my-tool';
     readonly config: JsonlParserConfig = { rootSubpath: '.my-tool/sessions' };
   }
   ```
2. Register in `packages/parsers/src/index.ts` `allParsers()`.
3. Add at least 3 fixtures (typical / edge / corrupt) under
   `packages/parsers/tests/fixtures/<source>/`.
4. Write a unit test mirroring `tests/claude-code.test.ts`.

## Privacy

When `effectivePrivacy.uploadProject === false` (default), every parser's
project name is replaced with `unknown` *before* upload — see
`apps/cli/src/commands/sync.ts`.

Hostname follows the same AND logic and defaults to `unknown` when uploads are
disallowed.
