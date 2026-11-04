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
- `#loichuc <message>` posts a wedding wish (+20 points for the viewer's side).
- `#nhatrai` / `#nhagai` joins the groom's or bride's side for the whole ceremony. Likes (+1 each), wishes (+20), and gifts (+10 per coin) from side members move the tug-of-war bar at the top of the stage.
- `hôn đi` (from the vows onward) fills the kiss chant. When the room reaches the goal (30 by default), the stage plays a kiss moment.
- `dô!`, `zô`, `nâng ly`, `100%` fill the toast meter. Every 20 by default triggers "Một, hai, ba… DÔ!".
- `#tunghoa` showers petals with the viewer's name (one per viewer every 6 s).
- `#bathoa` enters the bouquet toss, which opens automatically in the celebration phase. The host presses "Tung hoa" to pick a random winner.
- Gifts are recorded in the red-envelope guest book (Sổ mừng cưới, top 3 on stage). A gift worth 500+ coins, or one named like "Đám cưới"/"Wedding"/"Ring", fires fireworks.
- Likes fill the like goal; reaching it fires fireworks. Follows, shares, and room joins show short welcome notices.

The operator confirms role requests, locks the couple, advances ceremony phases, and tosses the bouquet. Kiss and toast goals are set in the dashboard's crowd panel. TikTok gifts never choose the couple or advance the ceremony. The simulator in the dashboard uses the same event path without connecting to a live room.

## Local API

The backend binds to `127.0.0.1:3108`. `GET /health` reports the sidecar PID. `POST /rpc` and `GET /ws` use JSON-RPC 2.0, with `wedding.state` snapshots and `wedding.event` notifications.

The ceremony exists in memory and starts fresh after a backend restart. The app does not use the temple/prayer backend, its assets, or its stored data.
