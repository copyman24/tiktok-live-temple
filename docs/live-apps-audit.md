# Live apps audit — 2026-11-04

Scope: Chùa Linh Ứng Online (prayer, repo root) and Virtual Wedding Live (`apps/virtual-wedding`), plus the new combined TikTok Live Studio (`apps/live-studio`). Each finding below was checked by running the app and driving it through JSON-RPC simulation and headless Chromium at 540 × 960 (`?obs=1`).

## Prayer app findings

| # | Finding | Impact | Status |
| --- | --- | --- | --- |
| P1 | The comment parser matched the bare substring `que`, so ordinary comments ("con **quen** thầy", "**que**…") drew a fortune. | Wrong ritual, an unwanted fortune voice line, and spam-like TTS. | Fixed: explicit phrases (`xin xăm`, `gieo quẻ`, `rút quẻ`, `quẻ`…) matched on diacritic-folded text. |
| P2 | The prayer branch accepted folded `cau ` and `chuong`, which also match "câu", "cậu", "chương". | Wrong rituals. | Fixed: diacritic-exact checks for those words. |
| P3 | Gift combos: a repeated streak message (same `repeatCount`, no `repeatEnd`) still counted as `max(1, …)` = one more gift. | Inflated merit and duplicate gift animations during streaks. | Fixed: non-increasing repeats are ignored, and the group is cleared on `repeatEnd`. |
| P4 | The auto-sim toggle kept a local `autoSimState` that started at `false` whatever the server state was. | The first click after a reload did nothing while sim was on. | Fixed: the flag syncs from `state.settings.autoSim`. |
| P5 | `temple.updateSettings` merged arbitrary params into persisted settings. | Any key could be written to `merit-state.json`. | Fixed: allow-listed keys only. |
| P6 | The bottom HUD said "1 xu · Bình luận" and "5 xu · Tim". | Suggested that commenting and liking cost coins. | Fixed: cards now name the free action (Bình luận / Thả tim / Tặng quà) and show live progress. |
| P7 | Ritual hotspots were plain white text boxes over the art in the OBS output. | Read as debug buttons and told viewers nothing. | Fixed: illustrated plaques (bell, wooden fish, fortune cylinder, koi) with the comment keyword. |
| P8 | Shares and follows both rang the bell; joins only added merit. | Little visible acknowledgement of viewers. | Fixed: shares get a petal blessing, joins get a batched welcome ticker, follows still ring the bell. |
| P9 | "Đặt lại công đức" in `/admin` had no confirmation. | One mis-click wiped the merit register. | Fixed: confirm dialog. |
| P10 | `public/assets` shipped four unused or oversized images (`buddha.png`, `temple_stage_bg.png`, `amitabha_stage.jpg`, 3.6 MB `amitabha_stage.png`). | About 11 MB of dead weight in every installer. | Fixed: the stage uses a 0.65 MB WebP; the originals moved to `design/source-art/`. |
| P11 | Devotee sprites had a yellow halo from earlier background removal. | Visible fringe on 46 on-stage characters. | Fixed: edge pixels recoloured from the interior and the alpha softened (same sprite poses, cleaner edges). |
| P12 | A pure chant comment ("Nam mô A Di Đà Phật") added to the chant count **and** fell through to the prayer ritual. | Every chant released a prayer lantern and a TTS reading, so a busy room covered the hall in lanterns and queued speech. Found with the traffic rehearsal. | Fixed: pure chants only add to the count. A chant followed by a wish still becomes a prayer. At most 3 lanterns and 3 koi are on screen at once. |
| — | `bg_chant.m4a` returns 404 (gitignored). | The audio engine falls back to synthesized ambience. | Not changed; add the file locally if you want the recorded chant. |

## Wedding app findings

| # | Finding | Impact | Status |
| --- | --- | --- | --- |
| W1 | Stage and dashboard checked `stream.state === 'connected'`, but the adapter reports `'live'`. | During a real live, the stage still said "SÂN KHẤU" instead of "TRỰC TIẾP", the dashboard said "not connected", and **the disconnect button never appeared**. | Fixed in `stage.js` and `app.js`. |
| W2 | TikTok `MEMBER` (a viewer joining the room) was shown as "tham gia hội viên" (became a member). | Wrong copy on stream. | Fixed: "vừa đến dự tiệc"; the dashboard stat now says "vào phòng". |
| W3 | Likes counted toward a goal, but reaching it did nothing. | The like goal had no payoff. | Fixed: `like_goal_reached` triggers fireworks and a moment card. |
| W4 | Every viewer action outside the lobby was a wish, a like, or a gift. | Few reasons to keep commenting after the couple was chosen. | Added the team battle, kiss chant, toasts, petals, bouquet toss, and guest book (see below). |
| W5 | The action tiles always showed the lobby prompts (`#codau`, `#chure`). | After the lobby, viewers were told to do things that no longer worked. | Fixed: the four tiles change with the ceremony phase. |
| W7 | The stage showed every panel at all times: the team bar before anyone joined a team, an empty guest book, two chant meters in phases where they did nothing, and 8 wish bubbles over the crowd. | Busy screen, with the photo's couple competing with the overlays. | Fixed: the chant meters moved into the phase action tiles (with counters for kiss, toast, wishes, bouquet entrants, and likes). The team bar and guest book appear only once they have content. Wishes show the 4 most recent. The couple title has a legibility halo. |
| W6 | `hall-photo.png` was 8.2 MB, and the 1.5 MB rose PNG was used as a 40 px icon. | Slow OBS source start. | Fixed: 0.53 MB WebP plate and SVG icons; originals moved to `apps/virtual-wedding/assets/source/`. |

