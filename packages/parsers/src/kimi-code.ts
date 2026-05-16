import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

const TOML_MODEL_SECTION_RE = /^\s*\[models\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\]/m;
const TOML_DEFAULT_MODEL_RE = /^\s*default_model\s*=\s*["']([^"']+)["']/m;

// Kimi Code stores wire JSONL at ~/.kimi/sessions/<md5(workdir)>/<session>/wire.jsonl.
// Project names come from ~/.kimi/kimi.json and model defaults from ~/.kimi/config.toml.
export class KimiCodeParser extends BaseParser {
  readonly source = 'kimi-code';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(kimiDir(ctx.homeDir), 'sessions'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(kimiDir(ctx.homeDir), 'sessions');
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await findWireFiles(root, result);
    const projectMap = await loadProjectMap(ctx.homeDir);
    const defaultModel = await loadModelFromConfig(ctx.homeDir);
    const seenMessageIds = new Set<string>();

    for (const file of files) {
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(file.path);
      } catch (e) {
        result.errors.push({ path: file.path, error: (e as Error).message });
        continue;
      }

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

      let currentModel = defaultModel;
      let lastTimestamp: Date | null = null;
      const project = this.sanitizeProject(
        projectMap.get(file.workDirHash) ?? file.workDirHash,
        ctx.allowProject,
      );

      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;

        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file.path, error: `parse: ${(e as Error).message}` });
          continue;
        }

        if (!isRecord(json)) continue;
        const envelope = isRecord(json.message) ? json.message : json;
        const payload = isRecord(envelope.payload)
          ? envelope.payload
          : isRecord(json.payload)
            ? json.payload
            : null;
        if (!payload) continue;

        const rawTimestamp = readSeconds(json.timestamp) ?? readSeconds(payload.timestamp);
        if (rawTimestamp !== null) lastTimestamp = new Date(rawTimestamp * 1000);

        const payloadModel = getString(payload.model);
        if (payloadModel) currentModel = payloadModel;

        const type = getString(envelope.type) ?? getString(json.type);
        if (type !== 'StatusUpdate' || !lastTimestamp) continue;

        const usage = isRecord(payload.token_usage) ? payload.token_usage : null;
        if (!usage) continue;

        const messageId = getString(payload.message_id);
        if (messageId) {
          if (seenMessageIds.has(messageId)) continue;
          seenMessageIds.add(messageId);
        }

        const inputTokens = readCount(usage.input_other);
        const outputTokens = readCount(usage.output);
        const cachedInputTokens = readCount(usage.input_cache_read);
        if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) continue;

        result.records.push({
          source: this.source,
          model: currentModel,
          project,
          timestamp: lastTimestamp,
          inputTokens,
          outputTokens,
          cachedInputTokens,
          reasoningOutputTokens: 0,
          sessionId: path.relative(root, file.path),
        });
      }
    }

    return result;
  }
}

function kimiDir(homeDir: string): string {
  return path.join(homeDir, '.kimi');
}

async function findWireFiles(
  root: string,
  result: ParserResult,
): Promise<{ path: string; workDirHash: string }[]> {
  const out: { path: string; workDirHash: string }[] = [];
  let workDirs: import('node:fs').Dirent[];
  try {
    workDirs = await fs.readdir(root, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: root, error: err.message });
    return out;
  }

  for (const workDir of workDirs) {
    if (!workDir.isDirectory()) continue;
    const workDirPath = path.join(root, workDir.name);
    let sessions: import('node:fs').Dirent[];
    try {
      sessions = await fs.readdir(workDirPath, { withFileTypes: true });
    } catch (e) {
      result.errors.push({ path: workDirPath, error: (e as Error).message });
      continue;
    }

    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const wireFile = path.join(workDirPath, session.name, 'wire.jsonl');
      try {
        const stat = await fs.stat(wireFile);
        if (stat.isFile()) out.push({ path: wireFile, workDirHash: workDir.name });
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') result.errors.push({ path: wireFile, error: err.message });
      }
    }
  }

  return out;
}

async function loadProjectMap(homeDir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let raw: string;
  try {
    raw = await fs.readFile(path.join(kimiDir(homeDir), 'kimi.json'), 'utf8');
  } catch {
    return map;
  }

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    return map;
  }
  if (!isRecord(config)) return map;

  if (Array.isArray(config.work_dirs)) {
    for (const entry of config.work_dirs) {
      if (!isRecord(entry)) continue;
      const workdir = getString(entry.path);
      if (workdir) map.set(md5(workdir), projectNameFromPath(workdir));
    }
  }

  for (const key of ['workspaces', 'projects']) {
    const value = config[key];
    if (!isRecord(value)) continue;
    for (const [hash, info] of Object.entries(value)) {
      const workdir =
        typeof info === 'string'
          ? info
          : isRecord(info)
            ? (getString(info.path) ?? getString(info.dir))
            : undefined;
      if (workdir) map.set(hash, projectNameFromPath(workdir));
    }
  }

  return map;
}

async function loadModelFromConfig(homeDir: string): Promise<string> {
  let content: string;
  try {
    content = await fs.readFile(path.join(kimiDir(homeDir), 'config.toml'), 'utf8');
  } catch {
    return 'unknown';
  }

  const defaultMatch = content.match(TOML_DEFAULT_MODEL_RE);
  if (defaultMatch?.[1]) return defaultMatch[1];

  const sectionMatch = content.match(TOML_MODEL_SECTION_RE);
  return sectionMatch?.[1] ?? sectionMatch?.[2] ?? 'unknown';
}

function projectNameFromPath(value: string): string {
  return path.basename(value.replace(/\\/g, '/')) || value;
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function readSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
