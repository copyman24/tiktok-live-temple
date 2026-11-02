# Impeccable detector findings

The single required mechanical scan ran against `public/index.html`, `public/admin.html`, both page stylesheets, the shared theme, and `public/js/live.js`. It ran before the final desktop radius and touch-target refinements; no second detector run was made.

## Acted on

- `border-accent-on-rounded` on the quick dock: removed the 3 px radius. Its 5 px cinnabar seal border now sits on a square paper surface.

## Verified as intentional or static false positives

- `stage-wrapper` cramped padding: the 9:16 scene is intentionally full-bleed, as required by the OBS source and direction contract. The final browser capture shows the existing temple art filling the stage.
- `buried-raster` on inactive pose frames: these are the existing sprite animation's alternate poses. The kneeling frame is active and visible; the others wait for the unchanged ritual animation.
- `repeating-stripes-gradient`: the match is the existing animated conic halo around the Buddha, part of the stage scene rather than a background texture.
- `dock-section` cramped padding: the grouped controls have 16 px block padding; the last section intentionally has no trailing rule. The desktop dock scrolls internally and the phone dock flows to full height.
- Admin `panel` cramped padding: the desktop divider modifiers add 28 px content inset. At phone widths the vertical dividers are removed and sections receive 18 px bottom spacing. Computed browser styles confirmed these values.
