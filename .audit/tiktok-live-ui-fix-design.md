# Livestream UI bug fix design

## Requirements

- Keep simulation state in the operator controls and out of the broadcast stage.
- Put the five highest-merit contributors in the clear upper portion of the 9:16 stage.
- Show matching SVG icons in the three existing gift action tiles.
- Show each live comment above the character for that commenter, update repeated comments, and expire the bubble.
- Show short-lived gift notices at the upper left with avatar, donor, gift, and quantity.

## Candidate layouts

1. Move the leaderboard to the upper right and put the gift history stack at the upper left. This separates the two new overlays, leaves the bottom for the existing viewer actions, and avoids the comment region visible in the baseline OBS render.
2. Move the leaderboard just above the bottom HUD and put gift history at the upper left. The lower location stays close to the existing panel but continues to compete with the region TikTok uses for comments and overlays.

Candidate 1 fits the explicit placement constraints and the current render. The right panel starts below the status counters; the gift notices start below the connection pill.

## Data shape and ownership

`temple.liveComment` carries `{ uniqueId, user, avatar, comment }`. The server emits one event for each sanitized, non-empty comment before ritual parsing, so an ordinary comment still reaches the stage. The live client owns one current `CommentBubble` and expiry timer. A repeat from that commenter updates the current bubble; a different commenter replaces it immediately to keep nearby messages from overlapping. The renderer first finds the matching `data-viewer-id` on the six VIP or eighteen ranked congregation characters; a commenter without a ranked character temporarily claims an otherwise empty congregation character and releases it with the bubble.

Gift events keep their existing `giftName` field and gain `giftCount`. The live client owns a short-lived, vertically stacked notice list and formats the quantity separately from the gift name.

The existing state renderer owns the five-person merit ordering because the server already sorts the leaderboard by merit. The live client changes only its displayed limit and placement. Inline SVGs belong in the existing gift tile markup, so they do not depend on external image paths.

## Verification contract

- With auto-simulation enabled and TikTok disconnected, the stage header contains no simulation wording while the operator toggle still shows the enabled state.
- The upper-right panel displays five entries in server merit order.
- The three cards render comment, heart, and lotus vector icons.
- Comments from two identities in succession anchor to the matching character in turn. A repeated identity updates its current bubble. The bubble disappears after its timeout.
- A gift notice shows donor avatar or fallback, donor name, gift name, and quantity, then expires without overlapping other active notices.
