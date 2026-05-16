import type { MessageRecord } from '@nowcoding/core';

export interface ParserContext {
  homeDir: string;
  hostname: string;
  // P1-1: per-file mtime/size cache for incremental sync.
  fileCache: Record<string, { mtime: number; size: number }>;
  // mutate during parse to record what was scanned.
  scannedFiles: { path: string; mtime: number; size: number }[];
  // Controls whether the parser may emit raw project names.
  allowProject: boolean;
}

export interface ParserResult {
  source: string;
  records: MessageRecord[];
  errors: { path: string; error: string }[];
}

export abstract class BaseParser {
  abstract readonly source: string;

  // Parsers implement this to detect whether the tool's data exists locally.
  abstract detect(ctx: ParserContext): Promise<boolean>;

  // Returns parsed message records (raw, pre-aggregation).
  abstract parse(ctx: ParserContext): Promise<ParserResult>;

  protected sanitizeProject(project: string, allowProject: boolean): string {
    return allowProject ? project : 'unknown';
  }
}
