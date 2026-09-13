# Rayburst desktop design handoff

The approved visual baseline is [01-task-overview.png](01-task-overview.png), selected by the user on 2026-09-13. Keep its left navigation, light lightweight list, Electric Purple accent and continuous-motion intent. Other screens extend this direction and remain implementation proposals.

## Start here

Open [GALLERY.html](GALLERY.html) for the complete image gallery. It is an offline static document: no application prototype, runtime downloads, external dependencies or simulated task operations.

Read these documents before implementing:

1. [VISUAL-SPEC.md](VISUAL-SPEC.md): hierarchy, measurements, typography, semantic colors, platform/narrow-window rules.
2. [COMPONENTS.md](COMPONENTS.md): reusable anatomy, states, accessibility and setting transaction families.
3. [FLOWS.md](FLOWS.md): real download, selection, receipt, retry, deletion and recovery semantics.
4. [MOTION.md](MOTION.md): durations, interruption, identity, exit lifecycle, reduced motion and native acceptance.
5. [SETTINGS-MAP.md](SETTINGS-MAP.md): all 127 declared AppConfig keys, locations and apply behavior.
6. [COVERAGE.md](COVERAGE.md): rendered scenarios, written-only states, image limitations and validation.
7. [SOURCES.md](SOURCES.md): official research and local source evidence.

[manifest.json](manifest.json) indexes all screens and exact generation prompts. [settings-map.json](settings-map.json) provides the machine-readable configuration map.

[design-values.json](design-values.json) records proposed dimensions, typography and motion values for later implementation. It is not an application dependency or a replacement palette generator.

## Screen index

| ID  | Screen                                                                            | Status            |
| --- | --------------------------------------------------------------------------------- | ----------------- |
| 01  | [Approved task overview](01-task-overview.png)                                    | approved-baseline |
| 02  | [New download](02-new-download.png)                                               | proposed          |
| 03  | [Appearance settings](03-settings.png)                                            | proposed          |
| 04  | [Task expanded](04-task-expanded.png)                                             | proposed          |
| 05  | [Compact list and batch selection](05-compact-batch.png)                          | proposed          |
| 06  | [Full task detail and files](06-task-detail.png)                                  | proposed          |
| 07  | [BitTorrent selection states](07-bt-selection.png)                                | proposed          |
| 08  | [Video audio subtitle and container selection](08-media-selection.png)            | proposed          |
| 09  | [Live recording publication and retry](09-live-lifecycle.png)                     | proposed          |
| 10  | [Advanced creation validation and uncertain submission](10-add-advanced.png)      | proposed          |
| 11  | [History missing files and removal](11-history-removal.png)                       | proposed          |
| 12  | [Browser handoff and connection settings](12-browser-connection.png)              | proposed          |
| 13  | [Download storage and scheduled limits](13-download-settings.png)                 | proposed          |
| 14  | [Network settings restart and rollback](14-network-settings.png)                  | proposed          |
| 15  | [File categories and User-Agent editors](15-rule-editors.png)                     | proposed          |
| 16  | [BitTorrent settings and eD2k search](16-bt-ed2k.png)                             | proposed          |
| 17  | [Empty search loading and engine recovery](17-empty-recovery.png)                 | proposed          |
| 18  | [Maintenance updates and explicit reset](18-maintenance.png)                      | proposed          |
| 19  | [Windows macOS Linux and narrow windows](19-responsive-platforms.png)             | proposed          |
| 20  | [Component states and visual foundations](20-components.png)                      | proposed          |
| 21  | [Continuous removal expansion and dialog motion](21-motion-storyboard.png)        | proposed          |
| 22  | [Menus popovers sources peers and sharing states](22-menus-and-detail-states.png) | proposed          |
| 23  | [Long content RTL and dark-theme appendix](23-localization-theme.png)             | proposed          |

## What to reproduce

Reproduce the layout, visual weight, hierarchy and specified interactions. Use actual SVG/icons, actual localized strings and actual native data. Generated pixel colors and sample counts are not design tokens or business logic. The written contracts take priority over inconsistent generated details.

The pack contains 23 numbered PNGs, including multi-state boards, plus their exact ImageGen prompts. The first three were generated in the preceding visual-selection round and retained because they match the current direction. The earlier source reference is only composition provenance; 01 is the approved baseline.

Obsolete top navigation / top-bottom exploration images were removed from the project as requested. No old top-layout package is retained in this design directory. Official brand references live one level up in references/.

No source implementation, dependencies, branch, version, application data, website or extension was changed by this handoff. Static design completion does not assert native animation/accessibility acceptance.
