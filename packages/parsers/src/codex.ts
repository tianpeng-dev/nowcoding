import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import type { ParserContext, ParserResult } from './_base/base-parser';
import { JsonlParser, type JsonlParserConfig } from './_base/jsonl-parser';

export class CodexParser extends JsonlParser {
  readonly source = 'codex';
  readonly config: JsonlParserConfig = { rootSubpath: '.codex/sessions' };

  override async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, this.config.rootSubpath);
    const result: ParserResult = { source: this.source, records: [], errors: [] };

    const files = await walkJsonl(root, result);
    for (const file of files) {
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(file);
      } catch (e) {
        result.errors.push({ path: file, error: (e as Error).message });
        continue;
      }

      const cached = ctx.fileCache[file];
      if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) continue;
      ctx.scannedFiles.push({ path: file, mtime: stat.mtimeMs, size: stat.size });

      let raw: string;
      try {
        raw = await fs.readFile(file, 'utf8');
      } catch (e) {
        result.errors.push({ path: file, error: (e as Error).message });
        continue;
      }

      let currentModel = 'codex';
      let currentSessionId: string | undefined;
      let currentProject = this.sanitizeProject(
        this.deriveProject(path.relative(root, file)),
        ctx.allowProject,
      );

      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
          continue;
        }

        if (isCodexSessionMeta(json)) {
          currentSessionId = json.payload.id;
          currentProject = this.sanitizeProject(projectFromCwd(json.payload.cwd), ctx.allowProject);
          continue;
        }
        if (isCodexTurnContext(json)) {
          currentModel = json.payload.model;
          currentProject = this.sanitizeProject(projectFromCwd(json.payload.cwd), ctx.allowProject);
          continue;
        }

        const rec = this.toRecord(json, currentProject, currentModel, currentSessionId);
        if (rec) result.records.push(rec);
      }
    }

    return result;
  }

  protected toRecord(
    line: unknown,
    project: string,
    model = 'codex',
    sessionId?: string,
  ): MessageRecord | null {
    if (!isCodexTokenCountEvent(line)) return null;

    const ts = new Date(line.timestamp);
    if (Number.isNaN(ts.getTime())) return null;

    const usage = line.payload.info.last_token_usage;
    const cachedInputTokens = usage.cached_input_tokens ?? 0;
    const reasoningOutputTokens = usage.reasoning_output_tokens ?? 0;
    const inputTokens = subtractIncludedTokens(usage.input_tokens, cachedInputTokens);
    const outputTokens = subtractIncludedTokens(usage.output_tokens, reasoningOutputTokens);

    if (
      inputTokens === 0 &&
      outputTokens === 0 &&
      cachedInputTokens === 0 &&
      reasoningOutputTokens === 0
    ) {
      return null;
    }

    return {
      source: this.source,
      model,
      project,
      timestamp: ts,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens,
      sessionId,
    };
  }
}

async function walkJsonl(dir: string, result: ParserResult): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      result.errors.push({ path: dir, error: err.message });
    }
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkJsonl(full, result)));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      out.push(full);
    }
  }
  return out;
}

function subtractIncludedTokens(total: number, included: number): number {
  return Math.max(0, total - included);
}

function projectFromCwd(cwd: string): string {
  return path.basename(cwd) || 'unknown';
}

function isCodexSessionMeta(line: unknown): line is CodexSessionMeta {
  if (!line || typeof line !== 'object') return false;
  const event = line as Partial<CodexSessionMeta>;
  return (
    event.type === 'session_meta' &&
    !!event.payload &&
    typeof event.payload === 'object' &&
    typeof event.payload.id === 'string' &&
    typeof event.payload.cwd === 'string'
  );
}

function isCodexTurnContext(line: unknown): line is CodexTurnContext {
  if (!line || typeof line !== 'object') return false;
  const event = line as Partial<CodexTurnContext>;
  return (
    event.type === 'turn_context' &&
    !!event.payload &&
    typeof event.payload === 'object' &&
    typeof event.payload.model === 'string' &&
    typeof event.payload.cwd === 'string'
  );
}

function isCodexTokenCountEvent(line: unknown): line is CodexTokenCountEvent {
  if (!line || typeof line !== 'object') return false;
  const event = line as Partial<CodexTokenCountEvent>;
  if (event.type !== 'event_msg' || typeof event.timestamp !== 'string') return false;
  const payload = event.payload;
  if (!payload || typeof payload !== 'object' || payload.type !== 'token_count') return false;
  const info = payload.info;
  if (!info || typeof info !== 'object') return false;
  return isCodexUsage(info.last_token_usage);
}

function isCodexUsage(usage: unknown): usage is CodexUsage {
  if (!usage || typeof usage !== 'object') return false;
  const u = usage as Partial<CodexUsage>;
  return (
    isNonNegativeInteger(u.input_tokens) &&
    isNonNegativeInteger(u.output_tokens) &&
    (u.cached_input_tokens === undefined || isNonNegativeInteger(u.cached_input_tokens)) &&
    (u.reasoning_output_tokens === undefined || isNonNegativeInteger(u.reasoning_output_tokens))
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

interface CodexTokenCountEvent {
  timestamp: string;
  type: 'event_msg';
  payload: {
    type: 'token_count';
    info: {
      last_token_usage: CodexUsage;
    };
  };
}

interface CodexSessionMeta {
  type: 'session_meta';
  payload: {
    id: string;
    cwd: string;
  };
}

interface CodexTurnContext {
  type: 'turn_context';
  payload: {
    model: string;
    cwd: string;
  };
}

interface CodexUsage {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
  reasoning_output_tokens?: number;
}
