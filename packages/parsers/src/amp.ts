import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Amp stores thread JSON files under ~/.local/share/amp/threads. Newer threads
// use usageLedger.events; older threads keep usage directly on messages.
export class AmpParser extends BaseParser {
  readonly source = 'amp';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(resolveThreadsDir(ctx.homeDir));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = resolveThreadsDir(ctx.homeDir);
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await findThreadFiles(root, result);

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

      let thread: unknown;
      try {
        thread = JSON.parse(raw);
      } catch (e) {
        result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
        continue;
      }

      result.records.push(...recordsFromThread(thread, file, this.source));
    }

    return result;
  }
}

function resolveThreadsDir(homeDir: string): string {
  if (process.env.AMP_DATA_DIR) return process.env.AMP_DATA_DIR;
  if (process.env.XDG_DATA_HOME) return path.join(process.env.XDG_DATA_HOME, 'amp', 'threads');
  return path.join(homeDir, '.local', 'share', 'amp', 'threads');
}

async function findThreadFiles(dir: string, result: ParserResult): Promise<string[]> {
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
      out.push(...(await findThreadFiles(full, result)));
    } else if (entry.isFile() && entry.name.startsWith('T-') && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }

  return out;
}

function recordsFromThread(thread: unknown, file: string, source: string): MessageRecord[] {
  if (!isRecord(thread)) return [];

  const sessionId = getString(thread.id) ?? file;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const usageLedger = isRecord(thread.usageLedger) ? thread.usageLedger : {};
  const ledgerEvents = Array.isArray(usageLedger.events) ? usageLedger.events : [];
  if (ledgerEvents.length > 0) {
    return recordsFromLedger(ledgerEvents, messages, sessionId, source);
  }

  return recordsFromMessages(messages, thread, sessionId, source);
}

function recordsFromLedger(
  ledgerEvents: unknown[],
  messages: unknown[],
  sessionId: string,
  source: string,
): MessageRecord[] {
  const out: MessageRecord[] = [];

  for (const event of ledgerEvents) {
    if (!isRecord(event)) continue;
    const timestamp = toTimestamp(event.timestamp);
    if (!timestamp) continue;

    const tokens = isRecord(event.tokens) ? event.tokens : {};
    const inputTokens = readCount(tokens.input);
    const outputTokens = readCount(tokens.output);
    if (inputTokens === 0 && outputTokens === 0) continue;

    const toMessageId = readInteger(event.toMessageId);
    const toMessage = toMessageId === null ? null : messages[toMessageId];
    const usage = isRecord(toMessage) && isRecord(toMessage.usage) ? toMessage.usage : {};

    out.push({
      source,
      model: getString(event.model) ?? 'unknown',
      project: 'unknown',
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens: readCount(usage.cacheReadInputTokens),
      reasoningOutputTokens: 0,
      sessionId,
    });
  }

  return out;
}

function recordsFromMessages(
  messages: unknown[],
  thread: Record<string, unknown>,
  sessionId: string,
  source: string,
): MessageRecord[] {
  const out: MessageRecord[] = [];

  for (const message of messages) {
    if (!isRecord(message) || !isRecord(message.usage)) continue;
    const timestamp = toTimestamp(message.timestamp) ?? toTimestamp(thread.created);
    if (!timestamp) continue;

    const usage = message.usage;
    const inputTokens = readCount(usage.inputTokens);
    const outputTokens = readCount(usage.outputTokens);
    const cachedInputTokens = readCount(usage.cacheReadInputTokens);
    if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) continue;

    out.push({
      source,
      model: getString(usage.model) ?? 'unknown',
      project: 'unknown',
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens: 0,
      sessionId,
      isUser: message.role === 'user',
    });
  }

  return out;
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

function readInteger(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
