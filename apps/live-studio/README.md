# TikTok Live Studio

TikTok Live Studio runs **Chùa Linh Ứng Online** (prayer) and **Virtual Wedding Live** (wedding) as two sessions inside one backend process and one desktop app. Only one session is live at a time. Switching keeps the other session's state: the wedding ceremony stays in memory, and temple merit is saved to disk as before.

## Run

From the repository root:

```sh
bun install
bun run wedding:install   # the wedding source keeps its own node_modules
bun run studio:start      # http://127.0.0.1:3200/studio
```

| URL | Purpose |
| --- | --- |
| `/studio` | Session launcher. Choose a session, see each session's status, and copy the OBS address. |
| `/obs` | **One OBS browser source for both sessions** (1080 × 1920). It redirects to the active session's stage and reloads itself when you switch. |
| `/` | Operator page of the active session (temple quick controls or wedding dashboard). A "LIVE STUDIO · Đổi phiên" pill links back to the launcher. |
| `/admin` | Temple admin panel (prayer session only). |

When "Giữ phòng TikTok đang kết nối khi đổi phiên" is checked, switching disconnects the old session from the TikTok room and connects the new session to the same `@username`.

## Desktop build

```sh
bun run studio:tauri:dev  # development window
bun run studio:build      # release bundle
```

- **Windows** (native terminal, not WSL): builds the ZeroTTS worker and the studio backend sidecar, then an NSIS installer under `apps/live-studio/src-tauri/target/release/bundle/nsis/`. Same prerequisites as the prayer app: Bun, `uv`, Python 3.11, MSVC build tools.
- **Linux**: deb, rpm, and AppImage packages under `apps/live-studio/src-tauri/target/release/bundle/`. The Linux package has no bundled ZeroTTS worker, so speech works only when a Python environment with ZeroTTS is available.

The app ID is `com.linhung.tiktoklivestudio` and the backend listens on `127.0.0.1:3200`, so the studio can be installed next to the standalone prayer (port 3000) and wedding (port 3108) apps.

## How it works

```text
apps/live-studio/
  src/studio.js        # session manager + router (one HTTP server, one /ws upgrade path)
  src/main.js          # entry point and signal handling
  web/                 # launcher page, injected session pill, idle OBS page
  src-tauri/           # Tauri crate, sidecar "studio-backend", bundles both apps' web resources
scripts/build-studio-backend.js   # bun build --compile → studio-backend-<target-triple>
scripts/build-studio-windows.ps1  # ZeroTTS worker + studio backend for Windows
```

Both apps are created through factories (`src/temple/server.js` → `createTempleServer`, `apps/virtual-wedding/src/server.js` → `createWeddingServer`) in embedded mode, so they don't open their own ports. The studio sends each HTTP request and `/ws` upgrade to the active session. On a switch it calls `deactivate()` on the old session (disconnect TikTok, stop auto-simulation, close sockets with code 1012), then `activate()` on the new one, and notifies open pages over `/studio/api/events` (server-sent events).

Packaged resources: `temple/public`, `temple/tts_worker.py`, `wedding/web`, and `studio/web` under the app's resource folder (`STUDIO_RESOURCE_DIR`). Data goes to the app's local data folder: `studio.json` (last session and room) and `temple/` (merit state, TTS cache, model).
