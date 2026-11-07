# live-core

Shared TikTok Live building blocks for the three sessions: Chùa Linh Ứng (prayer, repo root), Virtual Wedding Live (`apps/virtual-wedding`) and Lớp Học Chữ (`apps/classroom`). Each module combines the strongest version that existed in one of the apps.

| Module | What it does | Taken from |
| --- | --- | --- |
| `src/tiktok.js` | One room connection. It checks that the account is live, gives up a connect attempt after 30 s, and reconnects after a drop, a stream end or a failed attempt (15 s, doubling to 2 min) until `disconnect()`. Events from a replaced connection are dropped. Gift combos count only their new part. Every event carries `sentAt`: TikTok's send time mapped onto the local clock. | Lifecycle and `sentAt`: classroom. Stale-event guard and event shape: wedding. |
| `src/username.js` | `@handle`, profile URLs and `vt.tiktok.com` / `vm.tiktok.com` share links | prayer |
| `src/text.js` | Strange-character spam filter, NFKC name folding, banned words matched as whole words (so "vlog" and "lớn" pass) | prayer + classroom |
| `src/voice.js` | Speech service: Edge (cloud) → Google (cloud, correct language) → ZeroTTS (offline). Only the primary engine's results are cached. | classroom + prayer |
| `src/zerotts.js` | The resident Python ZeroTTS worker. Studio runs one for every session. | prayer |
| `src/store.js` | `bun:sqlite` storage with one row per write (collections and documents) | new |
| `src/rpc.js` | JSON-RPC 2.0 over `/ws` and `POST /rpc` | prayer + wedding |
| `src/speaker.js`, `browser/voice.js` | Only one stage page speaks (the newest). Browser speech queue with priorities, stale-line dropping and stuck-audio guards. | classroom |
| `src/analytics.js` | Viewers per phase: every 15 s, while live, it records the session, the phase and the viewer count. The report shows each phase's gain or loss per minute. | classroom |
| `src/time.js` | Day and ISO-week keys in Vietnam time | classroom |

## Events

```js
{ kind: 'comment', viewer, text, sentAt, receivedAt }
{ kind: 'like', viewer, count, totalLikes, sentAt, receivedAt }
{ kind: 'gift', viewer, name, giftId, count, coins, sentAt, receivedAt }   // count = new items only
{ kind: 'follow' | 'share' | 'member', viewer, sentAt, receivedAt }
// viewer = { id, name, avatar }   status.state = offline | connecting | live | reconnecting | error
```

## Tests

```sh
bun test packages/live-core
```
