# Virtual Wedding Live

Virtual Wedding Live is a separate TikTok Live app for hosting an interactive Vietnamese wedding ceremony. It has its own Bun backend, Tauri crate, sidecar, app identifier, resources, and local port.

## Develop

From this directory:

```sh
bun install
bun run dev
```

Open `http://127.0.0.1:3108` for the operator dashboard. The audience stage is at `http://127.0.0.1:3108/stage`; OBS can use `http://127.0.0.1:3108/stage?obs=1`.

Run the desktop shell with `bun run tauri:dev`. Build a native desktop package with `bun run tauri:build`. The Tauri build compiles the independent backend sidecar first.

The Linux build produces the executable at `src-tauri/target/release/virtual-wedding-live` and installable packages under `src-tauri/target/release/bundle/` (`deb/`, `rpm/`, and `appimage/`).

Run `bun run check:isolation` to verify the wedding-only package, Rust crate, identifier, port, resources, sidecar, and source imports. The sidecar build runs this boundary check automatically.

## Viewer interactions

- `#codau` asks to claim the bride role.
- `#chure` asks to claim the groom role.
- `#loichuc <message>` posts a wedding wish.
- Likes fill the celebration meter. Follows, shares, members, and gifts add scene reactions.

The operator confirms role requests, locks the couple, and advances ceremony phases. TikTok gifts never choose the couple or advance the ceremony. The simulator in the dashboard uses the same event path without connecting to a live room.

## Local API

The backend binds to `127.0.0.1:3108`. `GET /health` reports the sidecar PID. `POST /rpc` and `GET /ws` use JSON-RPC 2.0, with `wedding.state` snapshots and `wedding.event` notifications.

The ceremony exists in memory and starts fresh after a backend restart. The app does not use the temple/prayer backend, its assets, or its stored data.
