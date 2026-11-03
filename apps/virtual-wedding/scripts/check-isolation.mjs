import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(appRoot, 'src');
const rustRoot = resolve(appRoot, 'src-tauri', 'src');
const packageJson = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(resolve(appRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const cargo = readFileSync(resolve(appRoot, 'src-tauri', 'Cargo.toml'), 'utf8');
const failures = [];

if (packageJson.name !== 'virtual-wedding-live') failures.push('The npm package name is not wedding-specific.');
if (Object.values(packageJson.dependencies || {}).some((version) => /^(workspace:|file:\.\.)/.test(version))) {
  failures.push('The app depends on a workspace or parent-directory package.');
}
if (config.productName !== 'Virtual Wedding Live') failures.push('The Tauri product name is not wedding-specific.');
if (config.identifier !== 'com.linhung.virtualweddinglive') failures.push('The Tauri identifier is not wedding-specific.');
if (config.build?.frontendDist !== 'http://127.0.0.1:3108') failures.push('The Tauri frontend does not use the wedding port.');
if (!config.bundle?.externalBin?.includes('binaries/wedding-backend')) failures.push('The Tauri sidecar name is not wedding-specific.');
if (!cargo.includes('name = "virtual-wedding-live"')) failures.push('The Rust crate name is not wedding-specific.');

for (const [source, target] of Object.entries(config.bundle?.resources || {})) {
  const sourcePath = resolve(appRoot, 'src-tauri', source);
  if (!sourcePath.startsWith(`${appRoot}/`)) failures.push(`A Tauri resource escapes the app directory: ${source}`);
  if (!String(target).startsWith('web/')) failures.push(`A Tauri resource maps outside the wedding web directory: ${target}`);
}

const forbidden = /tiktok-live-temple|com\.linhung\.tiktoklivetemple|temple-backend|TEMPLE_SHUTDOWN_TOKEN|\bRituals\b/;
for (const root of [sourceRoot, rustRoot]) {
  for (const file of filesUnder(root)) {
    const content = readFileSync(file, 'utf8');
    if (forbidden.test(content)) failures.push(`Prayer-app reference found in ${file.slice(appRoot.length + 1)}.`);
    if (extname(file) === '.js') {
      for (const match of content.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)) {
        const target = resolve(dirname(file), match[2]);
        if (!target.startsWith(`${appRoot}/`)) failures.push(`Local import escapes the app directory: ${match[2]} in ${file.slice(appRoot.length + 1)}.`);
      }
    }
  }
}

if (failures.length) {
  console.error('Standalone app boundary check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Standalone app boundary verified: package, Rust crate, Tauri identity, port, resources, sidecar, and source imports are wedding-local.');

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = resolve(directory, name);
    return statSync(file).isDirectory() ? filesUnder(file) : [file];
  });
}
