# Windows setup

Use a native PowerShell terminal, not WSL.

## 1. Install the tools (one time)

```powershell
winget install Git.Git
winget install astral-sh.uv
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close the terminal, open a new one, and run:

```powershell
rustup default stable-msvc
bun --version; uv --version; cargo --version
```

Windows 10 and 11 include WebView2. If the app window stays blank, install the WebView2 Runtime from Microsoft.

## 2. Get the code and dependencies

```powershell
git clone https://github.com/evergard3n/tiktok-live-temple.git
cd tiktok-live-temple
bun install
bun run wedding:install
```

## 3. Voice (ZeroTTS) for development

`bun install` runs `scripts/setup-venv.js`. If `.venv` is missing, the script creates it with Python 3.11 through uv, then installs `zerotts` and `pillow`. If uv is not installed, it prints the manual command and the install still succeeds. To run the setup again, use `bun run setup:venv`. To skip it, set `SKIP_VENV_SETUP=1`.

Without `.venv`, the apps run without the spoken voice. Installed builds bundle their own voice worker.

## 4. Run without building

```powershell
bun run studio:start
```

- Control room: http://127.0.0.1:3200/studio. Choose **Chùa Linh Ứng Online** or **Virtual Wedding Live**.
- OBS browser source: `http://127.0.0.1:3200/obs`, at 1080 × 1920. The source follows the active session.

## 5. Build installers

| Command | Output |
| --- | --- |
| `bun run studio:build` | Combined app (prayer + wedding): `apps\live-studio\src-tauri\target\release\bundle\nsis\*.exe` |
| `bun run prayer:build` | Prayer app only: `src-tauri\target\release\bundle\nsis\*.exe` |
| `bun run wedding:build` | Wedding app only: `apps\virtual-wedding\src-tauri\target\release\bundle\nsis\*.exe` |

The first build takes several minutes because it compiles Rust and packages the voice worker. The installed apps need neither Bun nor Python. The voice model downloads on first launch.

## 6. Go live

1. Start the live in TikTok Live Studio.
2. Open the app, pick a session, then enter your TikTok handle or live URL on its control page.
3. In OBS, add a Browser Source with the `/obs` URL at 1080 × 1920.

## Troubleshooting

- **"This script must run in native Windows"**: you are in WSL. Use PowerShell.
- **`link.exe` not found or MSVC errors**: rerun the Build Tools install from step 1, then open a new terminal.
- **Startup error about port 3200 (studio) or 3000 (prayer)**: another copy of the app is still running. Close it in Task Manager.
- **Script execution is blocked**: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
