# Browser review captures

Captured 2026-11-02 with headless `agent-browser` against the local Bun server at `http://localhost:3000`. These are rendered-page evidence; no production raster assets were created or replaced in this redesign. The temple artwork comes from the existing `/assets/amitabha_stage.png` asset.

The captures show the current local state: TikTok disconnected, ZeroTTS stopped, 108 incense, 1,080 merit, and empty event and leaderboard lists. These final captures were taken after shortening both username placeholders so they fit narrow fields; the stopped service reads “Đã dừng,” and admin section headings use Be Vietnam Pro. The earlier review set remains in this folder under its original names.

| File | Route | Viewport | Capture |
| --- | --- | ---: | --- |
| `final-live-desktop.png` | `/` | 1440 × 1000 | Full page |
| `final-live-mobile.png` | `/` | 390 × 844 | Full page |
| `final-live-320.png` | `/` | 320 × 800 | Full page |
| `final-admin-desktop.png` | `/admin` | 1440 × 1000 | Full page |
| `final-admin-mobile.png` | `/admin` | 390 × 844 | Full page |
| `final-admin-320.png` | `/admin` | 320 × 800 | Full page |
| `final-obs-portrait.png` | `/?obs=1` | 1080 × 1920 | Viewport |
| `final-obs-phone.png` | `/?obs=1` | 390 × 844 | Viewport |

All eight final files were opened and checked after capture. The OBS portrait stage is exactly 1080 × 1920 with the control dock hidden. At 390 × 844, the phone OBS stage is centered at 390 × 693 without horizontal overflow. The live stage measures 540 × 960 at desktop and 296 × 526 at 320 px.

Additional checks: the live page and admin page had no horizontal overflow at 390 px or 320 px. Dock controls, fields, sliders, and its link measured at least 44 px high at 320 px. The admin page showed all eight ritual buttons and had no unlabeled input fields. At 320 px, the live username placeholder measured 164 px against 238 px of field content width; the admin placeholder measured 177 px against 236 px. Both fit at the desktop and 390 px layouts as well.

The live TTS and music toggles were each switched off and back on in the browser; labels and active styling matched both states. The final capture was taken from the default enabled state. RPC actions were not fired during the visual review.

`agent-browser errors` returned no page errors. Axe found no violations on either page (40 live passes, 35 admin passes). Its live color-contrast check was incomplete because of scene compositing; the eight flagged text/surface pairs were measured from computed opaque colors at 6.31:1 or higher. The admin scan had no incomplete checks.
