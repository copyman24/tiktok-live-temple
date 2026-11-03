import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = {
  'x86_64-pc-windows-msvc': { bunTarget: 'bun-windows-x64', extension: '.exe' },
  'x86_64-unknown-linux-gnu': { bunTarget: 'bun-linux-x64', extension: '' }
};
const hostTriple = process.platform === 'win32' ? 'x86_64-pc-windows-msvc' : 'x86_64-unknown-linux-gnu';
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple;
const target = targets[triple];

if (!target) {
  console.error(`No wedding backend build is configured for ${triple}.`);
  process.exit(1);
}

const isolation = spawnSync(process.execPath, [resolve(appRoot, 'scripts', 'check-isolation.mjs')], { cwd: appRoot, stdio: 'inherit' });
if (isolation.error) {
  console.error(`Could not run the standalone app boundary check: ${isolation.error.message}`);
  process.exit(1);
}
if (isolation.status !== 0) process.exit(isolation.status || 1);

const output = resolve(appRoot, 'src-tauri', 'binaries', `wedding-backend-${triple}${target.extension}`);
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync('bun', [
  'build',
  '--compile',
  `--target=${target.bunTarget}`,
  '--outfile',
  output,
  resolve(appRoot, 'src', 'main.js')
], { cwd: appRoot, stdio: 'inherit' });

if (result.error) {
  console.error(`Could not run Bun: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Built independent wedding backend: ${output}`);
