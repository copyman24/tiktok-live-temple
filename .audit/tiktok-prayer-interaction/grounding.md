# TikTok prayer interaction grounding

## User goal

Improve the live scene's texture and animations, and show randomly selected TikTok comment and username pairs as background prayers so viewers see their participation in the live.

## Existing flow

`WebcastEvent.CHAT` in `server.js` extracts the viewer and comment, then calls `parseViewerComment()`. The parser rejects invalid or unsafe text, applies a 3.5-second per-viewer cooldown, and invokes one ritual. Every accepted comment triggers a ritual, including generic comments that do not match a keyword. Each ritual broadcasts `temple.event` with `{ event, state }`.

The event shape is not a stable record of the source comment. For example, prayer events use `wish`, fortune events use `topic`, and wooden-fish events carry no comment. `public/js/live.js` receives `temple.event` in `connectWebSocket()` and runs `triggerRitualVisuals()`. There is no notification for the original comment pair.

## Existing live composition

`public/index.html` defines one fixed 1080 by 1920 stage. Its layers include the temple artwork, halo, central worshipper, congregation, carpet walker, sky lanterns, particles, and bottom HUD. `#skyLanternsLayer` is foreground. The existing composition is dense around the congregation and lower HUD, so a background prayer needs a reserved side area that does not cover the central worshipper or viewer actions.

`public/css/live.css` contains a slow halo rotation, ritual movement, and responsive rules. Its reduced-motion block shortens CSS animation, while JavaScript pose timers keep switching sprite frames. `public/js/particles.js` runs at 30 FPS and pauses when the document is hidden.

## Design question

The live page needs a stable, safe record of an accepted comment and its author. The current `temple.event` shape cannot supply that consistently. A separate notification carrying `{ user, comment }` is one candidate, not a pinned decision. The design should compare where random selection belongs, how it avoids invoking a second ritual, and how a background display fits the stage.

## Constraints

- Preserve the current ritual, audio, merit, RPC, and TikTok connection behavior.
- Keep the new message independent from `temple.event` so event payloads stay stable.
- Render viewer data through text-safe DOM APIs.
- Use fixed-stage coordinates and preserve the clean `/?obs=1` composition.
- Preserve the prayer-petition direction: warm paper, ink, restrained cinnabar, and the supplied temple art as the main ornament.
- Keep new motion event-driven and provide a reduced-motion path.
