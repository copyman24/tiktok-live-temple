# Virtual Wedding Live design system

## Product surfaces

- The audience stage is a full-bleed 9:16 scene for a TikTok Live or OBS browser source. It uses the Vietnamese wedding hall artwork, live room data, guest wishes, and participation prompts.
- The operator dashboard is a desktop control surface. It uses a warm paper background, ivory panels, dark burgundy actions, and restrained antique-gold details so it belongs with the stage without competing with it.

## Color

| Role | Value | Use |
| --- | --- | --- |
| Paper | `#f5f0e8` | Operator canvas; carries the warm ivory and gold hall palette from the supplied wedding reference. |
| Surface | `#fffdf9` | Dashboard panels and form surfaces. |
| Ink | `#332922` | Main dashboard text. |
| Muted ink | `#6c6258` | Supporting dashboard text. |
| Burgundy | `#791f2d` | Primary ceremony actions and brand emphasis. |
| Deep burgundy | `#51121e` | Large title text and dark stage overlays. |
| Antique gold | `#815b1e` | Small labels and ceremonial accents; keep readable on ivory. |
| Stage ivory | `#fff9ed` | Text and icons over dark stage overlays. |

The stage's fixed hall photograph has a pale central medallion behind its dark-red wedding title. Contrast tools cannot sample that photograph and report the frame's dark fallback color instead; the real page is reviewed against the rendered artwork.

## Typography

- Be Vietnam Pro is self-hosted and used for Vietnamese UI copy at weights 400, 600, and 700.
- Georgia is the system serif for wedding names and editorial headings.
- Dashboard body copy uses at least 12px and functional labels use at least 11px. Stage type scales with the 941px design frame so the browser preview stays proportional to the OBS output.

## Shape and motion

- Dashboard panels use 6–11px corners, hairline warm-gray borders, and neutral shadows.
- Stage controls use capsule status badges and translucent, bordered wish ribbons over the hall artwork.
- Live hearts rise and fade only on like milestones or gifts. All nonessential motion respects reduced-motion preferences.
