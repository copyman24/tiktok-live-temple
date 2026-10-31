# Tauri port verification record

Date: 2026-11-01

Environment: WSL2 Linux x86_64, Bun 1.4.4, Python 3.13, Rust/Cargo 1.99.1. Both Rust targets `x86_64-unknown-linux-gnu` and `x86_64-pc-windows-msvc` are installed.

## Checks that passed

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passed.
- `cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --format-version 1` passed.
- `TAURI_ENV_TARGET_TRIPLE=x86_64-pc-windows-msvc bun run build:backend` produced `src-tauri/binaries/temple-backend-x86_64-pc-windows-msvc.exe`. The PE header reported machine `0x8664` (AMD64).
- `TAURI_ENV_TARGET_TRIPLE=x86_64-unknown-linux-gnu bun run build:backend` produced a valid ELF backend.
- `bun build --target=bun --outfile /tmp/tauri-server-syntax-check.js server.js` passed. Python AST parsing and JSON parsing of the Tauri configs and capability file passed.
- The live backend smoke used a temporary app data directory and port 3123. `GET /api/health` returned `{"ok":true,"pid":189391}`.
- A no-Origin `POST /rpc` call for `temple.strikeWoodenFish` delivered a `temple.event` notification to a local `/ws` client with event `strikeWoodenFish`.
- An `OPTIONS /rpc` preflight from `https://attacker.example` returned no `Access-Control-Allow-Origin` header.
- A WebSocket opened with `Origin: https://attacker.example` closed with code 1008 and reason `Origin not allowed`, before receiving messages.
- `POST /api/shutdown` returned 403 without the per-launch token and 202 with it. The backend exited with status 0, port 3123 stopped accepting connections, and the state file contained the ritual changes (`woodenFishHits: 361`, `totalMerit: 1081`, devotee `Smoke`).

## Limits of the WSL checks

- The WSL Python environment lacks NumPy. `tts_worker.py` exited with `ModuleNotFoundError: No module named 'numpy'`, so this run did not verify ZeroTTS synthesis or audio playback.
- `cargo check --target x86_64-pc-windows-msvc` stopped in host build scripts with `linker cc not found`, before reaching the Tauri crate diagnostics.
- This WSL distro has no WebKitGTK or graphical display. Native Windows build and runtime checks are recorded below.

## Native Windows build and runtime

Environment: Windows 10 build 19045.6456; Visual Studio 2019 Build Tools 16.11.51 with MSVC 14.29.30133 and Windows SDK 10.0.19041.0; WebView2 installed; Windows Rust/Cargo 1.99.1 (`x86_64-pc-windows-msvc`), Bun 1.4.4, `uv` 0.13.6, and Python 3.11.9.

- `bun run tauri:build` built the Windows Bun backend and PyInstaller ZeroTTS worker, compiled the Tauri release executable, and produced `TikTok Live Temple_1.0.0_x64-setup.exe` (133.73 MiB). The per-user NSIS installer completed with exit code 0.
- The installed app included `tiktok-live-temple.exe`, `temple-backend.exe` (119,126,016 bytes), `zerotts-worker.exe` (84,650,798 bytes), and the `public/` assets. The app launched from its install directory using WebView2.
- `/api/health` returned `ok: true`; `/` and `/admin` returned HTTP 200. `/api/state` reported `connected: false` and an empty TikTok username, with no login screen.
- A WebSocket client using the allowed local origin received the initial `temple.state`. A `temple.strikeWoodenFish` RPC call then delivered a `temple.event` notification with event type `strikeWoodenFish`.
- `temple.ttsStatus` reported `ready: true` and included the `maichi` voice. `temple.speak` generated a valid RIFF/WAV file (322,604 bytes); the uncached synthesis took 4.07 seconds. The installed sidecar also served the cached audio.
- Closing the app window shut down the backend and ZeroTTS worker with exit code 0 and released port 3000. The smoke-test state file was restored after the interaction check.

A real TikTok Live room was not connected during this smoke run; the username/URL entry remains an operator action after starting Live in TikTok Live Studio.
