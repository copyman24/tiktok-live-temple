# Windows Tauri port design

## Problem

The Windows app must keep the current public-handle TikTok flow, ritual mapping, admin page, OBS Browser Source, JSON-RPC, WebSocket events, and ZeroTTS voice. `server.js` already owns these behaviors, so the desktop shell should supervise it rather than move the TikTok pipeline into Rust. The app has no account login or TikTok OAuth.

## Usage

The operator opens the desktop app, starts TikTok Live manually in TikTok Studio, and enters the public handle or Live URL in the admin panel. The fields start empty, so a fresh install does not attach to the sample `zenfacts_vn` account. The backend connects with `tiktok-live-connector`, converts room events to rituals, and broadcasts `temple.event` to the app and OBS over `/ws`. OBS keeps `http://localhost:3000/?obs=1`.

## Shape

Tauri owns startup, the desktop window, backend readiness, process output, and shutdown. `server.js` remains the sole owner of the TikTok connection, ritual and merit state, JSON-RPC, WebSocket notifications, HTTP routes, and the ZeroTTS process manager. `tts_worker.py` remains a separate ZeroTTS process with its current newline-delimited JSON protocol.

```text
Tauri Windows process
  ├── supervises the compiled Bun backend sidecar
  │     ├── serves public/ on localhost:3000
  │     ├── owns tiktok-live-connector and ritual state
  │     ├── serves /rpc, /ws, /api/state, and /tts-cache
  │     └── starts the ZeroTTS worker with piped stdin/stdout
  └── opens the webview at http://localhost:3000 after readiness

OBS Browser Source ── http://localhost:3000/?obs=1 ──> same backend
TikTok Live ── connector WebSocket ──> server.js ── temple.event ──> /ws
```

The runtime has one explicit state:

```rust
enum BackendState {
    Starting,
    Ready { pid: u32 },
    Failed(String),
    Stopping,
    Exited(Option<i32>),
}

struct AppPaths {
    resources: PathBuf,
    data: PathBuf,
}
```

Rust resolves `resources` through Tauri's resource path resolver and `data` through Tauri's app-local-data path. It creates the data directory before starting the backend. The backend receives `APP_RESOURCE_DIR`, `APP_DATA_DIR`, `HOST=localhost`, and `PORT=3000`. It serves `public/` from the resource directory and stores `merit-state.json` and `tts-cache/` under the writable data directory. In source development, missing environment values fall back to the repository paths.

The Windows package bundles `temple-backend-x86_64-pc-windows-msvc.exe` as a Tauri external binary. It includes `public/` and a PyInstaller-built `zerotts-worker.exe` as resources. The backend launches the bundled worker executable without a script argument. In source development, `ZeroTTSManager` launches `.venv/Scripts/python.exe` with `tts_worker.py` on Windows or `.venv/bin/python` on Linux. Both paths keep the same JSON-lines protocol.

The Tauri shell plugin starts the backend from Rust in a process group. On Windows, this uses a Job Object so forced backend termination also stops the ZeroTTS child. A bounded `GET /api/health` check must return the child PID before Rust creates the webview from the configured window. Rust compares that PID to the sidecar PID so an unrelated process bound to port 3000 cannot satisfy readiness. The UI and OBS use the same origin, so the frontend keeps its current relative HTTP, audio, and WebSocket URLs. The service binds to `localhost` only; it does not listen on LAN interfaces.

The backend exposes an idempotent loopback `POST /api/shutdown` endpoint for Tauri to request normal exit. It disconnects TikTok, closes the ZeroTTS stdin pipe and waits for the worker, then closes HTTP and WebSocket listeners. Rust waits for the sidecar to exit and kills it on timeout. The app does not expose the shell plugin to page JavaScript.

## Synthesis decision

Candidate 4 is the base. It preserves the existing same-origin contract and creates the window only after the backend is ready. Candidate 1 independently reached the same process boundary; its explicit `BackendState` enum is grafted into the base so lifecycle states are not spread across flags. Candidate 2's own-process health check is also grafted, while its embedded duplicate UI and cross-origin URL adapter are rejected because they add a second frontend transport path. Candidate 3's Rust service and Bun TikTok bridge are rejected because they replace working event, state, and RPC code without improving the requested user flow.

The rubric scores are behavior fit, Windows fit, lifecycle fit, small coherent design, and proof/migration, each from 1 to 5:

| Candidate | Behavior | Windows | Lifecycle | Coherence | Proof | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. Tauri supervises the current server | 5 | 4 | 4 | 5 | 4 | 22 |
| 2. Embedded UI plus loopback service | 4 | 4 | 5 | 3 | 4 | 20 |
| 3. Move local service into Rust | 2 | 3 | 5 | 1 | 3 | 14 |
| 4. Tauri shell over the current server | 5 | 4 | 5 | 5 | 4 | 23 |

No independent cross-judge ran because the configured cross-judge role inherits the parent model. The four sketches were reviewed against the rubric and the architect red-flag list. Candidates 1 and 4 converged on one backend owner and one browser-facing origin. Candidate 4 wins because it delays window creation until readiness.

## Tradeoffs accepted

- We accept a local HTTP server inside the desktop package because it keeps the OBS URL and frontend WebSocket behavior unchanged.
- We accept a fixed port and a startup error on conflict because OBS stores the current URL outside the app.
- We accept a Windows-only PyInstaller build step because the TTS runtime must ship as a distinct process without requiring a user Python installation.
- We accept that WSL can verify the Linux development path and Windows Bun sidecar compilation, but the Windows Tauri bundle and PyInstaller executable need a native Windows run.

## Alternatives considered

- Embedding `public/` directly in Tauri and keeping the backend for OBS needs an API-origin helper for every browser HTTP, audio, and WebSocket request. It also packages the UI twice. This exposes more transport detail to the frontend than the current same-origin server.
- Rewriting the backend in Rust and keeping a small Bun TikTok bridge reduces one server process but adds a new event protocol and ports the current RPC, state, ritual, and audio routes. It makes the user-facing migration much larger.

## Implementation reconciliation

The implementation adds a per-launch token for `POST /api/shutdown`. Rust passes the token only to the backend process, and the backend checks it at the HTTP boundary. This is process-control protection, not a user account or TikTok login. The implementation also narrows CORS and rejects WebSocket connections from nonlocal origins so browser pages from arbitrary origins cannot call the unauthenticated RPC routes. Local requests without an `Origin` header remain supported.

The quick-connect and admin username fields start empty, and the server no longer connects to `zenfacts_vn` by default. An operator can still set `TIKTOK_USER` to request an explicit startup connection. This keeps a fresh desktop install disconnected until the operator supplies a public handle.

Final diff review added exact-origin checks to `/ws` and starts the backend sidecar in a process group. These close the browser WebSocket gap and make fallback termination reap the ZeroTTS child on Windows.

## Open questions and risks

- Will PyInstaller collect all ZeroTTS native libraries and model helpers on the first Windows build? The packaging script must fail visibly if the worker cannot start and report `ready`.
- Does a native Windows run confirm that the Tauri shell plugin cleans up the backend after the graceful shutdown timeout? If not, add a Windows Job Object after measuring the actual process tree.
- Does `localhost` resolve to the same loopback interface for the Windows listener, Tauri WebView2, and OBS Browser Source on the target machine? Verify all three on Windows before release.

## Next implementation step

Add the Tauri v2 shell and backend process manager, then give `server.js` explicit resource, data, health, and shutdown boundaries.
