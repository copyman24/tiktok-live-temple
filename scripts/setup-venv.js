// postinstall: creates the ZeroTTS Python environment (.venv, Python 3.11) with uv if it is missing,
// and installs zerotts + pillow when they are not importable. Never fails the install:
// without uv or on error it prints how to do it by hand and exits 0.
// Skip with SKIP_VENV_SETUP=1 (also skipped when CI is set).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const venv = path.join(root, '.venv');
const python = process.platform === 'win32'
  ? path.join(venv, 'Scripts', 'python.exe')
  : path.join(venv, 'bin', 'python');
const manual = `uv venv .venv --python 3.11 && uv pip install --python ${path.relative(root, python)} zerotts pillow`;

function run(cmd, args, quiet = false) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: quiet ? 'ignore' : 'inherit', shell: false });
  return result.status === 0;
}

function main() {
  if (process.env.SKIP_VENV_SETUP === '1' || process.env.CI) {
    console.log('[setup-venv] skipped');
    return;
  }
  if (!run('uv', ['--version'], true)) {
    console.warn(`[setup-venv] uv not found; voice (ZeroTTS) disabled until you run:\n  ${manual}`);
    return;
  }
  if (!fs.existsSync(python)) {
    console.log('[setup-venv] creating .venv (Python 3.11)…');
    if (!run('uv', ['venv', '.venv', '--python', '3.11'])) throw new Error('uv venv failed');
  }
  if (run(python, ['-c', 'import zerotts, PIL'], true)) {
    console.log('[setup-venv] .venv ready');
    return;
  }
  console.log('[setup-venv] installing zerotts + pillow…');
  if (!run('uv', ['pip', 'install', '--python', python, 'zerotts', 'pillow'])) throw new Error('uv pip install failed');
  console.log('[setup-venv] .venv ready');
}

try {
  main();
} catch (error) {
  console.warn(`[setup-venv] ${error.message}; set it up by hand:\n  ${manual}`);
}
