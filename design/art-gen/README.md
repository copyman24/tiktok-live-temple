# Procedural art

Generators for raster art drawn in code. Each one builds SVG and rasterises it in headless Chromium (`playwright-core`). It uses `CHROME_PATH`, the browser in `~/.cache/ms-playwright`, or an installed Chrome or Edge.

- `devotees.mjs` draws the devotee in 8 looks × 8 poses. The looks are four áo tràng colours (`lam` grey-blue, `nau` brown, `trang` white, `vang` light yellow), each with a bun (`-nu`) or short hair (`-nam`). It writes `public/assets/devotees/<look>/<pose>.webp`, and also the default look (`lam-nu`) under the original names `public/assets/devotee*.png`. The stage gives each viewer one look, chosen by a hash of their TikTok id, so the same person looks the same in the hall, on a VIP cushion and walking to the incense burner.
  - `bun run art:devotees`: regenerate everything
  - `bun design/art-gen/devotees.mjs --out <dir> --sheet <sheet.png> [--only lam-nam]`: preview into another folder; the sheet has one row per look
  - To add a robe colour, add a palette to `PALETTES` and the new look names to `DEVOTEE_VARIANTS` in `public/js/live.js`.
- `backgrounds.mjs` draws alternative stage backgrounds (1080 × 1920) into `public/assets/backgrounds/`. It currently draws two backgrounds:
  - `dem-hoa-dang.webp`: an outdoor night scene with sky lanterns.
  - `dai-dien.webp`: a deep temple hall with a small Buddha at the far end. It uses layout `hall` (set in `BACKGROUND_LAYOUTS` in `src/temple/server.js`), which hides the big halo overlay.

  Run `bun run art:backgrounds` to draw both, or add `--only <name>` to draw one.
  - A background must keep the layout of `public/assets/amitabha_stage.webp`, or the stage overlays won't line up:
    - Buddha's head at (540, 262), with the lotus in the hands at (540, 510);
    - incense burner at x 540, y 900–1010;
    - six cushions at y 1188, centred on x 140, 268, 392, 688, 812 and 940;
    - carpet top edge at y 1262, from x 445 to 635.
  - Any image dropped into `public/assets/backgrounds/` shows up as a choice under "Hình nền" in the quick dock. The choice is saved on the server, and every stage page switches to it.
