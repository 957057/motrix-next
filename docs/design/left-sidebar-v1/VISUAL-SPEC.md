# Visual specification

Status: proposed implementation specification, derived from the user-approved [01 task overview](01-task-overview.png). The baseline image is approved; the remaining screens and the exact values below are design proposals for implementation review. No application code or dependencies have changed.

## Authority

1. User decisions: left navigation, lightweight list, Electric Purple, visible official logo and settings, opaque surfaces, continuous motion, Windows/macOS/Linux.
2. Native contracts in [DOWNLOADS](../../DOWNLOADS.md) and [MEDIA](../../MEDIA.md); task capabilities, configuration constraints and security ownership in source.
3. This specification, [components](COMPONENTS.md), [flows](FLOWS.md), [motion](MOTION.md) and [settings map](SETTINGS-MAP.md).
4. Generated PNGs demonstrate composition. Their raster colors, example numbers, icons, text and spacing are not executable specifications.

Resolve a contradictory pixel using the written rule and native contract. Do not add a feature merely because a generator drew a control.

## Layout

The selected design is a Rayburst application of familiar sidebar, list, disclosure, dialog and form patterns. It is not claimed to be a new established industry design language. Apple HIG, accessible web patterns and Vue primitives inform behavior; no Liquid Glass or requirement to reproduce Material 3 component appearance is introduced.

Use CSS logical pixels, not screenshot pixels. Primary composition target is 1200 × 750, with the existing 1068 × 680 default also reviewed. Current native minimum is 373 × 240; these images do not authorize changing it.

| Element              | Proposed specification                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| Global sidebar       | 192 px at regular width; 16 px inline inset                                    |
| Logo                 | Official SVG, 28 × 28; 8 px gap to 18/24 semibold wordmark                     |
| Window title region  | Platform-owned safe area; initially reserve 32 px and confirm native metrics   |
| Content header       | 56 px minimum; 24 px inline padding                                            |
| Main content         | 24 px horizontal padding; 16 px below header                                   |
| Sidebar nav row      | 40 px minimum, 6 px radius, 4 px vertical gap                                  |
| Sidebar bottom links | Browser connection and Settings; same 40 px minimum target                     |
| Footer               | 32 px minimum; thin separator; global down/up speed and limit control          |
| Group heading        | 28 px minimum, 13/20 medium text; 16 px before next group                      |
| Active task, normal  | 80 px minimum; filename, metadata, progress                                    |
| Simple task, normal  | 64 px minimum for two lines; grow for error text                               |
| Compact task         | 44 px minimum, preferably 48 where actions need room                           |
| Quick details        | Intrinsic height, typically 144–216 px; not a fixed clipped block              |
| Standard controls    | 36 px height; compact icon target at least 32 × 32                             |
| Dialogs              | Small 400 px; regular 560 px; file selector up to 760 px                       |
| Dialog body          | 24 px padding, 16 px between fields; content scrolls                           |
| Dialog maximum       | Viewport minus 24 px margin at each edge, with adaptive short-window treatment |
| Radii                | 6 px controls; 8 px menus; 12 px dialogs; task rows unboxed                    |
| Borders              | 1 px hairlines; interactive boundaries stronger than decorative dividers       |

Never shrink all text to make a dense screenshot fit. Long field descriptions wrap; task names preserve recognizable extension and offer full text through keyboard-accessible detail.

```text
+----------------+------------------------------------------------+
| Logo Rayburst  | native title region / native window controls    |
|                |                                                |
| All tasks      | All tasks     Search   Sort  More   + New        |
| In progress    |------------------------------------------------|
| Completed      | Downloading                                    |
| Needs action   | file  name / speed / ETA    progress     pause … |
|                |     optional quick details in the same row     |
|                | Waiting / Needs action / Recent completions    |
|                |                                                |
| Browser        |                                                |
| Settings       | down / up speed              Limit: unlimited  |
+----------------+------------------------------------------------+
```

Batch selection temporarily replaces the header actions. It does not add a permanently empty second toolbar. Individual task details replace the right content pane and preserve the sidebar; Back restores the originating scope, query, order, scroll and selected item.

## Adaptive rules

| Available width   | Behavior                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| >= 960 px         | Full 192 px sidebar; normal toolbar and normal list                                                                         |
| 720–959 px        | 56 px icon rail; accessible labels/tooltips; search may collapse                                                            |
| < 720 px          | Navigation becomes a temporary opaque overlay opened by menu button                                                         |
| < 480 px          | Controls wrap within task/form, secondary actions move into named menus; no full-width nav tabs                             |
| Very short window | Reduce decorative gaps; one useful scroll region; form title/footer can join body scrolling if fixed areas would consume it |

Thresholds are starting values. Content fit, locale and zoom take priority over exact cutoffs. Sidebar state changes must not lose focus or remount the task cache.

