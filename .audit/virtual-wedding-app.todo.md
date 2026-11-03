# Standalone virtual wedding app

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame the done predicate, scope, and build blockers.
- [x] Phase B: Design the workflow with parallel app-boundary candidates.
- [x] Phase C: Run the loop
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back

## Done predicate

From an app-specific directory, build a second desktop application with its own product name, identifier, Rust crate, Tauri config, backend sidecar, app data directory, and port. Its source/resources must not import the temple app or contain prayer behavior. Launch the standalone backend and verify its health endpoint, RPC, websocket, UI, and simulated TikTok interactions. Build the Tauri target supported by this environment and record the produced binary path.

## Scope and blockers

- Scope: a single-app wedding lobby with TikTok connection, public role claims/wishes, host controls, visual ceremony stage, event simulator, and an OBS view.
- Platform preference: Vietnamese wedding hall with red and gold, based on the user's reference screenshot. The screenshot itself is the visual direction.
- Expected implementation units: app package/backend, interaction state and transports, UI/stage, isolated Tauri sidecar packaging, build and runtime smoke checks.
- Current blockers: none known. Local Bun, Rust, Cargo, Tauri CLI, GTK/WebKit dependencies, and Chromium are present; run the actual build to establish the result.

## Phase B arena

- [x] Compare two standalone-app module maps and state/transport shapes.
- [x] Select the base and graft useful isolation/build ideas.
- [x] Record the model-family judge skip because user routing assigns every architect seat to inherit-parent.

## Phase C implementation units

- [x] Build a standalone wedding backend and provider-normalized TikTok interaction path; manually verified the sidecar, state snapshot, simulator, roles, wishes, likes, gifts, and phase advance.
- [x] Build the audience stage, role claims, wishes, likes, celebrations, simulator, OBS view, and operator dashboard from the approved composition.
- [x] Add a separate Tauri crate and sidecar that produce a distinct wedding binary; source/config are in place.
- [x] Run the compiled standalone sidecar from the Debian package and verify health, RPC, WebSocket, packaged static UI, and simulated TikTok interactions with agent-browser.
- [x] Build the Linux desktop target and record the executable plus Debian, RPM, and AppImage paths below.

## Current checkpoint

The isolated Bun backend and UI have been packaged into a working Linux Tauri application. The source and packaged-resource versions of the dashboard and stage were reviewed in a headless Chromium session with agent-browser; simulated claims, approvals, wishes, likes, follows, shares, gifts, and every ceremony phase were exercised. Operator controls passed the browser accessibility audit. The stage's burgundy title sits on the pale medallion in the hall artwork; the automated contrast detector cannot sample that fixed background image, so a narrowly scoped exception is recorded with its screenshot evidence.

The Tauri build produced:

- Executable: `apps/virtual-wedding/src-tauri/target/release/virtual-wedding-live`
- Debian: `apps/virtual-wedding/src-tauri/target/release/bundle/deb/Virtual Wedding Live_1.0.0_amd64.deb`
- RPM: `apps/virtual-wedding/src-tauri/target/release/bundle/rpm/Virtual Wedding Live-1.0.0-1.x86_64.rpm`
- AppImage: `apps/virtual-wedding/src-tauri/target/release/bundle/appimage/Virtual Wedding Live_1.0.0_amd64.AppImage`

The Linux UI was not opened as a native window because this WSL session has no display. The packaged sidecar and its copied resources were launched directly and reviewed headlessly. No temple source, assets, runtime, or prayer behavior was imported.
