# Procedural art

Generators for raster art drawn in code. Each one builds SVG and rasterises it in headless Chromium (`playwright-core`, using the browser in `~/.cache/ms-playwright` or `CHROME_PATH`).

- `devotees.mjs` writes the 8 devotee pose sprites to `public/assets/`. Run it with `bun run art:devotees`, or `bun design/art-gen/devotees.mjs --out <dir> --sheet <sheet.png>` to preview.
