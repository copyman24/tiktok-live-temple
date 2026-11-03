# Product

## Platform

web

## Users

Operators run a Vietnamese virtual wedding during a TikTok Live and display the vertical stage in OBS or TikTok Live Studio. Viewers participate through comments, likes, follows, shares, memberships, and gifts.

## Product Purpose

Virtual Wedding Live turns TikTok room activity into a shared wedding ceremony. Success means the operator can guide the ceremony while viewers can claim roles, send wishes, and celebrate without gifts controlling the outcome.

## Operating Context

The app runs a local TikTok connector and web interface. The desktop app has an operator dashboard and stage preview. OBS uses the app's independent local stage URL at `http://127.0.0.1:3108/stage?obs=1`.

## Capabilities and Constraints

The first release connects to a TikTok Live room, accepts `#codau`, `#chure`, and `#loichuc <message>`, lets the operator confirm the couple and control ceremony phases, and turns likes, follows, shares, members, and gifts into bounded visual reactions. A simulator exercises the same input path without a live room. Ceremony state is in memory and resets when the app restarts.

The product is a separate application and binary from the temple/prayer app. It has its own source, app identifier, Rust crate, backend sidecar, port, resource map, and app data directory. It must not import temple code or package temple resources.

## Brand Commitments

The live scene follows the supplied Vietnamese wedding livestream reference: a red and gold wedding hall, central stage, couple, guest aisle, and readable live participation overlays. Do not carry temple artwork, prayer language, or prayer audio into this product.
