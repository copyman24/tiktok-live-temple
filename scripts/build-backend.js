const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const targets = {
  'x86_64-pc-windows-msvc': {
    bunTarget: 'bun-windows-x64',
    extension: '.exe'
  },
  'x86_64-unknown-linux-gnu': {
    bunTarget: 'bun-linux-x64',
    extension: ''
  }
};

const targetTriple = process.env.TAURI_ENV_TARGET_TRIPLE || (
  process.platform === 'win32' ? 'x86_64-pc-windows-msvc' : 'x86_64-unknown-linux-gnu'
);
const target = targets[targetTriple];
if (!target) {
  console.error(`No Bun backend build target is configured for ${targetTriple}.`);
  process.exit(1);
}

const outputDir = path.join('src-tauri', 'binaries');
const outputPath = path.join(outputDir, `temple-backend-${targetTriple}${target.extension}`);
fs.mkdirSync(outputDir, { recursive: true });

const result = spawnSync('bun', [
  'build',
  '--compile',
  `--target=${target.bunTarget}`,
  '--outfile',
  outputPath,
  'server.js'
], { stdio: 'inherit' });

if (result.error) {
  console.error(`Could not run Bun: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Built ${outputPath}`);
