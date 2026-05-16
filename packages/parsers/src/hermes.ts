import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';
import { queryDbJson } from './_base/sqlite';

export class HermesParser extends BaseParser {
  readonly source = 'hermes';

  async detect(ctx: ParserContext): Promise<boolean> {
    return (await discoverDbPaths(ctx.homeDir)).length > 0;
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    for (const db of await discoverDbPaths(ctx.homeDir)) {
      await this.parseDb(db, ctx, result);
    }
    return result;
  }

  private async parseDb(
    db: { path: string; profile: string },
    ctx: ParserContext,
    result: ParserResult,
  ): Promise<void> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(db.path);
    } catch (e) {
      result.errors.push({ path: db.path, error: (e as Error).message });
      return;
    }

    const cached = ctx.fileCache[db.path];
    if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) return;
    ctx.scannedFiles.push({ path: db.path, mtime: stat.mtimeMs, size: stat.size });

    let rows: Record<string, unknown>[];
    try {
      rows = queryDbJson(
        db.path,
        `SELECT
          id,
          model,
          started_at as startedAt,
          input_tokens as inputTokens,
          output_tokens as outputTokens,
          cache_read_tokens as cacheReadTokens,
          reasoning_tokens as reasoningTokens
        FROM sessions
        WHERE input_tokens > 0 OR output_tokens > 0 OR cache_read_tokens > 0 OR reasoning_tokens > 0`,
      );
    } catch (e) {
      result.errors.push({ path: db.path, error: (e as Error).message });
      return;
    }

    for (const row of rows) {
      const timestamp = toTimestamp(row.startedAt);
      if (!timestamp) continue;
      result.records.push({
        source: this.source,
        model: getString(row.model) ?? 'unknown',
        project: this.sanitizeProject(db.profile, ctx.allowProject),
        timestamp,
        inputTokens: readCount(row.inputTokens),
        outputTokens: readCount(row.outputTokens),
        cachedInputTokens: readCount(row.cacheReadTokens),
        reasoningOutputTokens: readCount(row.reasoningTokens),
        sessionId: getString(row.id),
      });
    }
  }
}

async function discoverDbPaths(homeDir: string): Promise<{ path: string; profile: string }[]> {
  const home = path.join(homeDir, '.hermes');
  const out: { path: string; profile: string }[] = [];
  const defaultDb = path.join(home, 'state.db');
  if (await isFile(defaultDb)) out.push({ path: defaultDb, profile: 'default' });

  const profilesDir = path.join(home, 'profiles');
  let profiles: import('node:fs').Dirent[];
  try {
    profiles = await fs.readdir(profilesDir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const profile of profiles) {
    if (!profile.isDirectory()) continue;
    const profileDb = path.join(profilesDir, profile.name, 'state.db');
    if (await isFile(profileDb)) out.push({ path: profileDb, profile: profile.name });
  }

  return out;
}

async function isFile(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

function toTimestamp(value: unknown): Date | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  const timestamp = new Date(seconds * 1000);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function readCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
