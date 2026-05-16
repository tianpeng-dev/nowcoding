import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Gemini CLI stores chat snapshots under ~/.gemini/tmp/<session>/chats/session-*.json.
// The observed payloads use messages/history arrays with either tokens,
// usageMetadata, usage, or token_count objects.
export class GeminiCliParser extends BaseParser {
  readonly source = 'gemini-cli';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(ctx.homeDir, '.gemini', 'tmp'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, '.gemini', 'tmp');
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await this.findSessionFiles(root, result);

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

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
        continue;
      }

      const sessionId = path.relative(root, file);
      const project = this.sanitizeProject('unknown', ctx.allowProject);
      for (const message of getMessages(json)) {
        const rec = toRecord(message, json, this.source, project, sessionId);
        if (rec) result.records.push(rec);
      }
    }

    return result;
  }

  private async findSessionFiles(root: string, result: ParserResult): Promise<string[]> {
    const out: string[] = [];
    let sessionDirs: import('node:fs').Dirent[];
    try {
      sessionDirs = await fs.readdir(root, { withFileTypes: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') result.errors.push({ path: root, error: err.message });
      return out;
    }

    for (const entry of sessionDirs) {
      if (!entry.isDirectory()) continue;
      const chatsDir = path.join(root, entry.name, 'chats');
      let chatFiles: import('node:fs').Dirent[];
      try {
        chatFiles = await fs.readdir(chatsDir, { withFileTypes: true });
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') result.errors.push({ path: chatsDir, error: err.message });
        continue;
      }

      for (const chatFile of chatFiles) {
        if (
          chatFile.isFile() &&
          chatFile.name.startsWith('session-') &&
          chatFile.name.endsWith('.json')
        ) {
          out.push(path.join(chatsDir, chatFile.name));
        }
      }
    }

    return out;
  }
}

function toRecord(
  message: GeminiMessage,
  root: unknown,
  source: string,
  project: string,
  sessionId: string,
): MessageRecord | null {
  const timestamp =
    getString(message.timestamp) ?? getString(message.createTime) ?? rootCreateTime(root);
  const ts = timestamp ? new Date(timestamp) : null;
  if (!ts || Number.isNaN(ts.getTime())) return null;

  const usage = getGeminiUsage(message);
  if (!usage) return null;

  if (
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.cachedInputTokens === 0 &&
    usage.reasoningOutputTokens === 0
  ) {
    return null;
  }

  return {
    source,
    model: getString(message.model) ?? rootModel(root) ?? 'unknown',
    project,
    timestamp: ts,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    reasoningOutputTokens: usage.reasoningOutputTokens,
    sessionId,
    isUser: message.role === 'user',
  };
}

function getMessages(root: unknown): GeminiMessage[] {
  if (!isRecord(root)) return [];
  const messages = Array.isArray(root.messages) ? root.messages : root.history;
  if (!Array.isArray(messages)) return [];
  return messages.filter(isRecord);
}

function getGeminiUsage(message: GeminiMessage): ParsedGeminiUsage | null {
  if (isRecord(message.tokens)) {
    const cachedInputTokens = readCount(message.tokens.cached);
    const reasoningOutputTokens = readCount(message.tokens.thoughts);
    return {
      inputTokens: subtractIncludedTokens(readCount(message.tokens.input), cachedInputTokens),
      outputTokens: subtractIncludedTokens(readCount(message.tokens.output), reasoningOutputTokens),
      cachedInputTokens,
      reasoningOutputTokens,
    };
  }

  const usage = firstRecord(message.usage, message.usageMetadata, message.token_count);
  if (!usage) return null;

  const cachedInputTokens = readCount(usage.cachedContentTokenCount);
  const reasoningOutputTokens = readCount(usage.thoughtsTokenCount);
  return {
    inputTokens: subtractIncludedTokens(
      readCount(usage.promptTokenCount) || readCount(usage.input_tokens),
      cachedInputTokens,
    ),
    outputTokens: subtractIncludedTokens(
      readCount(usage.candidatesTokenCount) || readCount(usage.output_tokens),
      reasoningOutputTokens,
    ),
    cachedInputTokens,
    reasoningOutputTokens,
  };
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value)) return value;
  }
  return null;
}

function rootCreateTime(root: unknown): string | undefined {
  return isRecord(root) ? getString(root.createTime) : undefined;
}

function rootModel(root: unknown): string | undefined {
  return isRecord(root) ? getString(root.model) : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : 0;
}

function subtractIncludedTokens(total: number, included: number): number {
  return Math.max(0, total - included);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

type GeminiMessage = Record<string, unknown>;

interface ParsedGeminiUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
}
