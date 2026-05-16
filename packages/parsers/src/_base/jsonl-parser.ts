import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MessageRecord } from '@nowcoding/core';
import { BaseParser, type ParserContext, type ParserResult } from './base-parser';

export interface JsonlParserConfig {
  // path under homeDir to scan for *.jsonl files (recursively)
  rootSubpath: string;
  // file glob suffixes that are valid records (default '.jsonl')
  fileSuffix?: string;
}

/**
 * Generic JSONL parser base. Subclasses provide:
 *   - source name
 *   - rootSubpath relative to homeDir
 *   - toRecord(line, context) → MessageRecord | null
 *
 * Handles file walking, P1-1 mtime+size incremental cache, error capture,
 * and project-name privacy sanitisation. Each concrete parser stays small.
 */
export abstract class JsonlParser extends BaseParser {
  abstract override readonly source: string;
  abstract readonly config: JsonlParserConfig;

  // Subclass converts a parsed JSON line into a MessageRecord.
  protected abstract toRecord(line: unknown, project: string): MessageRecord | null;

  override async detect(ctx: ParserContext): Promise<boolean> {
    try {
      await fs.access(path.join(ctx.homeDir, this.config.rootSubpath));
      return true;
    } catch {
      return false;
    }
  }

  override async parse(ctx: ParserContext): Promise<ParserResult> {
    const root = path.join(ctx.homeDir, this.config.rootSubpath);
    const result: ParserResult = { source: this.source, records: [], errors: [] };
    const suffix = this.config.fileSuffix ?? '.jsonl';

    const files = await this.walk(root, suffix, result);
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
      const project = this.sanitizeProject(
        this.deriveProject(path.relative(root, file)),
        ctx.allowProject,
      );
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (e) {
          result.errors.push({ path: file, error: `parse: ${(e as Error).message}` });
          continue;
        }
        const rec = this.toRecord(json, project);
        if (rec) result.records.push(rec);
      }
    }
    return result;
  }

  // Subclasses may override to supply a tool-specific project derivation rule.
  protected deriveProject(relPath: string): string {
    // Default: top-level directory under rootSubpath.
    const parts = relPath.split(path.sep);
    return parts[0] ?? 'unknown';
  }

  private async walk(dir: string, suffix: string, result: ParserResult): Promise<string[]> {
    const out: string[] = [];
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        result.errors.push({ path: dir, error: err.message });
      }
      return out;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await this.walk(full, suffix, result)));
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        out.push(full);
      }
    }
    return out;
  }
}
