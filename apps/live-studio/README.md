# TikTok Live Studio

TikTok Live Studio runs **Chùa Linh Ứng Online** (prayer), **Virtual Wedding Live** (wedding) and **Lớp Học Chữ** (classroom) as three sessions inside one backend process and one desktop app. Only one session is live at a time. Switching sessions keeps the others' state: the ceremony and the lesson stay in memory (the lesson is paused), and temple merit and classroom scores are saved to disk.

## Run

From the repository root:

```sh
bun install
bun run wedding:install   # the wedding source keeps its own node_modules
bun run classroom:build   # the classroom's React pages
bun run studio:start      # http://127.0.0.1:3200/studio
```

| URL | Purpose |
| --- | --- |
| `/studio` | Session launcher. Choose a session, see each session's status, and copy the OBS address. |
| `/obs` | **One OBS browser source for every session** (1080 × 1920). It redirects to the active session's stage and reloads itself when you switch. |
| `/` | Operator page of the active session. A "LIVE STUDIO · Đổi phiên" pill links back to the launcher. |
| `/admin` | Temple admin panel (prayer session only). |
| `/bao-cao` | Classroom after-show report (classroom session only). |
| `/studio/bao-cao` | Viewers per phase for every session (`?ngay=YYYY-MM-DD` for another day). |

## One TikTok connection

Studio owns a single TikTok connection (`packages/live-core`). Connecting from any session's dashboard connects Studio, and switching sessions only changes which session receives the events, so the room is never dropped on a switch. The connection reconnects by itself after drops or a stream end (15 s, doubling to 2 min) until someone presses Disconnect. After a restart, Studio reconnects the account it was last connected to.

If "Giữ phòng TikTok đang kết nối khi đổi phiên" is unchecked in the launcher, switching sessions leaves the room.

## One voice worker

The local ZeroTTS worker loads a large model, so Studio starts one worker, the first time the prayer session opens. The prayer voice uses it. The classroom voice uses Edge and Google first and falls back to this worker when the internet voices fail. In every session, only the most recently opened OBS page speaks.

## Desktop build

```sh
bun run studio:tauri:dev  # development window
bun run studio:build      # release bundle (builds the classroom pages first)
```

- **Windows** (native terminal, not WSL): builds the ZeroTTS worker and the studio backend sidecar, then an NSIS installer under `apps/live-studio/src-tauri/target/release/bundle/nsis/`. Same prerequisites as the prayer app: Bun, `uv`, Python 3.11 and the MSVC build tools.
- **Linux**: deb, rpm and AppImage packages under `apps/live-studio/src-tauri/target/release/bundle/`. The Linux package has no bundled ZeroTTS worker, so the prayer voice works only when a Python environment with ZeroTTS is available.

The app ID is `com.linhung.tiktoklivestudio`, and the backend listens on `127.0.0.1:3200`. The studio can be installed next to the standalone prayer (port 3000), wedding (port 3108) and classroom (port 3006) apps.

## How it works

```text
apps/live-studio/
  src/studio.js        session manager + router (one HTTP server, one /ws upgrade path), shared live + voice + report
  src/main.js          entry point and signal handling
  web/                 launcher page, injected session pill, idle OBS page
  src-tauri/           Tauri crate, sidecar "studio-backend", bundles every app's web resources
scripts/build-studio-backend.js   classroom pages + bun build --compile → studio-backend-<target-triple>
scripts/build-studio-windows.ps1  ZeroTTS worker + studio backend for Windows
```

Every app is created through a factory in embedded mode, so none of them opens its own port: `src/temple/server.js` → `createTempleServer`, `apps/virtual-wedding/src/server.js` → `createWeddingServer`, `apps/classroom/src/server.ts` → `createClassroomServer`. Each factory receives Studio's shared connection (`live`) and implements `onLiveEvent` / `onLiveStatus` / `getPhase`. Studio sends each HTTP request and `/ws` upgrade to the active session. On a switch it calls `deactivate()` on the old session (pause, close its sockets with code 1012), then `activate()` on the new one, and notifies open pages over `/studio/api/events` (server-sent events).

Packaged resources: `temple/public`, `temple/tts_worker.py`, `temple/packages/live-core/browser`, `wedding/web`, `classroom/{dist,public,src/game/cau-hoi,src/game/cau-hoi-show}` and `studio/web` under the app's resource folder (`STUDIO_RESOURCE_DIR`). Data goes to the app's local data folder: `studio.json` (last session and account), `studio.db` (viewer samples), `temple/` (merit state, TTS cache, model) and `classroom/classroom.db`.
