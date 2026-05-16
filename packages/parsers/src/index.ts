import type { BaseParser } from './_base/base-parser';
import { AmpParser } from './amp';
import { AntigravityParser } from './antigravity';
import { ClaudeCodeParser } from './claude-code';
import { ClineParser } from './cline';
import { CodexParser } from './codex';
import { CursorParser } from './cursor';
import { DroidParser } from './droid';
import { GeminiCliParser } from './gemini-cli';
import { GithubCopilotCliParser } from './github-copilot-cli';
import { HermesParser } from './hermes';
import { KimiCodeParser } from './kimi-code';
import { KiroParser } from './kiro';
import { OpenClawParser } from './openclaw';
import { OpenCodeParser } from './opencode';
import { PiParser } from './pi';
import { QwenCodeParser } from './qwen-code';
import { RooCodeParser } from './roo-code';
import { WindsurfParser } from './windsurf';

export { BaseParser } from './_base/base-parser';
export type { ParserContext, ParserResult } from './_base/base-parser';
export { JsonlParser } from './_base/jsonl-parser';
export { CommonJsonlParser } from './_base/common-jsonl-parser';
export { AmpParser } from './amp';
export { AntigravityParser } from './antigravity';
export { ClaudeCodeParser } from './claude-code';
export { ClineParser } from './cline';
export { CodexParser } from './codex';
export { CursorParser } from './cursor';
export { DroidParser } from './droid';
export { GeminiCliParser } from './gemini-cli';
export { GithubCopilotCliParser } from './github-copilot-cli';
export { HermesParser } from './hermes';
export { KimiCodeParser } from './kimi-code';
export { KiroParser } from './kiro';
export { OpenCodeParser } from './opencode';
export { OpenClawParser } from './openclaw';
export { PiParser } from './pi';
export { QwenCodeParser } from './qwen-code';
export { RooCodeParser } from './roo-code';
export { WindsurfParser } from './windsurf';
export { parserMetadata } from './metadata';
export type { ParserDataKind, ParserMetadata, ParserSupportStatus } from './metadata';

// 18 registered parsers. Order matters only for predictable diagnostics.
export function allParsers(): BaseParser[] {
  return [
    new ClaudeCodeParser(),
    new CursorParser(),
    new CodexParser(),
    new GeminiCliParser(),
    new GithubCopilotCliParser(),
    new OpenCodeParser(),
    new OpenClawParser(),
    new PiParser(),
    new QwenCodeParser(),
    new KimiCodeParser(),
    new AmpParser(),
    new DroidParser(),
    new HermesParser(),
    new KiroParser(),
    new ClineParser(),
    new RooCodeParser(),
    new AntigravityParser(),
    new WindsurfParser(),
  ];
}
