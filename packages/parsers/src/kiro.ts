import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';
import { queryDbJson } from './_base/sqlite';

const KIRO_AGENT_SUBPATH = path.join('User', 'globalStorage', 'kiro.kiroagent');
const TOKENS_SQL = `SELECT
  id,
  model,
  tokens_prompt as tokensPrompt,
  tokens_generated as tokensGenerated,
  timestamp
FROM tokens_generated
WHERE tokens_prompt > 0 OR tokens_generated > 0
ORDER BY id ASC`;

export class KiroParser extends BaseParser {
  readonly source = 'kiro';

  async detect(ctx: ParserContext): Promise<boolean> {
    const paths = kiroPaths(ctx.homeDir);
    return (await exists(paths.dbPath)) || (await exists(paths.jsonlPath));
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const paths = kiroPaths(ctx.homeDir);

    if (await exists(paths.dbPath)) {
      await this.parseSqlite(paths, ctx, result);
      return result;
    }

    await this.parseJsonl(paths, ctx, result);
    return result;
  }

  private async parseSqlite(
    paths: KiroPaths,
    ctx: ParserContext,
    result: ParserResult,
  ): Promise<void> {
    const stat = await statForCache(paths.dbPath, result);
    if (!stat) return;
    const cached = ctx.fileCache[paths.dbPath];
    if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) return;
    ctx.scannedFiles.push({ path: paths.dbPath, mtime: stat.mtimeMs, size: stat.size });

    let rows: Record<string, unknown>[];
    try {
      rows = await queryKiroDb(paths.dbPath);
    } catch (e) {
      result.errors.push({ path: paths.dbPath, error: (e as Error).message });
      return;
    }

    const timeline = await buildModelTimeline(paths.basePath, result);
    for (const row of rows) {
      const rec = this.rowToRecord(row, parseDbTimestamp(row.timestamp), timeline, ctx);
      if (rec) result.records.push(rec);
    }
  }

  private async parseJsonl(
    paths: KiroPaths,
    ctx: ParserContext,
    result: ParserResult,
  ): Promise<void> {
    const stat = await statForCache(paths.jsonlPath, result);
    if (!stat) return;
    const cached = ctx.fileCache[paths.jsonlPath];
    if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) return;
    ctx.scannedFiles.push({ path: paths.jsonlPath, mtime: stat.mtimeMs, size: stat.size });

    let raw: string;
    try {
      raw = await fs.readFile(paths.jsonlPath, 'utf8');
    } catch (e) {
      result.errors.push({ path: paths.jsonlPath, error: (e as Error).message });
      return;
    }

    const timestamp = new Date(stat.mtimeMs);
    let lineNumber = 0;
    for (const line of raw.split('\n')) {
      lineNumber += 1;
      const trimmed = line.trim();
      if (!trimmed) continue;
      let data: Record<string, unknown>;
      try {
        const parsed = JSON.parse(trimmed);
        if (!isRecord(parsed)) continue;
        data = parsed;
      } catch (e) {
        result.errors.push({
          path: paths.jsonlPath,
          error: `line ${lineNumber}: ${(e as Error).message}`,
        });
        continue;
      }

      const rec = this.rowToRecord(
        {
          id: lineNumber,
          model: data.model,
          tokensPrompt: data.promptTokens,
          tokensGenerated: data.generatedTokens,
          timestamp,
        },
        timestamp,
        [],
        ctx,
      );
      if (rec) result.records.push(rec);
    }
  }

  private rowToRecord(
    row: Record<string, unknown>,
    timestamp: Date | null,
    timeline: ModelWindow[],
    ctx: ParserContext,
  ): MessageRecord | null {
    if (!timestamp) return null;
    const inputTokens = readCount(row.tokensPrompt);
    const outputTokens = readCount(row.tokensGenerated);
    if (inputTokens === 0 && outputTokens === 0) return null;

    return {
      source: this.source,
      model: resolveModel(row.model, timestamp, timeline),
      project: this.sanitizeProject('unknown', ctx.allowProject),
      timestamp,
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
      sessionId: String(row.id ?? 'unknown'),
    };
  }
}

function kiroPaths(homeDir: string): KiroPaths {
  const basePath = path.join(homeDir, ...platformKiroParts());
  return {
    basePath,
    dbPath: path.join(basePath, 'dev_data', 'devdata.sqlite'),
    jsonlPath: path.join(basePath, 'dev_data', 'tokens_generated.jsonl'),
  };
}

