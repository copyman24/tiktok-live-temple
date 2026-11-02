---
name: Chùa Linh Ứng Online
description: A Vietnamese temple live scene and operator workbench shaped by a working prayer petition.
colors:
  ink: "#1f2b26"
  ink-soft: "#43564c"
  paper: "#ede1b5"
  paper-light: "#faf6e7"
  ground: "#dbe7d8"
  jade: "#245447"
  jade-dark: "#183f36"
  cinnabar: "#a83b2d"
  cinnabar-dark: "#7e2c24"
  brass: "#c39634"
  line: "rgba(31, 43, 38, 0.2)"
  muted-line: "rgba(31, 43, 38, 0.12)"
  success: "#28624e"
  focus: "#164c76"
typography:
  display:
    fontFamily: "'Noto Serif', Georgia, serif"
    fontSize: "clamp(28px, 3vw, 38px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  ritual:
    fontFamily: "'Noto Serif', Georgia, serif"
    fontSize: "35px"
    fontWeight: 900
  body:
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  action:
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
  field:
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  live-status:
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.55
rounded:
  none: "0px"
  micro: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
  stage: "10px"
  2xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.cinnabar}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 15px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.jade-dark}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 15px"
    height: "44px"
  input-text:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
  ritual-action:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "62px"
  live-status:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    typography: "{typography.live-status}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  workbench-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "22px"
  viewer-gift-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  navigation-link:
    backgroundColor: "transparent"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "44px"
---

# Design System: Chùa Linh Ứng Online

## Overview

**Creative North Star: "The Living Prayer Petition"**

The Living Prayer Petition treats the live interface as a working sớ: paper that records each prayer as it happens. Warm stock, charcoal ink, and fine rules keep information orderly; the supplied temple scene provides the ornament and remains the visual anchor. Cinnabar marks primary action and active prayer, jade anchors connection and enabled controls, a related success green marks affirmative state, and brass stays a fine detail.

The viewer scene and operator workbench carry equal weight. The live page keeps its portrait temple artwork in front, with compact state and count plaques above the active devotee, viewer actions, and merit list. The admin page turns connection, voice testing, ritual commands, simulation, and JSON-RPC feedback into an event-focused workbench. Be Vietnam Pro carries operational text and admin section headings; Noto Serif gives page titles and ritual names a quieter ceremonial voice.

**Key Characteristics:**
- A working paper petition layered over the existing temple scene.
- Clear role separation across ink, paper, jade, cinnabar, and brass.
- A live portrait composition paired with a practical operator workbench.

## Colors

The palette pairs warm paper and charcoal reading ink with a deep jade shell; cinnabar marks the primary command and active seal, while brass is reserved for small ritual detail.

### Primary
- **Cinnabar:** The primary command color on the admin workbench and quick dock, and the active mark on the live participant notice and live action.
- **Deep Cinnabar:** A pressed or hover shade for primary actions and the secondary emphasis color in the fortune reading.

### Secondary
- **Jade:** The deep-green family for the shell, outlined secondary controls, slider accents, and connection details.
- **Deep Jade:** The admin header and live leaderboard surface; it also anchors connection and status details.
- **Success Green:** The connected live indicator and enabled toggles use a distinct green so affirmative state is readable apart from the red disconnected dot.

### Tertiary
- **Brass:** A narrow outline on the fortune sheet and restrained gold detail. The existing temple art carries most of the gold spectacle.

### Neutral
- **Charcoal Ink:** Primary text on paper surfaces.
- **Soft Ink:** Labels, helper copy, and secondary information.
- **Prayer Paper:** The main sheet color for workbench surfaces and live viewer cards.
- **Light Paper:** Inputs, live status plaques, and text panels over the scene.
- **Temple Ground:** The pale green page canvas around both surfaces.
- **Ink Rules:** The translucent `line` and `muted-line` tokens separate work areas without heavy borders.
- **Focus Blue:** A visible keyboard focus outline shared by interactive controls.

**The Seal Rule.** Reserve cinnabar for primary commands and active prayer marks; use jade for connection and enabled states, and keep brass to fine detail.

## Typography

**Display Font:** Noto Serif (with Georgia, serif fallback)
**Body Font:** Be Vietnam Pro (with system UI sans-serif fallbacks)
**Label/Mono Font:** Be Vietnam Pro for labels; the JSON-RPC response uses the system monospace stack.

**Character:** Be Vietnam Pro keeps Vietnamese labels, state, and operational copy direct at small sizes. Noto Serif is limited to page titles and ritual names, adding a restrained ceremonial note without slowing down the workbench.

### Hierarchy
- **Display** (700, `clamp(28px, 3vw, 38px)`, 1.12): The admin page title; it tightens slightly as the viewport narrows.
- **Ritual** (900, 35px): Fortune titles and prominent ritual names; the live merit heading also uses Noto Serif at a smaller size.
- **Body** (400, 15px, 1.5): Default admin copy and controls inherit the Vietnamese sans family.
- **Label** (600, 13px): Field labels and secondary controls, set in Be Vietnam Pro.
- **Action** (700, 14px, 1.3): Compact admin buttons; ritual tiles add a bold action name and a quieter 12px detail line.
- **Code** (12px, 1.55): The scrollable JSON-RPC response uses a monospace stack and preserves line breaks.

**The Two Voice Rule.** Keep operational headings and control text in Be Vietnam Pro; use Noto Serif for page titles and ritual names, not for admin section headings.

