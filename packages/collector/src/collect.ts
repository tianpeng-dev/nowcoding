import os from 'node:os';
import { type MessageRecord, aggregateToBuckets, extractSessions } from '@nowcoding/core';
import { type ParserContext, allParsers, parserMetadata } from '@nowcoding/parsers';

export const availableSources = parserMetadata
  .filter((item) => item.status !== 'disabled')
  .map(({ source, displayName }) => ({ source, displayName }));

export async function collect(
  sources: string[],
  allowProject = false,
  homeDir = process.env.NOWCODING_SOURCE_HOME ?? os.homedir(),
) {
  const records: MessageRecord[] = [];
  const errors: { source: string; message: string }[] = [];
  const files: ParserContext['scannedFiles'] = [];
  for (const parser of allParsers()) {
    if (!sources.includes(parser.source)) continue;
    const context = {
      homeDir,
      hostname: os.hostname(),
      allowProject,
      fileCache: {},
      scannedFiles: files,
    };
    if (!(await parser.detect(context))) continue;
    const result = await parser.parse(context);
    if (result.errors.length) {
      errors.push(...result.errors.map((e) => ({ source: parser.source, message: e.error })));
      continue;
    }
    for (const record of result.records) {
      records.push({ ...record, project: allowProject ? record.project : 'unknown' });
    }
  }
  return {
    buckets: aggregateToBuckets(records),
    sessions: extractSessions(records),
    errors,
    files,
  };
}
