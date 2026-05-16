import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Qwen Code follows the Gemini CLI tmp chat layout:
// ~/.qwen/tmp/<project-id>/chats/*.jsonl. Assistant events carry
// usageMetadata token counts; promptTokenCount includes cached tokens.
export class QwenCodeParser extends BaseParser {
  readonly source = 'qwen-code';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(ctx.homeDir, '.qwen', 'tmp'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, '.qwen', 'tmp');
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await findSessionFiles(root, result);
    const seenUuids = new Set<string>();

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

      const sessionId = path.relative(root, file);
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;

        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
          continue;
        }

        const rec = this.toRecord(json, sessionId, path.relative(root, file), ctx, seenUuids);
        if (rec) result.records.push(rec);
      }
    }

    return result;
  }

  private toRecord(
    line: unknown,
    sessionId: string,
    relativePath: string,
    ctx: ParserContext,
    seenUuids: Set<string>,
  ): MessageRecord | null {
    if (!isQwenAssistantEvent(line)) return null;

    const timestamp = new Date(line.timestamp);
    if (Number.isNaN(timestamp.getTime())) return null;

    if (line.uuid) {
      if (seenUuids.has(line.uuid)) return null;
      seenUuids.add(line.uuid);
    }

    const usage = line.usageMetadata;
    if (usage.promptTokenCount == null && usage.candidatesTokenCount == null) return null;

    const cachedInputTokens = readCount(usage.cachedContentTokenCount);
    const reasoningOutputTokens = readCount(usage.thoughtsTokenCount);
    const inputTokens = Math.max(0, readCount(usage.promptTokenCount) - cachedInputTokens);
    const outputTokens = Math.max(0, readCount(usage.candidatesTokenCount) - reasoningOutputTokens);
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
      model: line.model ?? 'unknown',
      project: this.sanitizeProject(projectFromEvent(line.cwd, relativePath), ctx.allowProject),
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens,
      sessionId,
      isUser: false,
    };
  }
}

async function findSessionFiles(root: string, result: ParserResult): Promise<string[]> {
  const out: string[] = [];
  let projectDirs: import('node:fs').Dirent[];
  try {
    projectDirs = await fs.readdir(root, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: root, error: err.message });
    return out;
  }

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;
    const chatsDir = path.join(root, projectDir.name, 'chats');
    let chatFiles: import('node:fs').Dirent[];
    try {
      chatFiles = await fs.readdir(chatsDir, { withFileTypes: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') result.errors.push({ path: chatsDir, error: err.message });
      continue;
    }

    for (const chatFile of chatFiles) {
      if (chatFile.isFile() && chatFile.name.endsWith('.jsonl')) {
        out.push(path.join(chatsDir, chatFile.name));
      }
    }
  }

  return out;
}

function projectFromEvent(cwd: string | undefined, relativePath: string): string {
  if (cwd) return path.basename(cwd) || 'unknown';
  const projectId = relativePath.split(path.sep)[0];
  return projectId || 'unknown';
}

function readCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : 0;
}

function isQwenAssistantEvent(value: unknown): value is QwenAssistantEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<QwenAssistantEvent>;
  return (
    event.type === 'assistant' &&
    typeof event.timestamp === 'string' &&
    (event.model === undefined || typeof event.model === 'string') &&
    (event.cwd === undefined || typeof event.cwd === 'string') &&
    (event.uuid === undefined || typeof event.uuid === 'string') &&
    !!event.usageMetadata &&
    typeof event.usageMetadata === 'object'
  );
}

interface QwenAssistantEvent {
  type: 'assistant';
  timestamp: string;
  model?: string;
  cwd?: string;
  uuid?: string;
  usageMetadata: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    cachedContentTokenCount?: unknown;
    thoughtsTokenCount?: unknown;
  };
}