function platformKiroParts(): string[] {
  if (process.platform === 'darwin') {
    return ['Library', 'Application Support', 'Kiro', ...KIRO_AGENT_SUBPATH.split(path.sep)];
  }
  if (process.platform === 'win32') {
    return ['AppData', 'Roaming', 'Kiro', ...KIRO_AGENT_SUBPATH.split(path.sep)];
  }
  return ['.config', 'Kiro', ...KIRO_AGENT_SUBPATH.split(path.sep)];
}

async function queryKiroDb(dbPath: string): Promise<Record<string, unknown>[]> {
  try {
    return queryDbJson(dbPath, TOKENS_SQL);
  } catch (e) {
    if (!isLockError(e)) throw e;
  }

  const snapshotDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nowcoding-kiro-'));
  const snapshotPath = path.join(snapshotDir, 'devdata.sqlite');
  try {
    await fs.copyFile(dbPath, snapshotPath);
    for (const suffix of ['-wal', '-shm']) {
      const companion = `${dbPath}${suffix}`;
      if (await exists(companion)) {
        await fs.copyFile(companion, `${snapshotPath}${suffix}`);
      }
    }
    return queryDbJson(snapshotPath, TOKENS_SQL);
  } finally {
    await fs.rm(snapshotDir, { recursive: true, force: true });
  }
}

async function buildModelTimeline(basePath: string, result: ParserResult): Promise<ModelWindow[]> {
  const timeline: ModelWindow[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(basePath, { withFileTypes: true });
  } catch {
    return timeline;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'dev_data') continue;
    const dir = path.join(basePath, entry.name);
    let files: import('node:fs').Dirent[];
    try {
      files = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      result.errors.push({ path: dir, error: (e as Error).message });
      continue;
    }

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.chat')) continue;
      const chatPath = path.join(dir, file.name);
      try {
        const parsed = JSON.parse(await fs.readFile(chatPath, 'utf8'));
        const metadata = isRecord(parsed) ? parsed.metadata : undefined;
        if (!isRecord(metadata)) continue;
        const model = getString(metadata.modelId);
        const startMs = Number(metadata.startTime);
        const endMs = Number(metadata.endTime ?? metadata.startTime);
        if (!model || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
        timeline.push({ startMs, endMs, model });
      } catch (e) {
        result.errors.push({ path: chatPath, error: (e as Error).message });
      }
    }
  }

  timeline.sort((a, b) => a.startMs - b.startMs);
  return timeline;
}

function resolveModel(rowModel: unknown, timestamp: Date, timeline: ModelWindow[]): string {
  const timelineModel = normalizeModelName(findTimelineModel(timeline, timestamp));
  if (timelineModel) return timelineModel;

  const literal = getString(rowModel);
  if (literal && literal.toLowerCase() !== 'agent') {
    const normalized = normalizeModelName(literal);
    if (normalized) return normalized;
  }

  return 'kiro-agent';
}

function findTimelineModel(timeline: ModelWindow[], timestamp: Date): string | null {
  if (!timeline.length) return null;
  const time = timestamp.getTime();
  let nearest: { distance: number; model: string } | null = null;
  for (const window of timeline) {
    if (time >= window.startMs && time <= window.endMs) return window.model;
    const distance = Math.min(Math.abs(time - window.startMs), Math.abs(time - window.endMs));
    if (!nearest || distance < nearest.distance) nearest = { distance, model: window.model };
  }
  return nearest && nearest.distance < 10 * 60 * 1000 ? nearest.model : null;
}

function normalizeModelName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === trimmed.toLowerCase() && trimmed.includes('-')) return trimmed;
  return (
    trimmed
      .replace(/_\d{8}_V\d+_\d+$/i, '')
      .replace(/_V\d+$/i, '')
      .toLowerCase()
      .replace(/_/g, '-') || null
  );
}

function parseDbTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = new Date(`${value.trim().replace(' ', 'T')}Z`);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
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
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: file, error: err.message });
    return null;
  }
}

function isLockError(value: unknown): boolean {
  return value instanceof Error && /database is locked/i.test(value.message);
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

interface KiroPaths {
  basePath: string;
  dbPath: string;
  jsonlPath: string;
}

interface ModelWindow {
  startMs: number;
  endMs: number;
  model: string;
}

interface FileStat {
  mtimeMs: number;
  size: number;
}
