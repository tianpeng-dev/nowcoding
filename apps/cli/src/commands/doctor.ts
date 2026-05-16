import os from 'node:os';
import {
  type ParserContext,
  type ParserDataKind,
  type ParserSupportStatus,
  allParsers,
  parserMetadata,
} from '@nowcoding/parsers';
import { fetchServerSettings } from '../lib/api.js';
import { loadConfig } from '../lib/config.js';

export function formatParserDoctorLine(input: {
  source: string;
  status: ParserSupportStatus;
  dataKind: ParserDataKind;
  detected: boolean;
}): string {
  return `Parser ${input.source} [${input.status}/${input.dataKind}]: ${
    input.detected ? 'detected' : 'not present'
  }`;
}

export async function runDoctor(): Promise<void> {
  console.log('NowCoding doctor');
  console.log('================');
  console.log(`Node: ${process.version}`);
  console.log(`OS: ${os.platform()} ${os.release()}`);
  console.log(`Hostname: ${os.hostname()}`);

  const cfg = await loadConfig();
  if (!cfg) {
    console.log('Config: ❌ not found (run `nowcoding init`)');
    process.exit(1);
  }
  console.log(`Config: ✓ ${cfg.endpoint}`);

  const server = await fetchServerSettings(cfg);
  console.log(`Server reachable: ${server ? '✓' : '❌ (privacy will fail-closed)'}`);

  const ctx: ParserContext = {
    homeDir: os.homedir(),
    hostname: cfg.hostname,
    fileCache: {},
    scannedFiles: [],
    allowProject: false,
  };
  for (const parser of allParsers()) {
    const detected = await parser.detect(ctx);
    const meta = parserMetadata.find((item) => item.source === parser.source);
    console.log(
      formatParserDoctorLine({
        source: parser.source,
        status: meta?.status ?? 'generic',
        dataKind: meta?.dataKind ?? 'jsonl',
        detected,
      }),
    );
  }
}
