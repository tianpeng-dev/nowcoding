import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Droid Factory stores message JSONL under ~/.factory/sessions/<project-slug>/
// and cumulative token usage in a sibling <session>.settings.json file.
export class DroidParser extends BaseParser {
  readonly source = 'droid';

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
    const files = await walkSessionFiles(root, result);

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

      const firstMessageTimestamp = await readFirstMessageTimestamp(file, result);
      if (!firstMessageTimestamp) continue;

      const settingsPath = path.join(
        path.dirname(file),
        `${path.basename(file, '.jsonl')}.settings.json`,
      );
      const settings = await readSettings(settingsPath, result);
      if (!settings) continue;

      const usage = isRecord(settings.tokenUsage) ? settings.tokenUsage : null;
      if (!usage) continue;

      const cacheReadTokens = toSafeNumber(usage.cacheReadTokens);
      const thinkingTokens = toSafeNumber(usage.thinkingTokens);
      const inputTokens = Math.max(0, toSafeNumber(usage.inputTokens) - cacheReadTokens);
      const outputTokens = Math.max(0, toSafeNumber(usage.outputTokens) - thinkingTokens);
      if (
        inputTokens === 0 &&
        outputTokens === 0 &&
        cacheReadTokens === 0 &&
        thinkingTokens === 0
      ) {
        continue;
      }

      result.records.push({
        source: this.source,
        model: getString(settings.model) ?? 'unknown',
        project: this.sanitizeProject(
          projectFromSlug(path.basename(path.dirname(file))),
          ctx.allowProject,
        ),
        timestamp: firstMessageTimestamp,
        inputTokens,
        outputTokens,
        cachedInputTokens: cacheReadTokens,
        reasoningOutputTokens: thinkingTokens,
        sessionId: path.basename(file, '.jsonl'),
      });
    }

    return result;
  }
}

function sessionsDir(homeDir: string): string {
  return path.join(homeDir, '.factory', 'sessions');
}

async function walkSessionFiles(dir: string, result: ParserResult): Promise<string[]> {
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
      out.push(...(await walkSessionFiles(full, result)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.jsonl') &&
      !entry.name.endsWith('.settings.json')
    ) {
      out.push(full);
    }
  }

  return out;
}

async function readFirstMessageTimestamp(file: string, result: ParserResult): Promise<Date | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    result.errors.push({ path: file, error: (e as Error).message });
    return null;
  }

  let firstMessageTimestamp: Date | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch (e) {
      result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
      continue;
    }

    if (!isRecord(json) || json.type !== 'message') continue;
    const timestamp = toTimestamp(json.timestamp);
    if (timestamp && firstMessageTimestamp === null) firstMessageTimestamp = timestamp;
  }

  return firstMessageTimestamp;
}

async function readSettings(
  file: string,
  result: ParserResult,
): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: file, error: err.message });
    return null;
  }

  try {
    const json: unknown = JSON.parse(raw);
    return isRecord(json) ? json : null;
  } catch (e) {
    result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
    return null;
  }
}

function projectFromSlug(slug: string): string {
  const parts = slug.split('-').filter(Boolean);
  return parts[parts.length - 1] ?? 'unknown';
}

function toTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function toSafeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
