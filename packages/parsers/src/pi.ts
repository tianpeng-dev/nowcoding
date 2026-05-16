import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// pi-coding-agent stores JSONL sessions under ~/.pi/agent/sessions/<encoded-cwd>/.
// Session header lines provide id/cwd; assistant message lines carry token usage.
export class PiParser extends BaseParser {
  readonly source = 'pi';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(sessionsDir(ctx.homeDir));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = sessionsDir(ctx.homeDir);
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await walkJsonl(root, result);
    const seenEntryIds = new Set<string>();

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

      let sessionId = path.basename(file, '.jsonl');
      let project = this.sanitizeProject(projectFromDir(file, root), ctx.allowProject);

      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;

        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
          continue;
        }

        if (isPiSessionLine(json)) {
          sessionId = json.id ?? sessionId;
          if (json.cwd) {
            project = this.sanitizeProject(projectFromCwd(json.cwd), ctx.allowProject);
          }
          continue;
        }

        const rec = this.toRecord(json, sessionId, project, seenEntryIds);
        if (rec) result.records.push(rec);
      }
    }

    return result;
  }

  private toRecord(
    line: unknown,
    sessionId: string,
    project: string,
    seenEntryIds: Set<string>,
  ): MessageRecord | null {
    if (!isPiMessageLine(line)) return null;
    const message = line.message;
    if (message.role !== 'assistant' || !isRecord(message.usage)) return null;

    if (line.id) {
      if (seenEntryIds.has(line.id)) return null;
      seenEntryIds.add(line.id);
    }

    const timestamp = toTimestamp(line.timestamp) ?? toTimestamp(message.timestamp);
    if (!timestamp) return null;

    const usage = message.usage;
    const inputTokens = readCount(usage.input);
    const outputTokens = readCount(usage.output);
    const cachedInputTokens = readCount(usage.cacheRead);
    if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) return null;

    return {
      source: this.source,
      model: getString(message.model) ?? 'unknown',
      project,
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens: 0,
      sessionId,
      isUser: false,
    };
  }
}

function sessionsDir(homeDir: string): string {
  return path.join(homeDir, '.pi', 'agent', 'sessions');
}

async function walkJsonl(dir: string, result: ParserResult): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: dir, error: err.message });
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

function projectFromCwd(cwd: string): string {
  return path.basename(cwd.replace(/\\/g, '/')) || 'unknown';
}

function projectFromDir(filePath: string, root: string): string {
  const relative = path.relative(root, filePath);
  const firstSegment = relative.split(path.sep)[0];
  if (!firstSegment) return 'unknown';
  const parts = firstSegment.split('-').filter(Boolean);
  return parts[parts.length - 1] ?? 'unknown';
}

function toTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : 0;
}

function isPiSessionLine(value: unknown): value is PiSessionLine {
  if (!isRecord(value)) return false;
  return (
    value.type === 'session' &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.cwd === undefined || typeof value.cwd === 'string')
  );
}

function isPiMessageLine(value: unknown): value is PiMessageLine {
  if (!isRecord(value) || value.type !== 'message' || !isRecord(value.message)) return false;
  return (
    (value.id === undefined || typeof value.id === 'string') &&
    (value.timestamp === undefined || typeof value.timestamp === 'string') &&
    (value.message.role === undefined || typeof value.message.role === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface PiSessionLine {
  type: 'session';
  id?: string;
  cwd?: string;
}

interface PiMessageLine {
  type: 'message';
  id?: string;
  timestamp?: string;
  message: {
    role?: string;
    model?: unknown;
    timestamp?: unknown;
    usage?: unknown;
  };
}
