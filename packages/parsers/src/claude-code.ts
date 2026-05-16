import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Claude Code stores per-project session jsonl logs under
// ~/.claude/projects/<encoded-project>/<session>.jsonl
// W3 will expand this with the full vibe-usage rules; W1 keeps it minimal.
export class ClaudeCodeParser extends BaseParser {
  readonly source = 'claude-code';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(ctx.homeDir, '.claude', 'projects'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, '.claude', 'projects');
    const result: ParserResult = { source: this.source, records: [], errors: [] };

    let projectDirs: string[];
    try {
      projectDirs = await fs.readdir(root);
    } catch {
      return result;
    }

    for (const dir of projectDirs) {
      const dirPath = path.join(root, dir);
      let entries: string[];
      try {
        entries = await fs.readdir(dirPath);
      } catch (e) {
        result.errors.push({ path: dirPath, error: (e as Error).message });
        continue;
      }
      for (const file of entries) {
        if (!file.endsWith('.jsonl')) continue;
        const filePath = path.join(dirPath, file);
        let stat: Awaited<ReturnType<typeof fs.stat>>;
        try {
          stat = await fs.stat(filePath);
        } catch (e) {
          result.errors.push({ path: filePath, error: (e as Error).message });
          continue;
        }

        // P1-1: skip unchanged files based on per-file mtime+size cache.
        const cached = ctx.fileCache[filePath];
        const mtime = stat.mtimeMs;
        const size = stat.size;
        if (cached && cached.mtime === mtime && cached.size === size) {
          continue;
        }
        ctx.scannedFiles.push({ path: filePath, mtime, size });

        let raw: string;
        try {
          raw = await fs.readFile(filePath, 'utf8');
        } catch (e) {
          result.errors.push({ path: filePath, error: (e as Error).message });
          continue;
        }
        const project = this.sanitizeProject(dir, ctx.allowProject);
        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim()) continue;
          let entry: ClaudeJsonlLine;
          try {
            entry = JSON.parse(line) as ClaudeJsonlLine;
          } catch (e) {
            result.errors.push({ path: filePath, error: `parse: ${(e as Error).message}` });
            continue;
          }
          const rec = toRecord(entry, this.source, project);
          if (rec) result.records.push(rec);
        }
      }
    }
    return result;
  }
}

interface ClaudeJsonlLine {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    model?: string;
    role?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

function toRecord(e: ClaudeJsonlLine, source: string, project: string): MessageRecord | null {
  const ts = e.timestamp ? new Date(e.timestamp) : null;
  if (!ts || Number.isNaN(ts.getTime())) return null;
  const usage = e.message?.usage;
  if (!usage) return null;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  if (input === 0 && output === 0 && cached === 0) return null;
  return {
    source,
    model: e.message?.model ?? 'unknown',
    project,
    timestamp: ts,
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
    sessionId: e.sessionId,
    isUser: e.message?.role === 'user',
  };
}
