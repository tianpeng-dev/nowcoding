import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// GitHub Copilot CLI writes session event logs to
// ~/.copilot/session-state/<session-id>/events.jsonl. Token usage is emitted in
// session.shutdown data.modelMetrics.
export class GithubCopilotCliParser extends BaseParser {
  readonly source = 'github-copilot-cli';

  async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(ctx.homeDir, '.copilot', 'session-state'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, '.copilot', 'session-state');
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const files = await findEventFiles(root, result);

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

      let currentProject = this.sanitizeProject('unknown', ctx.allowProject);
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;

        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file.path, error: `parse: ${(e as Error).message}` });
          continue;
        }

        if (!isCopilotEvent(json)) continue;
        if (json.type === 'session.start' || json.type === 'session.resume') {
          currentProject = this.sanitizeProject(
            projectFromContext(json.data?.context),
            ctx.allowProject,
          );
          continue;
        }

        if (json.type !== 'session.shutdown') continue;
        const timestamp = toTimestamp(json.timestamp);
        if (!timestamp) continue;

        const modelMetrics = isRecord(json.data?.modelMetrics) ? json.data.modelMetrics : {};
        for (const [model, metrics] of Object.entries(modelMetrics)) {
          const usage = isRecord(metrics) && isRecord(metrics.usage) ? metrics.usage : null;
          if (!usage) continue;

          const totalInput = readCount(usage.inputTokens);
          const cachedRead = readCount(usage.cacheReadTokens);
          const output = readCount(usage.outputTokens);
          const cacheWrite = readCount(usage.cacheWriteTokens);
          if (totalInput === 0 && cachedRead === 0 && cacheWrite === 0 && output === 0) {
            continue;
          }

          result.records.push({
            source: this.source,
            model,
            project: currentProject,
            timestamp,
            inputTokens: Math.max(0, totalInput - cachedRead),
            outputTokens: output,
            cachedInputTokens: cachedRead,
            reasoningOutputTokens: 0,
            sessionId: file.sessionId,
          });
        }
      }
    }

    return result;
  }
}

async function findEventFiles(
  root: string,
  result: ParserResult,
): Promise<{ path: string; sessionId: string }[]> {
  const out: { path: string; sessionId: string }[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: root, error: err.message });
    return out;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(root, entry.name, 'events.jsonl');
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) out.push({ path: filePath, sessionId: entry.name });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') result.errors.push({ path: filePath, error: err.message });
    }
  }

  return out;
}

function projectFromContext(context: unknown): string {
  if (!isRecord(context)) return 'unknown';
  const projectPath = getString(context.gitRoot) ?? getString(context.cwd);
  return projectPath ? path.basename(projectPath) || 'unknown' : 'unknown';
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

function isCopilotEvent(value: unknown): value is CopilotEvent {
  return isRecord(value) && typeof value.type === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface CopilotEvent {
  type: string;
  timestamp?: unknown;
  data?: {
    context?: unknown;
    modelMetrics?: unknown;
  };
}
