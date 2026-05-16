#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const cliDir = resolve(root, 'apps/cli');

const requiredFiles = ['package.json', 'bin/nowcoding.js', 'dist/index.js', 'README.md', 'LICENSE'];

const forbiddenEntries = [
  'src/',
  'tests/',
  '.env',
  '.turbo/',
  'node_modules/',
  'tsconfig.tsbuildinfo',
];

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

const errors = [];

try {
  run('pnpm', ['--dir', cliDir, 'build'], { cwd: root });
} catch (error) {
  process.stderr.write(error.stdout ?? '');
  process.stderr.write(error.stderr ?? '');
  console.error('failed to build CLI package');
  process.exit(1);
}

let packOutput;

try {
  packOutput = run('npm', ['pack', '--dry-run', '--json'], { cwd: cliDir });
} catch (error) {
  process.stderr.write(error.stdout ?? '');
  process.stderr.write(error.stderr ?? '');
  console.error('failed to run npm pack --dry-run --json');
  process.exit(1);
}

let packJson;

try {
  packJson = JSON.parse(packOutput);
} catch {
  errors.push('npm pack did not emit valid JSON');
}

const packFiles = Array.isArray(packJson?.[0]?.files)
  ? packJson[0].files.map((file) => file.path).sort()
  : [];
const packFileSet = new Set(packFiles);

for (const file of requiredFiles) {
  if (!packFileSet.has(file)) {
    errors.push(`missing required file: ${file}`);
  }
}

for (const file of packFiles) {
  for (const forbiddenEntry of forbiddenEntries) {
    if (file === forbiddenEntry || file.startsWith(forbiddenEntry)) {
      errors.push(`forbidden file in package: ${file}`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log('ok cli package dry-run');

for (const file of packFiles) {
  console.log(`pack ${file}`);
}

const tempDir = mkdtempSync(resolve(tmpdir(), 'nowcoding-cli-pack-'));

try {
  const packJson = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', tempDir], { cwd: cliDir }),
  );
  const filename = packJson?.[0]?.filename;
  if (!filename) {
    console.error('npm pack did not report a tarball filename');
    process.exit(1);
  }

  const installDir = resolve(tempDir, 'install');
  mkdirSync(installDir);
  run('npm', ['init', '-y'], { cwd: installDir });
  run('npm', ['install', '--ignore-scripts', resolve(tempDir, filename)], { cwd: installDir });
  run('node', ['node_modules/nowcoding/bin/nowcoding.js', '--help'], { cwd: installDir });
  console.log('ok cli package install');
} catch (error) {
  process.stderr.write(error.stdout ?? '');
  process.stderr.write(error.stderr ?? '');
  console.error('failed to install packed CLI package');
  process.exit(1);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