## Layout

The live source is a fixed 9:16 stage (1080 × 1920 logical pixels). On wide screens it sits beside the quick dock; on phone widths the dock follows the stage. In OBS mode the stage centers in the viewport and the dock is hidden, preserving a clean portrait source. The live layout moves from side-by-side to stacked at 1023px, tightens stage overlays at 600px, and lets the dock connection row wrap below 380px.

The admin shell is capped at 1280px and organizes service connection and voice testing beside the ritual grid, with comment simulation and JSON-RPC output in a lower support sheet. At 900px those areas collapse to one column; at 700px the header and identity fields stack, and at 380px the ritual grid becomes a single column. The repeated spacing rhythm favors 8px and 12px control gaps, 16px section rhythm, and 22px sheet padding. The reviewed 320px captures keep both pages free of horizontal overflow.

**The Portrait Stage Rule.** Keep the live scene at 9:16, center it on desktop, move controls below it on phones, and hide them in OBS mode.

## Elevation & Depth

Depth is a hybrid of the supplied full-bleed temple artwork, flat paper sheets, thin separators, and one broad soft shadow. The live stage and outer admin work sheets carry the shadow; internal work panels remain flat and are divided by rules. The temple image, not nested interface cards or decorative gradients, supplies the visual richness.

### Shadow Vocabulary
- **Soft outer lift** (`0 12px 30px rgba(20, 40, 33, 0.16)`): Used beneath the live stage, quick dock, admin header, and outer workbench sheets.

**The Single Sheet Rule.** Keep the work surface flat inside the shadowed outer sheet; thin separators group tasks without stacking nested cards.

## Shapes

Controls and live information plaques use gently squared corners, usually 3–4px. The stage frame has a 10px corner on the regular page and becomes square in OBS; the admin header and fortune sheet soften to 6–12px. Workbench sheets stay square, with a thin border. Fine rules divide sections, while live-state dots and the incense ember are the only recurring circular marks. Keep controls easy to identify as standard buttons and fields rather than turning the prayer form into ornamental chrome.

## Components

### Buttons
- **Character:** Compact, confident controls use clear labels and a visible outline or filled state.
- **Shape:** Gently squared corners (3px); admin buttons and live quick-dock controls are at least 44px high.
- **Primary:** Cinnabar fill with white text; admin action buttons use 10px × 15px padding and darken on hover.
- **Hover / Focus:** Hover shifts the fill or border toward its darker state. Keyboard focus uses a 3px blue outline with a 3px offset; the general admin button lowers by 1px while pressed.
- **Secondary:** Transparent paper controls have a jade border and deep-jade text; the live dock fills them with jade on hover.

### Cards / Containers
- **Corner Style:** The workbench sheets are square; nested panels have no separate card shell.
- **Background:** The admin work areas use prayer paper. Live viewer action tiles use the same paper family; the leaderboard is deep jade.
- **Shadow Strategy:** Apply the shared soft shadow to outer sheets and the stage, not to internal panels.
- **Border:** A thin ink rule outlines the outer workbench sheet; internal groups use divider rules.
- **Internal Padding:** Admin sheets use 22px on desktop and 16px at compact widths; the quick dock uses 20px × 22px, tightening at very narrow widths.

### Inputs / Fields
- **Style:** Standard text inputs and textareas use a light-paper fill, thin muted border, 3px corners, and 10px × 12px padding. Inputs and buttons retain a 44px minimum height.
- **Focus:** The shared blue `:focus-visible` outline has a 3px stroke and 3px offset.
- **Error / Disabled:** No separate error or disabled treatment is established in the reviewed interface.

### Navigation
- **Style:** The admin header links are thin outlined controls on deep jade, with restrained 6px corners and a light-paper hover fill. They sit at the right on wide screens and become a two-column link grid on narrow screens.

### Live Stage and Prayer Record
- Keep the stage image full bleed inside its 9:16 frame. The top plaques carry connection and incense/merit counts; the active participant and wish sit over the temple scene; the footer pairs three viewer action tiles with the merit list.
- Use light-paper plaques with ink text and thin jade/ink edges so state remains legible over the supplied artwork. Dynamic names and wishes truncate or wrap within their labels instead of changing the stage hierarchy.
- The quick dock is one paper work sheet with a cinnabar top rule. Divide audio, connection, ritual testing, and recent activity with thin rules; do not give each section its own nested card.

### Ritual Action Tiles
- The admin ritual grid uses left-aligned paper tiles with an action name and a secondary detail line. Cinnabar identifies the primary action, deep jade marks the grand ceremony, and reset has its own restrained red outline.
- The live viewer tiles are larger, bottom-aligned action cards with a small contribution label above the action name. Keep their labels direct and visible against the stage.

## Do's and Don'ts

### Do:
- **Do** keep the supplied temple artwork as the scene's main ornament and use paper plaques for readable live information.
- **Do** set operational copy and admin section headings in Be Vietnam Pro; reserve Noto Serif for page titles and ritual names.
- **Do** keep primary actions and active prayer marks in cinnabar, and connected or enabled states in jade.
- **Do** keep controls and fields at the established 44px minimum height where that rule is implemented.

### Don't:
- **Don't** use emoji as control iconography.
- **Don't** stack decorative cards inside the workbench sheets.
- **Don't** add decorative gradients to the admin workbench; the supplied temple artwork carries the visual ornament.
