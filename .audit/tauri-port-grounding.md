# Tauri port architecture prompt

## Artifact

Produce a module and lifecycle sketch for a Windows Tauri desktop port of this repository. Cover the Tauri webview, local backend process, ZeroTTS sidecar, data paths, TikTok event socket, and OBS URL. Include startup/shutdown flow, exact module ownership, a migration sequence, and a falsifiable local verification. Save the sketch as `design.md` in your assigned candidate directory with a short rationale and rejected alternatives. Do not edit repository files.

## User goal

The user replaced the earlier Workers target with: “port this to a tauri app, not workers. no auth or whatsoever needed for now. keep the zerotts as sidecar”. They confirmed the target is Windows. Preserve the current public-handle workflow: operator starts TikTok Live manually in TikTok Studio, enters their public username or Live URL in the admin panel, and OBS loads the 9:16 overlay. Do not add TikTok OAuth or app login.

## Existing repository shape

- `server.js` is a single Bun/Node-style process using Express, `ws`, and `tiktok-live-connector`. It owns one active channel, one global state object, and ritual mapping.
- The same server serves `public/`, `/admin`, `/rpc`, `/ws`, `/api/state`, `/api/tts`, and `/tts-cache/*`.
- The browser's relative URLs already work when loaded from the local server. OBS uses `http://localhost:3000/?obs=1`; changing this URL requires coordinated updates and OBS migration.
- TikTok events arrive via the server's `tiktok-live-connector` socket. The server converts them to rituals, then emits `temple.event` to `/ws`; `/ws` also accepts browser RPC.
- `ZeroTTSManager` is an independent Python child process using newline-delimited JSON on stdin/stdout. `tts_worker.py` loads `zerotts`, downloads/loads the model, and writes generated WAVs under `data/tts-cache`.
- The TTS process resolver only checks `.venv/bin/python` then `python3`, and the Python worker has a Mac-only absolute model path before its model-id fallback. The server stores `data/` relative to `__dirname`; an installed Windows app needs a writable user data directory.
- `public/` is plain HTML/CSS/JS; there is no Tauri project or build system yet.
- The current environment is WSL Linux with Bun 1.4.4, Python 3.13, and Rust/Cargo stable 1.99.1 installed at `$HOME/.cargo/bin`. Both `x86_64-unknown-linux-gnu` and `x86_64-pc-windows-msvc` Rust targets are installed. This distro has no `cc`, WebKitGTK, or graphical display; the Windows-target Cargo check stops in host build scripts at `linker cc not found`. A Windows Tauri build still needs the Windows MSVC toolchain and Microsoft C++ Build Tools. Bun supports cross-compiling a standalone server binary to Windows x64; a Windows Python sidecar still needs a Windows build/verification path.
- The WSL Python environment does not have NumPy, so `tts_worker.py` exits before loading ZeroTTS during local runtime smoke. The backend stays available, but this does not verify speech synthesis.

## Platform facts to respect

- Tauri v2 can bundle target-specific external binaries. Windows x64 sidecars use the `x86_64-pc-windows-msvc` suffix; each targeted platform needs a matching binary.
- The Tauri shell plugin can launch sidecars from Rust or the webview, with explicit capability permissions for webview launches.
- A sidecar architecture must solve the server's writable `data/` and TTS cache location, clean shutdown of both server and Python process, and the startup race before showing the UI.
- Keep the local API bound to loopback for the no-auth desktop app. OBS on the same machine must still reach the local Browser Source URL.
- Do not build a Workers service, add OAuth, or replace ZeroTTS with cloud TTS.

## Rubric (score each 1–5)

1. **Behavior fit:** Preserves the current local admin, OBS URL, RPC, WebSocket event notifications, TikTok handle workflow, and ZeroTTS voice.
2. **Windows fit:** Defines executable packaging and paths for the backend and Python TTS sidecar without assuming Unix `venv/bin/python` or writable install directories.
3. **Lifecycle fit:** Makes startup readiness, process output/errors, graceful shutdown, and child cleanup explicit.
4. **Small coherent design:** Reuses the Node/Bun TikTok connector and current UI instead of rebuilding the whole application in Rust without need.
5. **Proof and migration:** Gives an executable Windows/local verification sequence and distinguishes what can be proved in WSL from what requires native Windows.

Prefer the sketch with the fewest moving parts that still produces a real Windows Tauri app and keeps the ZeroTTS process separate. Be explicit about build-time artifacts that cannot be generated or tested on this WSL host.
