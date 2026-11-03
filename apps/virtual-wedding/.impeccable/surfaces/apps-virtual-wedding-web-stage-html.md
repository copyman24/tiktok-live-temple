---
version: 1
slug: "apps-virtual-wedding-web-stage-html"
primary_target: "apps/virtual-wedding/web/stage.html"
related_targets: ["apps/virtual-wedding/web/index.html"]
---

# Virtual Wedding Live audience stage

## Scope

Audience-facing 9:16 live scene for viewers joining a TikTok wedding. The operator uses the companion dashboard. OBS opens `/stage?obs=1` without operator controls.

## Audience, job, proof, and constraints

Viewers want to see the couple, understand the live ceremony state, claim an open role, post a wish, and celebrate together. The real proof is the live couple, current ceremony phase, current like progress, accepted wishes, and reactions from the connected room. Viewers interact with TikTok comments (`#codau`, `#chure`, `#loichuc <message>`), likes, follows, shares, members, and gifts. Gifts decorate the scene but never determine ceremony progress. The app is standalone and carries no prayer assets or behavior.

## Direction contract

THESIS: A welcoming wedding hall that viewers can join through comments; the scene stays a working livestream with the ceremony as its focus.

OWN-WORLD: Lacquer red, warm ivory, antique gold, and deep green foliage. Use a richly lit Vietnamese wedding hall, ceremonial arch, floral framing, a red aisle, refined gold edging, and clear translucent ribbons for live wishes.

STORY: Viewers see the couple and current ceremony phase first, then the live progress and guests' wishes. A compact bottom strip teaches the four comment actions. New viewers can join without sending a gift.

FIRST VIEWPORT: Full-bleed 9:16 portrait. Compact live-room status and like meter at the top; couple and ceremony sign centered in the upper middle; guest-lined red aisle fills the lower half; a few live wishes sit beside the aisle; four clear role, wish, and celebration prompts anchor the bottom.

FORM: The full-room stage comp, `.impeccable/mocks/wedding-stage-1.png`, is the selected first of three comps. It follows the user's supplied screenshot and keeps the couple, guests, aisle, and participation controls in one view. The user directed the app work to continue, so the closest match to that reference is the delegated selection. `seed: none (user-pinned screenshot; concept-seed not run)`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
