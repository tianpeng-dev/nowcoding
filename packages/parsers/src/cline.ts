import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

const EXTENSION_ID = 'saoudrizwan.claude-dev';
const HOSTS = ['Code', 'Cursor', 'Windsurf', 'VSCodium', 'Code - Insiders', 'Trae', 'Trae CN'];

// Cline stores task metadata in globalStorage/<extension>/state/taskHistory.json
// and per-task API request summaries in tasks/<taskId>/ui_messages.json.
export class ClineParser extends BaseParser {
  readonly source = 'cline';

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
      const history = await readJson(path.join(extDir, 'state', 'taskHistory.json'), result, true);
      if (!Array.isArray(history)) continue;

      for (const item of history) {
        if (!isRecord(item) || !getString(item.id)) continue;
        const taskId = String(item.id);
        const project = this.sanitizeProject(
          projectFromPath(
            getString(item.cwdOnTaskInitialization) ?? getString(item.shadowGitConfigWorkTree),
          ),
          ctx.allowProject,
        );
        const fallbackModel = getString(item.modelId) ?? 'cline-unknown';
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
