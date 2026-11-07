// Build the classroom pages (React + Tailwind 4) with Bun's bundler into apps/classroom/dist.
// bun run classroom:build
import tailwind from 'bun-plugin-tailwind';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dir, '..');
const outdir = path.join(appRoot, 'dist');
fs.rmSync(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [path.join(appRoot, 'web', 'index.html')],
  outdir,
  minify: true,
  sourcemap: 'linked',
  target: 'browser',
  plugins: [tailwind],
  // stage art is served by the classroom server at /assets (public/assets), not bundled
  external: ['/assets/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
});

if (!result.success) {
  for (const message of result.logs) console.error(message);
  process.exit(1);
}
for (const output of result.outputs) {
  console.log(`  ${path.relative(appRoot, output.path)}  ${(output.size / 1024).toFixed(0)} KB`);
}
console.log(`Built classroom web into ${path.relative(process.cwd(), outdir) || outdir}`);
