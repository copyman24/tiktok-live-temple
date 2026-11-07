# Lớp Học Chữ (classroom session)

A 2D classroom for TikTok LIVE. The teacher, cô Ngân, reads a clue and the scrambled letters appear on the blackboard. Viewers type the answer as a comment, and the fastest correct answers score the most and sit at the front desks. A lesson has 20 questions: scrambled words, picture riddles, mental arithmetic, English, Vietnamese history and trick questions. There are also break-time games and two bigger games (Đường lên đỉnh Everest, Rung Chuông Đồng).

Ported from [workaipvlinh-byte/lop-hoc-chu](https://github.com/workaipvlinh-byte/lop-hoc-chu) (MIT, see `LICENSE`). The stage now draws its own art in SVG (`web/art/`: the classroom, cô Ngân with her poses and outfits, the students). The original author's painted images are still in `public/assets/nv` and `public/assets/bg`, but nothing uses them any more.

## Run

```sh
bun install                 # from the repository root
bun run classroom:start     # builds the pages, then http://localhost:3006
```

| URL | Purpose |
| --- | --- |
| `http://localhost:3006/` | Operator dashboard: connect TikTok, controls, rehearsal buttons, silent preview |
| `http://lvh.me:3006/?view=stage` | Stage for TikTok LIVE Studio (Link source) or OBS, 1080 × 1920. TikTok LIVE Studio does not accept `localhost`; `lvh.me` resolves to this machine. |
| `http://localhost:3006/bao-cao` | After-show report: hard and easy questions, attendance, viewers per phase |

In TikTok Live Studio (`bun run studio:start`) the classroom is the third session. Its stage is the shared `/obs` source.

## How it differs from the original

- **The lesson runs on the server** (`src/host.ts`, around the unchanged `Classroom` engine in `src/game/quiz.ts`). Before, it ran inside the stage page, so reloading OBS or switching Studio sessions restarted the lesson. Pages now only draw the latest view. The stage that speaks reports when each line starts and ends, so the server still pauses the clock while the teacher reads and shows the board only after the question has been read. With no stage open, or if a report never arrives, a line finishes after its estimated reading time.
- **Only one stage speaks.** The most recently opened `?view=stage` page has the voice. The others stay silent, so two OBS sources never play two voices at once.
- **Shared plumbing from `packages/live-core`:** the TikTok connection (auto-reconnect, `sentAt` timing), the voice (Edge → Google → offline ZeroTTS), text safety, and JSON-RPC over `/ws`. The original used server-sent events and REST.
- **Storage is `bun:sqlite`** (`<data>/classroom.db`), written one row at a time. It replaces `so-lop.json`, which was rewritten in full every few seconds.
- **Built with Bun**, not Vite (`scripts/build-web.ts`, Tailwind 4 through `bun-plugin-tailwind`). The question banks are read from disk at startup.

## Files

```text
src/game/          the original engine, unchanged (quiz.ts, config.ts, loi-thoai.ts, show.ts, math.ts, ...)
src/game/cau-hoi/  question banks, one topic per .txt file (format in the original README)
src/host.ts        server-side game loop, speech pacing, persistence
src/server.ts      HTTP + JSON-RPC factory (standalone or embedded in Studio)
web/               React pages (GameStage, Dashboard, GameControls) and the WebSocket client
web/art/           SVG art: Classroom (background), Teacher (poses by the old sprite names), Kid, limb.tsx (arm posing)
public/assets/     the original painted art (no longer used)
```

## Checks

```sh
bun run classroom:check     # question banks, 1,000-line engine test, TypeScript
```
