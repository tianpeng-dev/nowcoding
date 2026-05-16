import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// OpenClaw stores sessions in ~/.openclaw*/agents/<agent>/sessions/*.jsonl.
// Legacy roots include ~/.clawdbot, ~/.moltbot, and ~/.moldbot.
export class OpenClawParser extends BaseParser {
  readonly source = 'openclaw';

  async detect(ctx: ParserContext): Promise<boolean> {
    for (const root of await possibleRoots(ctx.homeDir)) {
      try {
        await fs.access(path.join(root, 'agents'));
        return true;
      } catch {
        // Keep scanning other profile roots.
      }
    }
    return false;
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    for (const root of await possibleRoots(ctx.homeDir)) {
      const files = await findSessionFiles(path.join(root, 'agents'), result);
      for (const file of files) {
        await this.parseFile(file, root, ctx, result);
      }
    }
    return result;
  }

  private async parseFile(
    file: OpenClawSessionFile,
    root: string,
    ctx: ParserContext,
    result: ParserResult,
  ): Promise<void> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(file.path);
    } catch (e) {
      result.errors.push({ path: file.path, error: (e as Error).message });
      return;
    }

    const cached = ctx.fileCache[file.path];
    if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) return;
    ctx.scannedFiles.push({ path: file.path, mtime: stat.mtimeMs, size: stat.size });

    let raw: string;
    try {
      raw = await fs.readFile(file.path, 'utf8');
    } catch (e) {
      result.errors.push({ path: file.path, error: (e as Error).message });
      return;
    }

    const project = this.sanitizeProject(file.agentId, ctx.allowProject);
    const sessionId = path.relative(path.join(root, 'agents'), file.path);
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;

      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch (e) {
        result.errors.push({ path: file.path, error: `parse: ${(e as Error).message}` });
        continue;
      }

      const rec = toRecord(json, this.source, project, sessionId);
      if (rec) result.records.push(rec);
    }
  }
}

async function possibleRoots(homeDir: string): Promise<string[]> {
  const roots = [
    path.join(homeDir, '.clawdbot'),
    path.join(homeDir, '.moltbot'),
    path.join(homeDir, '.moldbot'),
  ];

  try {
    const entries = await fs.readdir(homeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.openclaw' || /^\.openclaw-.+/.test(entry.name)) {
        roots.push(path.join(homeDir, entry.name));
      }
    }
  } catch {
    // Ignore unreadable home directories; parse will return no records.
  }

  return roots;
}

async function findSessionFiles(
  agentsDir: string,
  result: ParserResult,
): Promise<OpenClawSessionFile[]> {
  const out: OpenClawSessionFile[] = [];
  let agents: import('node:fs').Dirent[];
  try {
    agents = await fs.readdir(agentsDir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') result.errors.push({ path: agentsDir, error: err.message });
    return out;
  }

  for (const agent of agents) {
    if (!agent.isDirectory()) continue;
    const sessionsDir = path.join(agentsDir, agent.name, 'sessions');
    let files: import('node:fs').Dirent[];
    try {
      files = await fs.readdir(sessionsDir, { withFileTypes: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') result.errors.push({ path: sessionsDir, error: err.message });
      continue;
    }

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        out.push({ path: path.join(sessionsDir, file.name), agentId: agent.name });
      }
    }
  }

  return out;
}

function toRecord(
  line: unknown,
  source: string,
  project: string,
  sessionId: string,
): MessageRecord | null {
  if (!isRecord(line) || line.type !== 'message' || !isRecord(line.message)) return null;
  const message = line.message;
  const timestamp = toTimestamp(line.timestamp) ?? toTimestamp(message.timestamp);
  if (!timestamp) return null;

  if (message.role !== 'assistant' || !isRecord(message.usage)) return null;
  const usage = message.usage;
  const inputTokens = getTokens(
    usage,
    'input',
    'inputTokens',
    'input_tokens',
    'promptTokens',
    'prompt_tokens',
  );
  const outputTokens = getTokens(
    usage,
    'output',
    'outputTokens',
    'output_tokens',
    'completionTokens',
    'completion_tokens',
  );
  const cachedInputTokens = getTokens(usage, 'cacheRead', 'cache_read', 'cache_read_input_tokens');
  if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) return null;

  return {
    source,
    model: getString(message.model) ?? getString(line.model) ?? 'unknown',
    project,
    timestamp,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningOutputTokens: 0,
    sessionId,
    isUser: false,
  };
}

function getTokens(usage: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function toTimestamp(value: unknown): Date | null {
  const timestamp =
    typeof value === 'number'
      ? new Date(value)
      : typeof value === 'string'
        ? new Date(value)
        : null;
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface OpenClawSessionFile {
  path: string;
  agentId: string;
}