For the 373 × 240 minimum: keep menu, creation and active task controls reachable; main view may show only one row. Dialogs use the available window, body scrolls, and all actions remain keyboard reachable. No whole-app horizontal scrollbar. Data tables may have their own labelled horizontal scroll area.

Platform controls are native where available. On macOS use native traffic lights and reserve their hit region; do not draw a second set. Windows/Linux custom controls, if retained, call the existing Tauri window APIs and preserve native close/tray behavior. Drag regions exclude controls. A screenshot is not proof of native hit testing or platform acceptance.

## Typography

Use the existing system-oriented font stack, with local platform fallbacks and no remote font dependency. CJK: PingFang SC / Microsoft YaHei / installed Noto Sans CJK as available. Latin: system UI. Do not redistribute Apple fonts or replace file names with image text.

| Role                     | Size / line height | Weight  |
| ------------------------ | ------------------ | ------- |
| Page title               | 24 / 32            | 600     |
| Detail title             | 22 / 30; wraps     | 600     |
| Dialog title             | 20 / 28            | 600     |
| Task name                | 15 / 22            | 500     |
| Form / nav / action      | 14 / 20            | 400–500 |
| Metadata / group heading | 13 / 20            | 400–500 |
| Footer / caption         | 12 / 18            | 400     |

Use tabular numerals for changing speeds, percentages and time, without making all text monospace. Reserve metadata width to avoid jitter. Format bytes, dates and numbers through existing locale utilities. Never announce every speed tick to screen readers.

## Color and token architecture

Electric Purple #7B3ED1 remains the seed. The actual accessible primary role may differ from the seed; existing light default primary is #7739CD. Keep Material Color Utilities as the one palette generator. The design changes surface mapping and components, not palette ownership.

Three layers:

- Primitive: seed, the existing generated palettes, spacing steps, typography and durations.
- Semantic: app surface, sidebar, field boundary, text, accent, focus, feedback.
- Component: task row, nav item, dialog, button, input and footer consume those semantics.

Proposed mapping uses the existing generated neutral palette:

- Main and dialog: light neutral tone 99–100; dark tone 8–10.
- Sidebar: light neutral tone 97; dark tone 12.
- Raised menu/field surface: light tone 99; dark tone 17.
- Quiet row hover: foreground mixed 3–4% into surface.
- Selected navigation/row: primary mixed about 6–8% into surface; selected text uses accessible primary.
- Main and secondary text: existing onSurface / onSurfaceVariant.
- Decorative separator: subdued outlineVariant.
- Field border and control shape: outline role, not a barely visible separator.
- Status colors: existing harmonized success/warning/error/info roles with text or icon.
- Backdrop: neutral black at approximately 14–18%; no blur.

These are aliases/tone assignments in the existing theme pipeline, not a second color generator or hardcoded light-only component palette. Update first-paint fallbacks with the implementation so cold start and runtime agree. Confirm contrast after mapping.

Most of a screen stays neutral. Reserve filled purple for a principal action, selected control or progress. Do not make every completed item green or every error a large red card. Shadows identify transient layering, not every row.

## Accessibility and input

Normal text must reach 4.5:1. Large text uses the W3C definition: 24 CSS px regular, or approximately 18.67 px bold, rather than a blanket 18 px threshold. Essential control boundaries and focus indicators target 3:1. Disabled controls are exempt from WCAG contrast requirements; retain useful legibility.

Use visible 2 px focus outline with 2 px offset. Focus remains visible under sticky headers/footers. Product targets are normally 32–36 px or larger, exceeding WCAG 2.2's 24 × 24 minimum baseline (which has defined exceptions). Larger targets for touch/coarse pointers. Do not confuse glyph size with hit-target size.

Use real button, input, nav and main semantics. Row expansion is an explicit accessible control; do not nest buttons inside a row-wide button. Tab reaches named actions, Space toggles focused checkboxes, Enter activates, Escape closes the top dismissible surface. Keep IME composition and text editing untouched by global shortcuts.

Cmd on macOS / Ctrl elsewhere: N new download; F search current scope; comma settings where it does not conflict with native conventions. Back restores previous content location. Do not adopt the generated menu's bare P/O/C/I as global keyboard shortcuts. Any custom global shortcut requires a separate conflict review.

File names, URLs and hashes use bidirectional isolation inside RTL UI. Mirror layout and directional arrows where appropriate; do not reverse file contents, progress values or native window-control placement. All user-facing copy must go through the existing 27-locale schema when implemented.

## Asset and scope boundaries

Use src/assets/rayburst.svg directly and existing maintained icon set. Do not trace generated icons or implement iconography as text glyphs. Generated imagery is design reference only, not shipped interface assets.

This pack covers the desktop application and its browser-handoff surface. It does not implement the extension, rebuild the promotional website, change engine algorithms, release a version, reset actual data or alter application identity.
