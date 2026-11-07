// Compiles the TikTok Live Studio backend (prayer + wedding + classroom sessions) into one Tauri sidecar.
// The classroom's React pages are built first (apps/classroom/dist is bundled as a Tauri resource).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

const web = spawnSync('bun', [path.join(repoRoot, 'apps', 'classroom', 'scripts', 'build-web.ts')], { cwd: repoRoot, stdio: 'inherit' });
if (web.error || web.status !== 0) {
  console.error(`Could not build the classroom pages${web.error ? `: ${web.error.message}` : ''}.`);
  process.exit(web.status || 1);
}
const targets = {
  'x86_64-pc-windows-msvc': { bunTarget: 'bun-windows-x64', extension: '.exe' },
  'x86_64-unknown-linux-gnu': { bunTarget: 'bun-linux-x64', extension: '' }
};
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || (
  process.platform === 'win32' ? 'x86_64-pc-windows-msvc' : 'x86_64-unknown-linux-gnu'
);
const target = targets[triple];
if (!target) {
  console.error(`No studio backend build target is configured for ${triple}.`);
  process.exit(1);
}

const output = path.join(repoRoot, 'apps', 'live-studio', 'src-tauri', 'binaries', `studio-backend-${triple}${target.extension}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
const result = spawnSync('bun', [
  'build',
  '--compile',
  `--target=${target.bunTarget}`,
  '--outfile',
  output,
  path.join(repoRoot, 'apps', 'live-studio', 'src', 'main.js')
], { cwd: repoRoot, stdio: 'inherit' });

if (result.error) {
  console.error(`Could not run Bun: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Built ${output}`);
