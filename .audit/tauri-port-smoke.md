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

## Checks that remain unverified

- The WSL Python environment lacks NumPy. `tts_worker.py` exited with `ModuleNotFoundError: No module named 'numpy'`, so this run did not verify ZeroTTS synthesis or audio playback.
- `cargo check --target x86_64-pc-windows-msvc` stopped in host build scripts with `linker cc not found`, before reaching the Tauri crate diagnostics.
- This WSL distro has no WebKitGTK or graphical display, and it does not have the Windows MSVC linker or Windows SDK. The native Windows Tauri app, installer, WebView2 launch, and PyInstaller ZeroTTS executable still need a Windows build and run.
