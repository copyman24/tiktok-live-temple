# Workers port architecture prompt

## Artifact

Produce a module and type sketch for a Cloudflare Workers port of this repository. Include request routing, durable ownership, data/state flow, external connections, a staged migration order, and the smallest runtime experiment that can reject the design. Save it in your assigned candidate directory as `design.md` and include a short rationale naming the alternatives considered and rejected.

## Goal and scope

Port the existing TikTok Live temple interaction app into the Cloudflare Workers runtime. There is no TikTok OAuth, SaaS login, or other auth requirement. Preserve the workflow where the operator enters a public TikTok username or Live URL, starts the stream manually in TikTok Studio, and uses the temple overlay as an OBS Browser Source. The backend connects to TikTok Live and translates chat, likes, gifts, follows, shares, and related events into temple rituals.

The UI and admin are static files under `public/`. Existing browser contracts include `/rpc` JSON-RPC, `/ws` JSON-RPC calls and notifications (`temple.state`, `temple.event`, `temple.viewerCount`, `tts.play`, and status updates), `/api/state`, `/api/tts`, and playable audio URLs. Preserve them unless the sketch names a necessary matching frontend change.

## Grounding in current code

- `server.js` is a single Bun/Node-style process with one process-global state and one `TikTokLiveConnection`.
- TikTok callbacks call ritual logic, mutate state, persist to `data/merit-state.json`, then broadcast `temple.event` to browser clients.
- Browser `/ws` is a downstream connection: it sends initial state, carries notifications and accepts RPC calls. It is separate from the TikTok-to-backend event socket.
- `tiktok-live-connector` 2.5.0 is unofficial and uses TikTok's internal live event feed. Whether it runs and stays connected in a Worker Durable Object is unproven.
- `ZeroTTSManager` starts a local Python worker, and cached WAV files live on local disk. Neither works as-is in Workers. `public/js/audio.js` expects `/api/tts` to return a playable URL.
- `configureAutoSim` uses `setInterval`; persistent scheduling needs a Workers-native lifecycle.
- Existing state is one active channel per process. Treat that as the current product behavior; don't invent user accounts or tenant management.

## Constraints

- The target deployment is Workers-compatible. A design that requires an always-on non-Workers backend does not meet the goal.
- Mutable state and both WebSocket lifecycles need an explicit owner and reconnect/recovery story. Workers requests may not retain ordinary process globals.
- Preserve `temple.event` payloads because the overlay uses the event to trigger animations, sound, and speech.
- State and generated audio cannot depend on a local filesystem.
- Do not deploy to a live Cloudflare account.
- Be explicit about anything that remains an unproven runtime dependency; do not assert the TikTok connector works without evidence.

## Rubric (score each 1–5)

1. **Behavior fit:** Keeps manual TikTok Live + public handle, OBS overlay, RPC, notification, ritual, and TTS browser contracts.
2. **Workers lifecycle fit:** Gives state, browser WebSockets, TikTok outbound connection, and scheduling concrete Cloudflare owners and recovery behavior.
3. **Small coherent design:** Avoids unnecessary services and abstractions while clearly separating frontend assets, interaction state, TikTok intake, and TTS where needed.
4. **Runtime proof:** Names a fast, falsifiable experiment for connector compatibility and connection recovery before investing in the full port.
5. **Migration and risks:** Orders small verifiable units and identifies specific compatibility, licensing, billing, or runtime limits.

Prefer the design that a maintainer can extend without weakening current single-channel semantics. Do not write code or edit repository files.
