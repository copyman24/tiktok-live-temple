# Virtual Wedding Live architecture

## Goal

Build a TikTok Live wedding scene like the supplied Vietnamese wedding reference as a separate app and desktop binary. The wedding app owns its backend, ceremony state, UI, Tauri package, sidecar, identifier, resources, data directory, and port. It does not import or start the temple/prayer application. The only shared dependency is the independently declared third-party TikTok connector library.

## Synthesis

Candidate 1 is the base. It keeps one in-memory ceremony reducer, an isolated connector adapter, a thin JSON-RPC/WebSocket server, and a separately packaged Tauri sidecar. It has the smaller API and clearer first-release scope. Candidate 2's useful graft is host moderation of public role requests: viewers can ask for an open role, while the operator confirms or declines each request. Wishes, claims, guests, and provider combo tracking stay bounded. Persistence, a generic multi-app package, and a general event broker are deferred because a single live room does not need them.

The cross-judge phase was skipped: the supplied model routing assigns every architect runner and judge to inherit the parent model, while the arena requires a judge from another model family.

## Usage and module map

```text
apps/virtual-wedding/
  src/domain.js       # wedding state, command/input shapes, pure reducer
  (TikTok lifecycle and payload normalization come from packages/live-core, see below)
  src/server.js       # HTTP, JSON-RPC, WebSocket snapshots/events, static files
  src/main.js         # composition root and shutdown
  scripts/check-isolation.mjs # build-time app-boundary assertions
  scripts/build-backend.mjs   # Bun sidecar compiler for supported Tauri triples
  web/index.html      # host dashboard with live stage preview
  web/stage.html      # vertical livestream scene; ?obs=1 hides host chrome
  src-tauri/          # independent Rust crate and wedding-backend sidecar config
```

The operator connects a room, reviews `#codau` / `#chure` requests, confirms both participants, and advances the ceremony. `#loichuc <message>` adds a public wish. Likes fill a capped celebration meter. Follows, shares, members, and gifts add bounded visual reactions; none can advance the ceremony. The simulator uses the same normalized input path as TikTok callbacks.

## Core data shape

```ts
type Role = 'bride' | 'groom';
type Phase = 'lobby' | 'entrance' | 'vows' | 'rings' | 'celebration' | 'ended';
type Viewer = { id: string; name: string; avatar: string };
type Claim = { id: string; role: Role; viewer: Viewer; requestedAt: number };
type Participant = { viewer: Viewer; source: 'viewer' | 'host'; confirmedAt: number };

type TikTokInteraction =
  | { kind: 'comment'; viewer: Viewer; text: string }
  | { kind: 'like'; viewer: Viewer; count: number }
  | { kind: 'follow' | 'share' | 'member'; viewer: Viewer }
  | { kind: 'gift'; viewer: Viewer; name: string; count: number; coins: number };

type WeddingState = {
  sessionId: string;
  phase: Phase;
  couple: { bride: Participant | null; groom: Participant | null; locked: boolean };
  claims: Claim[];                 // at most 12, one open claim per viewer
  wishes: Array<{ id: string; viewer: Viewer; text: string; at: number }>; // at most 12
  guestIds: string[];              // bounded recent unique IDs
  wishCooldowns: Record<string, number>; // internal, at most 500 recent viewers
  likes: { total: number; goal: number };
  social: { follows: number; shares: number; gifts: number; members: number };
  updatedAt: number;
};
```

Viewer photos come from `Viewer.avatar` at runtime. Wish ribbons and viewer-claimed bride/groom roles use the associated TikTok profile URL, with initials when no usable URL exists; host-assigned roles also use initials. Do not package generated portraits as stand-ins for live viewers.

`reduceWedding(state, input, now)` returns the next state and zero or more public events. Its input union contains validated host commands and normalized TikTok interactions. The reducer alone changes ceremony state. The server owns it in memory; a backend restart begins a fresh lobby. Public snapshots contain display data only and a new WebSocket receives one current snapshot before future events.

The host controls `lobby -> entrance -> vows -> rings -> celebration -> ended`. Both participants are required before locking and starting. A role request only fills a pending claim; host confirmation assigns the participant. A viewer can have at most one pending claim, wishes are trimmed and capped to 240 characters with a per-viewer cooldown, likes and combo values are clamped at the connector boundary, and unknown chat is ignored. The simulator calls the same reducer as provider events.

## Local contract

- HTTP: `GET /health`, `POST /rpc`; WebSocket: `GET /ws`.
- JSON-RPC requests use `{ jsonrpc: '2.0', id, method, params }`; notifications are `wedding.state` and `wedding.event`.
- RPC commands include `wedding.state.get`, `wedding.open`, `wedding.assignRole`, `wedding.claim.confirm`, `wedding.claim.decline`, `wedding.couple.lock`, `wedding.phase.advance`, `wedding.end`, `wedding.likeGoal.set`, `wedding.goals.set` (kiss and toast goals), `wedding.bouquet.open`, `wedding.bouquet.toss`, `tiktok.connect`, `tiktok.disconnect`, and `wedding.simulate`.
- Viewer crowd state (teams, kiss chant, toasts, petals, bouquet entrants, gift book) lives in the same reducer. Per-viewer cooldowns and team membership are bounded, and the public snapshot exposes only counts, the bouquet winner, and the top five gift-book entries.
- `createWeddingServer({ standalone: false, live })` returns an embeddable instance (no port, `handleUpgrade`, `activate`/`deactivate`, `onLiveEvent`/`onLiveStatus`, `getPhase`) for TikTok Live Studio. Inside Studio, `live` is Studio's one shared TikTok connection: the wedding does not open its own, and switching sessions does not leave the room.
- The backend binds only `127.0.0.1:3108`. Tauri starts its own `wedding-backend` sidecar and uses an app-specific shutdown token.
- The Tauri product and crate are named `Virtual Wedding Live` / `virtual-wedding-live`; the app identifier is `com.linhung.virtualweddinglive`.
- App resources, logs, and local data resolve under the wedding app's own Tauri resource and application-data directories.

## Alternatives and tradeoffs

An in-temple mode was rejected because it would share prayer state, resources, lifecycle, and binary identity. A shared connector package was first rejected because the temple's connector was coupled to its rituals. With a third session (the classroom) planned, the neutral parts now live in `packages/live-core`: connect with a live check and timeout, reconnect with backoff (15 s doubling to 2 min) until `tiktok.disconnect`, a stale-event guard, gift-combo de-duplication, and `sentAt` (TikTok send time on the local clock). live-core contains no prayer code; `scripts/check-isolation.mjs` allows imports from it and scans it for prayer references. Stream states are `offline`, `connecting`, `live`, `reconnecting` and `error`; the dashboard offers "Dừng kết nối" while connecting or waiting to retry.

Two apps will duplicate small amounts of RPC and sidecar lifecycle code. That makes the standalone build obvious and keeps a wedding change from altering the prayer app. Ceremony state intentionally resets on restart; a future product requirement can add explicit session persistence.
