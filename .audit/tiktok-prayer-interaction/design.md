# Live prayer spotlight design

## Problem

TikTok chat comments already trigger one ritual in `server.js`, but `temple.event` does not preserve the original comment in a consistent field. The live screen needs to select a viewer comment and show it as a background prayer without triggering a second ritual. The current stage is a fixed 1080 by 1920 scene with a crowded lower HUD and a fortune hotspot on the right.

## Usage

TikTok viewers keep commenting as they do now. Once the existing parser accepts a comment, the server publishes one separate, short-lived notification. The browser queues the pair and chooses a random recent comment when the prayer slip is free.

```js
// Existing TikTok chat and comment-simulation calls keep their ritual result.
handleViewerComment(comment, nickname, uniqueId, avatar);

// The server sends only comments accepted by the existing parser.
{ jsonrpc: '2.0', method: 'temple.prayerComment', params: {
  username: '@minhquan_bds',
  comment: 'Cầu cho gia đình bình an'
} }

// The live client queues and later displays one random pair.
queuePrayerComment({ username, comment });
```

## Shape

The notification shape is `{ username: string, comment: string }`. The server builds `username` from TikTok's `uniqueId`, falling back to the sanitized nickname when there is no handle. `handleViewerComment()` calls `parseViewerComment()` once and publishes the notification only when that parser returns a ritual result. The display notification never calls a ritual or changes merit. Both `WebcastEvent.CHAT` and the `temple.comment` RPC use the same wrapper.

The browser owns an in-memory `PrayerComment[]` queue. Each entry adds a local `receivedAt` time. The queue holds at most 12 pairs, ignores duplicates that are already pending, drops the oldest pair on overflow, and removes one random pair for each display. Entries older than 60 seconds expire before selection. The selected pair is not re-enqueued. A brief gather delay lets several comments compete for selection; one prayer displays at a time. A room change or disconnect clears pending items and display timers. A temporary WebSocket interruption retains only fresh items, and a page reload starts with an empty queue.

## Visual and motion contract

Add one paper slip inside `#stage9x16` at x=24, y=700, width=400px. Put its layer at z-index 3, above the temple image and below the halo, ritual actors, and HUD. It stays on the left to avoid the right-side fortune hotspot. Its larger text size remains legible after the stage scales to phone dimensions. Long comments clamp to three lines.

Use a warm rice-paper surface with fine fiber lines, charcoal text, and one cinnabar seal. Apply the same low-contrast paper texture to the live screen's existing paper plaques and action buttons. The new slip enters with a short binding-edge reveal and a seal press, stays still while readable, then exits faster. The incense ember gets a short flicker when the incense sprites render. Neither effect loops continuously. Reduced-motion mode removes spatial motion and ember flicker while keeping the comment visible and its opacity transition brief.

## Modules

- `server.js` owns comment acceptance and sends the `temple.prayerComment` notification. It does not persist a queue or change `temple.event`.
- `public/index.html` owns the single prayer slip inside the fixed stage.
- `public/js/live.js` owns the bounded queue, random selection, room lifecycle cleanup, WebSocket handling, and text-safe DOM updates.
- `public/css/live.css` owns paper texture, stage placement, entrance and exit motion, ember feedback, and reduced-motion behavior.

## Synthesis decision

Candidate-root is the base. The cross-judge scored it 16/20, ahead of candidate 2 at 15/20, candidate 1 at 14/20, and candidate 3 at 14/20. It preserves the parser result, uses one wrapper for TikTok chat and simulated comments, and puts random selection in the live client so the server gains no timer or persistent state.

The cross-judge found that the original draft used `user` rather than TikTok's actual `uniqueId` handle and could place the card over the right fortune hotspot. Both are corrected here. The rendered prototype uses the actual current OBS capture at native size and at a 360 by 640 view. The final placement uses the left pillar, ends above the bell hotspot, and has a 400px width so the name and comment remain readable when scaled.

Grafts from candidate 1: expire comments older than 60 seconds before selection. Grafts from candidate 3: explicitly remove spatial motion under reduced-motion settings and clear the pending queue when the live room changes or disconnects.

Rejected candidate 2's server-owned queue because it adds timer lifecycle and broadcasts a shared selection even though one OBS source owns the audience-facing screen. Rejected candidate 3's server-owned interval for the same reason. Rejected the right-pillar layout from candidates 1 and 2 because it collides with the fortune control on the real stage.

## Tradeoffs accepted

- The main OBS page and any second browser page can select different comments. This keeps selection state with the screen and avoids server coordination.
- The 60-second freshness limit can discard slow-moving comments. It keeps the prayer tied to the current live moment.
- The left slip covers some flower and pillar artwork. It stays behind the central worshipper and does not cover ritual controls.
- Long comments truncate after three lines. This keeps the display legible without expanding over the stage.

## Alternatives considered

- A server queue can select one pair for every connected browser. It hides selection policy from the clients, but adds timer lifecycle and queue state to the backend.
- A foreground sky lantern reuses an existing ritual effect. It puts viewer text in front of the scene and can obscure the central worshipper.
- A permanent prayer wall can display more commenters at once. It competes with the already dense congregation and bottom HUD.

## Implementation reconciliation

The implementation follows this contract without changing the parser result, the `temple.event` payload, or persisted state. A local browser run showed the actual sanitized `@handle` and comment together, and one accepted comment changed merit by exactly one ritual's amount. At 1080×1920 and 360×640 the slip stays inside the stage and clear of both side controls. Reduced motion uses a 130ms opacity-only reveal, with the seal and ember animations disabled. After the display timer, the slip returns to `aria-hidden` and `visibility: hidden`.

The local ZeroTTS worker could not start because this environment lacks Python's `numpy` module. This did not prevent the live screen, RPC comment path, or visual verification from running.

## Open questions and risks

- A long username may truncate. Keep the full sanitized handle in the DOM text and clamp its visual line.
- Each browser has a separate random draw. If the operator needs to see the exact same selected comment as OBS, move selection to one shared server queue in a later design pass.
- The browser run exercised the shared `temple.comment` path, not a live TikTok room. Burst selection, overflow, expiry, pending duplicate suppression, and room-change cleanup were reviewed in source but not exercised at runtime.

## Verification artifacts

- `/tmp/tiktok-prayer-stage-visible.png` shows the accepted comment and actual handle at 1080×1920.
- `/tmp/tiktok-prayer-stage-phone-visible.png` shows the three-line clamp and stage fit at 360×640.
- `/tmp/tiktok-prayer-reduced-motion.png` shows the slip under reduced motion.
- `/tmp/tiktok-prayer-stage-exited.png` shows the settled scene after exit.
