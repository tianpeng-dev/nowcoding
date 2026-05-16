import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

const MODEL_NORMALIZE_MAP: Record<string, string> = {
  'claude-opus-4-6-thinking': 'claude-opus-4-6',
  'claude-sonnet-4-6-thinking': 'claude-sonnet-4-6',
  'gemini-3-flash-c': 'gemini-3-flash',
  'gemini-3.1-pro-high': 'gemini-3.1-pro',
  'gemini-3.1-pro-low': 'gemini-3.1-pro',
  'gemini-3-pro-high': 'gemini-3-pro',
  'gemini-3-pro-low': 'gemini-3-pro',
};

const PLACEHOLDER_MODEL_MAP: Record<string, string> = {
  MODEL_PLACEHOLDER_M37: 'gemini-3.1-pro',
  MODEL_PLACEHOLDER_M36: 'gemini-3.1-pro',
  MODEL_PLACEHOLDER_M47: 'gemini-3-flash',
  MODEL_PLACEHOLDER_M35: 'claude-sonnet-4-6',
  MODEL_PLACEHOLDER_M26: 'claude-opus-4-6',
  MODEL_OPENAI_GPT_OSS_120B_MEDIUM: 'gpt-oss-120b',
};

export interface AntigravityServer {
  baseUrl: string;
  csrfToken: string;
}

export interface AntigravityParserOptions {
  findServer?: () => Promise<AntigravityServer | null>;
  rpc?: (
    server: AntigravityServer,
    method: string,
    body: Record<string, unknown>,
  ) => Promise<unknown>;
}

export class AntigravityParser extends BaseParser {
  readonly source = 'antigravity';

  constructor(private readonly options: AntigravityParserOptions = {}) {
    super();
  }

  async detect(ctx: ParserContext): Promise<boolean> {
    return (await listCascadeIds(ctx.homeDir)).length > 0;
  }

  async parse(ctx: ParserContext): Promise<ParserResult> {
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const cascadeIds = await listCascadeIds(ctx.homeDir);
    if (cascadeIds.length === 0) return result;

    const server = await (this.options.findServer ?? findAntigravityServer)();
    if (!server) {
      result.errors.push({
        path: conversationsDir(ctx.homeDir),
        error:
          'Antigravity conversation files found, but no running language server RPC endpoint was detected.',
      });
      return result;
    }

    const rpc = this.options.rpc ?? rpcGetTrajectory;
    const seenResponseIds = new Set<string>();
    for (const cascadeId of cascadeIds) {
      let response: unknown;
      try {
        response = await rpc(server, 'GetCascadeTrajectory', { cascadeId });
      } catch (e) {
        result.errors.push({ path: cascadeId, error: (e as Error).message });
        continue;
      }

      for (const record of this.recordsFromTrajectory(response, cascadeId, ctx, seenResponseIds)) {
        result.records.push(record);
      }
    }

    return result;
  }

  private recordsFromTrajectory(
    response: unknown,
    cascadeId: string,
    ctx: ParserContext,
    seenResponseIds: Set<string>,
  ): MessageRecord[] {
    const trajectory = readRecord(readRecord(response)?.trajectory);
    if (!trajectory) return [];

    const project = this.sanitizeProject(projectFromTrajectory(trajectory), ctx.allowProject);
    const out: MessageRecord[] = [];
    const generatorMetadata = readArray(trajectory.generatorMetadata);
    for (const item of generatorMetadata) {
      const chatModel = readRecord(readRecord(item)?.chatModel);
      if (!chatModel) continue;
      const model = resolveModel(chatModel);
      const timestamp = toTimestamp(readPath(chatModel, ['chatStartMetadata', 'createdAt']));
      if (!timestamp) continue;

      for (const retry of readArray(chatModel.retryInfos)) {
        const usage = readRecord(readRecord(retry)?.usage);
        if (!usage) continue;
        const responseId = getString(usage.responseId);
        if (responseId && seenResponseIds.has(responseId)) continue;
        if (responseId) seenResponseIds.add(responseId);

        const inputTokens = readCount(usage.inputTokens);
        const outputTokens = readCount(usage.outputTokens);
        const cachedInputTokens = readCount(usage.cacheReadTokens);
        const reasoningOutputTokens = readCount(usage.thinkingOutputTokens);
        if (
          inputTokens === 0 &&
          outputTokens === 0 &&
          cachedInputTokens === 0 &&
          reasoningOutputTokens === 0
        ) {
          continue;
        }

        out.push({
          source: this.source,
          model,
          project,
          timestamp,
          inputTokens,
          outputTokens,
          cachedInputTokens,
          reasoningOutputTokens,
          sessionId: cascadeId,
        });
      }
    }
    return out;
  }
}