## New viewer interactions

**Prayer** (comment keywords are matched without diacritics, so `phong sinh` works too):

- `phóng sinh` / `thả cá`: a koi carrying the viewer's name and wish swims across the carpet, and the TTS reads the wish (+15).
- `điểm danh`: daily check-in with a consecutive-day streak in Vietnam time (+5, +2 per streak day, max 30). Every third streak day is read aloud.
- `nam mô a di đà phật`: each comment adds one recitation to a shared 108 count. Completing it gives every participant +5, makes the hall bow, rains lotus petals, and reads the top three names.
- Likes: besides the wooden fish, likes fill the merit lamp (default 300). Each lamp lit flashes the hall and appears in the card.
- Shares bring a petal blessing; joins show a batched welcome.

**Wedding:**

- `#nhatrai` / `#nhagai`: join a side. Likes, wishes, and gifts from that side move the tug-of-war bar.
- `hôn đi` (vows onward): chant meter; reaching the goal plays a kiss moment.
- `dô!` / `zô` / `nâng ly` / `100%`: toast meter that ends in "Một, hai, ba… DÔ!" with confetti.
- `#tunghoa`: a petal shower with the viewer's name.
- `#bathoa`: enter the bouquet toss (opens in the celebration phase); the host draws a random winner.
- Gifts: the red-envelope guest book (top 3 on stage). Gifts of 500+ coins, or named like Đám cưới / Wedding / Ring, fire fireworks.

**Goals that scale with the room** (both apps, on by default): goals follow the live viewer count. A goal changes only when its current round is nearly empty or has just completed, so meters never jump backwards. Setting a number by hand turns auto mode off; a checkbox in `/admin` or on the wedding dashboard turns it back on.

| Viewers | Chant (108 ladder: 21/27/54/108/216/540/1080) | Lamp likes | "hôn đi" | "dô!" | Like goal |
| --- | --- | --- | --- | --- | --- |
| 12 | 21 | 200 | 10 | 8 | 200 |
| 140 | 108 | 2 000 | 40 | 36 | 3 000 |
| 900 | 540 | 13 500 | 270 | 200 (cap) | 18 000 |

## Assets

- New SVG illustrations: `public/assets/ritual/{bell,woodfish,fortune,koi,lamp,lotus}.svg` and `apps/virtual-wedding/web/assets/art/{rings,glasses,bouquet,envelope,kiss,petal,bride,groom}.svg`.
- Each app keeps its own look. The prayer app uses its petition style: warm paper, charcoal ink, cinnabar seal, bronze and lacquer objects. The wedding app uses wine and blush with antique gold, 囍 envelopes, and rose petals. The studio launcher is a neutral dark control room with one accent per session (gold or rose).
- Raster regeneration: the 8 devotee pose sprites (`public/assets/devotee*.png`) are now generated by code instead of being the old 139×190 AI cut-outs with a yellow halo. `design/art-gen/devotees.mjs` describes each pose (walk ×2, kneel down, kneel, hands to forehead, half bow, prostrate, deep prostration) as spline body profiles in áo tràng lam with cloth texture, ambient occlusion, a bun and hairpin, and a baked contact shadow. It renders them in headless Chromium at 3× and downsamples to 280×380 (2× the old resolution). Run it again with `bun run art:devotees`. The old sprites are kept in `design/source-art/devotee-photo/`.
- The temple plate was being stretched from 941×1672 to the 1080×1920 stage. It is now rebuilt at 1080×1920 (Lanczos plus a light unsharp mask). The wedding plate (1412×2508) already exceeds the stage size and was kept.

## Verification performed

- JSON-RPC simulation of every new comment, like, gift, share, and join path on both apps, with the state checked after each step.
- Headless Chromium screenshots of both stages (`?obs=1`, 540 × 960) during koi, check-in, lamp-lit, fortune, kiss-moment, and confetti events, plus the wedding dashboard at 1440 px.
- Studio: switching prayer → wedding → prayer kept the state of both sessions. `/obs` redirected to the active stage, an open OBS page reloaded itself on a switch, and operator pages followed the switch. The launcher has no horizontal scroll at 390 px.
- The compiled `studio-backend` binary was run against a mock packaged resource layout (`STUDIO_RESOURCE_DIR`). Both sessions served their pages and RPCs, the merit state was flushed, and the token-guarded shutdown exited cleanly.
- Traffic rehearsal: 60 s at about 8 viewer events per second (comments, likes, joins, shares, gifts, phase changes) on both OBS stages, with screenshots every 10 s. No page or RPC errors. DOM size stayed flat (about 480 nodes for the temple and 150–320 for the wedding) and returned to baseline afterwards, and the JS heap stayed at about 2 MB.
- `node --check` passes on all changed JS, and `bun run check:isolation` passes for the wedding app.
