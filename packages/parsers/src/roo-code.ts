import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

const EXTENSION_ID = 'rooveterinaryinc.roo-cline';
const HOSTS = ['Code', 'Cursor', 'Windsurf', 'VSCodium', 'Code - Insiders', 'Trae', 'Trae CN'];

// Roo Code stores task history in tasks/_index.json or per-task history_item.json,
// and API usage summaries in tasks/<taskId>/ui_messages.json.
export class RooCodeParser extends BaseParser {
  readonly source = 'roo-code';

  async detect(ctx: ParserContext): Promise<boolean> {
    for (const extDir of extensionDirs(ctx.homeDir)) {
      try {
        await fs.access(extDir);
        return true;
      } catch {
        // Continue scanning other editor hosts.
      }
    }
    return false;
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };

    for (const extDir of extensionDirs(ctx.homeDir)) {
      const items = await readHistoryItems(extDir, result);
      for (const item of items) {
        const taskId = getString(item.id);
        if (!taskId) continue;

        const project = this.sanitizeProject(
          projectFromPath(getString(item.workspace)),
          ctx.allowProject,
        );
        const fallbackModel = getString(item.apiConfigName) ?? 'roo-unknown';
        const messagesPath = path.join(extDir, 'tasks', taskId, 'ui_messages.json');
        const stat = await statForCache(messagesPath, result);
        if (!stat) continue;
        const cached = ctx.fileCache[messagesPath];
        if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) continue;
        ctx.scannedFiles.push({ path: messagesPath, mtime: stat.mtimeMs, size: stat.size });

        const messages = await readJson(messagesPath, result, false);
        if (!Array.isArray(messages)) continue;

        for (const message of messages) {
          const rec = toRecord(message, this.source, project, taskId, fallbackModel);
          if (rec) result.records.push(rec);
        }
      }
    }

    return result;
  }
}

function extensionDirs(homeDir: string): string[] {
  const roots = [
    ...HOSTS.map((host) => path.join(homeDir, 'Library', 'Application Support', host)),
    ...HOSTS.map((host) => path.join(homeDir, '.config', host)),
    ...HOSTS.map((host) => path.join(homeDir, 'AppData', 'Roaming', host)),
  ];
  return roots.map((root) => path.join(root, 'User', 'globalStorage', EXTENSION_ID));
}

async function readHistoryItems(
  extDir: string,
  result: ParserResult,
): Promise<Record<string, unknown>[]> {
  const tasksDir = path.join(extDir, 'tasks');
  const index = await readJson(path.join(tasksDir, '_index.json'), result, true);
  if (isRecord(index) && Array.isArray(index.entries)) {
    return index.entries.filter(isRecord);
  }

  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(tasksDir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: tasksDir, error: err.message });
    return [];
  }

  const out: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const item = await readJson(path.join(tasksDir, entry.name, 'history_item.json'), result, true);
    if (isRecord(item)) out.push(item);
  }

  return out;
}

async function statForCache(file: string, result: ParserResult): Promise<FileStat | null> {
  try {
    const stat = await fs.stat(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: file, error: err.message });
    return null;
  }
}

async function readJson(
  file: string,
  result: ParserResult,
  ignoreMissing: boolean,
): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (!ignoreMissing || err.code !== 'ENOENT')
      result.errors.push({ path: file, error: err.message });
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
    return null;
  }
}

function toRecord(
  message: unknown,
  source: string,
  project: string,
  sessionId: string,
  fallbackModel: string,
): MessageRecord | null {
  if (!isRecord(message) || message.type !== 'say' || message.say !== 'api_req_started') {
    return null;
  }

  const timestamp = toTimestamp(message.ts);
  if (!timestamp) return null;

  let info: unknown;
  try {
    info = JSON.parse(getString(message.text) ?? '');
  } catch {
    return null;
  }
  if (!isRecord(info)) return null;

  const inputTokens = readCount(info.tokensIn);
  const outputTokens = readCount(info.tokensOut);
  const cacheWrites = readCount(info.cacheWrites);
  const cachedInputTokens = readCount(info.cacheReads);
  if (inputTokens === 0 && outputTokens === 0 && cacheWrites === 0 && cachedInputTokens === 0) {
    return null;
  }

  return {
    source,
    model: getString(info.model) ?? fallbackModel,
    project,
    timestamp,
    inputTokens: inputTokens + cacheWrites,
    outputTokens,
    cachedInputTokens,
    reasoningOutputTokens: 0,
    sessionId,
    isUser: false,
  };
}

function projectFromPath(value: string | undefined): string {
  if (!value) return 'unknown';
  return path.basename(value.replace(/[\\/]+$/, '')) || 'unknown';
}

function toTimestamp(value: unknown): Date | null {
  const timestamp = typeof value === 'number' && Number.isFinite(value) ? new Date(value) : null;
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
}

function readCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface FileStat {
  mtimeMs: number;
  size: number;
}