async function listCascadeIds(homeDir: string): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(conversationsDir(homeDir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.pb'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

function conversationsDir(homeDir: string): string {
  return path.join(homeDir, '.gemini', 'antigravity', 'conversations');
}

async function findAntigravityServer(): Promise<AntigravityServer | null> {
  const processInfo = findLanguageServerProcess();
  if (!processInfo) return null;
  const ports = findListeningPorts(processInfo.pid);
  for (const port of ports) {
    const server = { baseUrl: `http://127.0.0.1:${port}`, csrfToken: processInfo.csrfToken };
    try {
      await rpcPost(server, 'GetWorkspaceInfos', {}, 3000);
      return server;
    } catch {
      // Try the next listening port.
    }
  }
  return null;
}

function findLanguageServerProcess(): { pid: string; csrfToken: string } | null {
  if (process.platform === 'win32') return findLanguageServerProcessWin();
  return findLanguageServerProcessUnix();
}

function findLanguageServerProcessUnix(): { pid: string; csrfToken: string } | null {
  let out: string;
  try {
    out = execFileSync('ps', ['aux'], { encoding: 'utf8', timeout: 5000 });
  } catch {
    return null;
  }
  for (const line of out.split('\n')) {
    if (!line.includes('antigravity/bin/language_server_')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[1];
    const csrfToken = line.match(/--csrf_token\s+([0-9a-f-]+)/)?.[1];
    if (pid && csrfToken) return { pid, csrfToken };
  }
  return null;
}

function findLanguageServerProcessWin(): { pid: string; csrfToken: string } | null {
  let out: string;
  try {
    out = execFileSync(
      'wmic',
      [
        'process',
        'where',
        "CommandLine like '%antigravity%language_server%'",
        'get',
        'ProcessId,CommandLine',
        '/format:list',
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
  } catch {
    return null;
  }

  let commandLine = '';
  let pid = '';
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CommandLine=')) commandLine = trimmed.slice('CommandLine='.length);
    if (trimmed.startsWith('ProcessId=')) pid = trimmed.slice('ProcessId='.length);
  }
  const csrfToken = commandLine.match(/--csrf_token\s+([0-9a-f-]+)/)?.[1];
  return pid && csrfToken ? { pid, csrfToken } : null;
}

function findListeningPorts(pid: string): number[] {
  if (process.platform === 'win32') return findListeningPortsWin(pid);
  return findListeningPortsUnix(pid);
}

function findListeningPortsUnix(pid: string): number[] {
  let out: string;
  try {
    out = execFileSync('lsof', ['-iTCP', '-sTCP:LISTEN', '-nP', '-a', '-p', pid], {
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch {
    return [];
  }
  return [...out.matchAll(/:(\d+)\s+\(LISTEN\)/g)].map((match) => Number(match[1]));
}

function findListeningPortsWin(pid: string): number[] {
  let out: string;
  try {
    out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 5000 });
  } catch {
    return [];
  }
  const ports: number[] = [];
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.at(-1) !== pid) continue;
    const port = Number(parts[1]?.match(/:(\d+)$/)?.[1]);
    if (Number.isFinite(port)) ports.push(port);
  }
  return ports;
}

async function rpcGetTrajectory(
  server: AntigravityServer,
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return rpcPost(server, method, body, 10000);
}

async function rpcPost(
  server: AntigravityServer,
  method: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const response = await fetch(
    new URL(`/exa.language_server_pb.LanguageServerService/${method}`, server.baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'X-Codeium-Csrf-Token': server.csrfToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${method}`);
  return response.json();
}

function projectFromTrajectory(trajectory: Record<string, unknown>): string {
  const workspace = readArray(readPath(trajectory, ['metadata', 'workspaces']))[0];
  if (!isRecord(workspace)) return 'unknown';
  const computedName = getString(readPath(workspace, ['repository', 'computedName']));
  if (computedName) return computedName;
  return projectFromUri(getString(workspace.workspaceFolderAbsoluteUri)) ?? 'unknown';
}

function projectFromUri(uri: string | undefined): string | null {
  if (!uri) return null;
  return path.basename(uri.replace(/\/+$/, '')) || null;
}

function resolveModel(chatModel: Record<string, unknown>): string {
  const responseModel = getString(chatModel.responseModel);
  if (responseModel) return MODEL_NORMALIZE_MAP[responseModel] ?? responseModel;
  const placeholder = getString(chatModel.model);
  if (placeholder && PLACEHOLDER_MODEL_MAP[placeholder]) return PLACEHOLDER_MODEL_MAP[placeholder];
  return 'unknown';
}

function toTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function readPath(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function readCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
