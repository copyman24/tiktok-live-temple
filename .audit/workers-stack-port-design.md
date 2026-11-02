# Chosen Workers design

## Shape

One public Worker serves `public/` through the Assets binding and forwards `/rpc`, `/api/state`, `/api/tts`, `/tts-cache/*`, and `/ws` to one fixed-name `TempleRoom` Durable Object. The fixed name preserves the current one-channel-per-process behavior. There is no TikTok OAuth, app login, or tenant layer.

`TempleRoom` owns the current state snapshot, TikTok connection, browser WebSockets, JSON-RPC dispatcher, event fanout, and a single Durable Object alarm for `autoSim` and reconnect work. State transitions retain the existing `temple.event` event and state payload. The Durable Object persists the full app snapshot under one storage key, matching the current JSON state shape and minimizing this first port's moving parts.

The connector remains `tiktok-live-connector@2.5.0`, behind Worker-only aliases for `got`, `ws`, and the one `node:net.isIP` helper. The shim replaces Node HTTP with `fetch()` and Node event-emitter WebSocket behavior with Workers' native WebSocket. These are compatibility adapters, not proof that a TikTok Live session will connect.

`/api/tts` reports that speech runs in the OBS/browser via Web Speech API. `public/js/audio.js` selects an installed `vi-VN` voice and speaks queued event text. This avoids a local Python process and an external key. It does not preserve ZeroTTS's Mai Chi voice, and it depends on the browser/host having Vietnamese speech support.

## Runtime evidence and gates

- Wrangler 4.156.0 rejected the unmodified connector during module initialization in `http2-wrapper`.
- With the three adapter aliases, Wrangler loaded the exact locked package and a request imported `TikTokLiveConnection`.
- The package resolved `zenfacts_vn` to room `7702686835885705990` using its HTTP APIs through Worker `fetch()`.
- The profile was offline at the time of the check. Attempting its outbound connection reached the WebSocket handshake and received HTTP 200 instead of upgrade status 101. This does not prove the native WebSocket adapter can connect to an active TikTok Live. Run that check after an operator starts a public Live.

## Alternatives

- Chosen candidate: [candidate 1](/tmp/arena-workers-port/candidate-1/design.md), because one object snapshot is closest to existing code and keeps this no-auth, single-room port small.
- Candidates 2 and 3 proposed a relational SQLite schema. Their generation fences and durable scheduling inform the chosen connection/alarm path, but the additional schema and query code do not help this first single-room port enough to justify the extra migration surface.
- Cross-judge was skipped: the repository's `arena cross-judge pool` routes every seat to `inherit-parent`, so a different-family judge is unavailable under the user's model-routing instructions.
- TTS model investigation ruled out MeloTTS for Vietnamese. The official MyShell language list names English, Spanish, French, Chinese, Japanese, and Korean, not Vietnamese. This port therefore uses host browser speech and labels the loss of Mai Chi voice explicitly.
