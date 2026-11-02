---
version: 1
slug: "public-admin-html"
primary_target: "public/admin.html"
related_targets: []
---

Scope: `public/admin.html`.
Visitor mode: Operate.
Audience: the local operator running TikTok Live Studio, OBS, the Bun service, and the temple scene.
Task: connect or disconnect a room, test speech, choose the participant and wish, trigger a ritual, simulate a comment, and inspect the JSON-RPC response.
Content: current live totals, ZeroTTS state and voice, TikTok username, audio preview, eight ritual commands, comment simulation, and RPC output.
Constraints: preserve all endpoints and actions. Use standard web controls. Keep the complete workflow usable at phone width. The page is an operator tool, not an image of a prayer form.

## Direction contract

THESIS: Keep the operator's live state, available rituals, and command result visible in one workbench. The page refuses the current wall of equal controls and ambiguous emoji labels.

OWN-WORLD: Use a deep jade shell, warm gold form stock, charcoal ink, cinnabar for the primary action and active-seal mark, and a distinct green success state. Use the existing Vietnamese sans for operational text and a serif only for the page title. The live seal marks new activity; it does not replace familiar status labels or controls.

STORY: The operator checks service state, connects the room, sets audio, and runs an action. Comment simulation and the JSON-RPC response stay findable for testing. Links open the live and clean OBS views.

FIRST VIEWPORT: Use a compact header with service state and live-view links. Place room connection and voice testing first. Put participant and wish fields above the ritual action grid in the main work area. Keep comment simulation and the RPC response visible in a separate lower area. Collapse columns into one readable sequence on narrow screens.

FORM: Event-focused operator workbench, candidate 4 of 7; concept-seed reference `seed:2bf7a871361d01fa`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
