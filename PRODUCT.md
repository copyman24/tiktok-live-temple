# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operators run the local service alongside TikTok Live Studio or OBS. They connect a TikTok live room, monitor its state, adjust audio, and trigger or simulate rituals.

TikTok viewers watch a vertical temple scene and participate through comments, likes, shares, follows, and gifts.

## Product Purpose

Chùa Linh Ứng Online turns TikTok Live activity and operator commands into a Vietnamese Buddhist temple scene. Success means the live scene responds clearly and the operator can control it without interrupting the stream.

## Positioning

The product combines a 9:16 live temple scene, TikTok event handling, Vietnamese speech, ritual animations, and merit tracking in a local service with JSON-RPC and WebSocket interfaces.

## Operating Context

The operator runs the Bun service locally, starts the TikTok live room in TikTok Live Studio, and uses the web control panel to connect and manage the scene. OBS can display `/?obs=1` as a 1080 by 1920 browser source. The main page also includes quick controls, while `/admin` provides the full control panel.

The desktop Tauri app wraps the local web service. It does not require a TikTok login.

## Capabilities and Constraints

The live scene reacts to TikTok comments, likes, shares, follows, and gifts. Operators can connect or disconnect a live room, adjust music and speech settings, test speech, simulate comments, trigger ritual actions, view merit totals, and reset merit. The HTTP JSON-RPC endpoint and WebSocket interface remain available.

Keep these behaviors and their existing RPC methods working. The redesign may change interface hierarchy and copy, but it must not remove a capability. The stage remains legible as a vertical livestream and keeps its existing temple and devotee assets unless a replacement is clearly required by the chosen direction.

## Brand Commitments

Keep the product name Chùa Linh Ứng Online and its Vietnamese Buddhist context. The current stage artwork, devotee sprites, and Mai Chi speech voice are product assets. The user approved a broad interface redesign and equal priority for the viewer scene and operator controls.

## Evidence on Hand

The current feature list and usage context are documented in `README.md`. The live scene is implemented in `public/index.html`, `public/css/live.css`, and `public/js/live.js`. The admin controls are in `public/admin.html`. Existing stage artwork and devotee sprites are under `public/assets/`. No customer quotes, testimonials, or third-party endorsements are supplied.

## Product Principles

- Keep the viewer scene and operator controls equally useful.
- Preserve the working live, audio, ritual, and RPC behaviors.
- Make the live state and the next operator action easy to find.
- Do not invent product claims or audience proof.
