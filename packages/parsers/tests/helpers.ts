import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ParserContext } from '../src/index';

export async function makeTempHome(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempHome(homeDir: string): Promise<void> {
  await fs.rm(homeDir, { recursive: true, force: true });
}

export function parserContext(homeDir: string, allowProject = false): ParserContext {
  return {
    homeDir,
    hostname: 'test-host',
    fileCache: {},
    scannedFiles: [],
    allowProject,
  };
}

export async function writeFixture(
  homeDir: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const target = path.join(homeDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  return target;
}

export async function readParserFixture(source: string, name: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), 'packages/parsers/tests/fixtures', source, name), {
    encoding: 'utf8',
  });
}
