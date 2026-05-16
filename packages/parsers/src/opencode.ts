import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';
import { queryDbJson } from './_base/sqlite';

// OpenCode stores current data in ~/.local/share/opencode/opencode.db and
// legacy per-message JSON files under storage/message/ses_*/*.json.
export class OpenCodeParser extends BaseParser {
  readonly source = 'opencode';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(dbPath(ctx.homeDir));
      return true;
    } catch {
      // Check legacy JSON below.
    }
    try {
      await fs.access(messagesDir(ctx.homeDir));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };

    if (await exists(dbPath(ctx.homeDir))) {
      await this.parseSqlite(ctx, result);
      if (result.records.length > 0) return result;
    }

    await this.parseJson(ctx, result);
    return result;
  }

  private async parseSqlite(ctx: ParserContext, result: ParserResult): Promise<void> {
    const file = dbPath(ctx.homeDir);
    const stat = await statForCache(file, result);
    if (!stat) return;
    const cached = ctx.fileCache[file];
    if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) return;
    ctx.scannedFiles.push({ path: file, mtime: stat.mtimeMs, size: stat.size });

    let rows: Record<string, unknown>[];
    try {
      rows = queryDbJson(file, 'SELECT session_id as sessionID, data FROM message');
    } catch (e) {
      result.errors.push({ path: file, error: (e as Error).message });
      return;
    }

    for (const row of rows) {
      const data = parseData(row.data, file, result);
      if (!data) continue;
      const rec = this.toRecord(data, getString(row.sessionID) ?? 'unknown', ctx);
      if (rec) result.records.push(rec);
    }
  }

  private async parseJson(ctx: ParserContext, result: ParserResult): Promise<void> {
    const root = messagesDir(ctx.homeDir);
    const files = await findJsonFiles(root, result);
    for (const file of files) {
      const stat = await statForCache(file.path, result);
      if (!stat) continue;
      const cached = ctx.fileCache[file.path];
      if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) continue;
      ctx.scannedFiles.push({ path: file.path, mtime: stat.mtimeMs, size: stat.size });

      let raw: string;
      try {
        raw = await fs.readFile(file.path, 'utf8');
      } catch (e) {
        result.errors.push({ path: file.path, error: (e as Error).message });
        continue;
      }

      const data = parseData(raw, file.path, result);
      if (!data) continue;
      const rec = this.toRecord(data, file.sessionId, ctx);
      if (rec) result.records.push(rec);
    }
  }

  private toRecord(
    data: Record<string, unknown>,
    sessionId: string,
    ctx: ParserContext,
  ): MessageRecord | null {
    const timestamp = toTimestamp(readPath(data, ['time', 'created']));
    if (!timestamp) return null;

    const tokens = readPath(data, ['tokens']);
    if (!isRecord(tokens)) return null;
    const inputTokens = readCount(tokens.input);
    const outputTokens = readCount(tokens.output);
    const cachedInputTokens = readCount(readPath(tokens, ['cache', 'read']));
    const reasoningOutputTokens = readCount(tokens.reasoning);
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
      model: getString(data.modelID) ?? 'unknown',
      project: this.sanitizeProject(
        projectFromPath(getString(readPath(data, ['path', 'root']))),
        ctx.allowProject,
      ),
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens,
      sessionId,
      isUser: data.role === 'user',
    };
  }
}

function dbPath(homeDir: string): string {
  return path.join(homeDir, '.local', 'share', 'opencode', 'opencode.db');
}

function messagesDir(homeDir: string): string {
  return path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'message');
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function statForCache(file: string, result: ParserResult): Promise<FileStat | null> {
  try {
    const stat = await fs.stat(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (e) {
    result.errors.push({ path: file, error: (e as Error).message });
    return null;
  }
}

async function findJsonFiles(root: string, result: ParserResult): Promise<OpenCodeJsonFile[]> {
  const out: OpenCodeJsonFile[] = [];
  let sessionDirs: import('node:fs').Dirent[];
  try {
    sessionDirs = await fs.readdir(root, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: root, error: err.message });
    return out;
  }

  for (const sessionDir of sessionDirs) {
    if (!sessionDir.isDirectory() || !sessionDir.name.startsWith('ses_')) continue;
    const sessionPath = path.join(root, sessionDir.name);
    let files: import('node:fs').Dirent[];
    try {
      files = await fs.readdir(sessionPath, { withFileTypes: true });
    } catch (e) {
      result.errors.push({ path: sessionPath, error: (e as Error).message });
      continue;
    }
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.json')) {
        out.push({ path: path.join(sessionPath, file.name), sessionId: sessionDir.name });
      }
    }
  }

  return out;
}

function parseData(
  value: unknown,
  file: string,
  result: ParserResult,
): Record<string, unknown> | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return isRecord(parsed) ? parsed : null;
  } catch (e) {
    result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
    return null;
  }
}

function projectFromPath(value: string | undefined): string {
  if (!value) return 'unknown';
  return path.basename(value.replace(/[\\/]+$/, '')) || 'unknown';
}

function toTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function readPath(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function readCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : 0;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface OpenCodeJsonFile {
  path: string;
  sessionId: string;
}

interface FileStat {
  mtimeMs: number;
  size: number;
}
