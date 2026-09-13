# Screen and scenario coverage

The pack contains 23 numbered PNGs: 3 initial matching screens plus 20 new screen/state boards. Only 01 is the user-approved baseline. Others are proposed extensions. A board can contain several independent states; it does not mean the app displays every panel simultaneously.

| Screen | Scenarios                                                                     | Written contract          |
| ------ | ----------------------------------------------------------------------------- | ------------------------- |
| 01     | Regular All tasks, active, queued, selection needed, completed                | VISUAL-SPEC; COMPONENTS   |
| 02     | New URI/torrent entry, path and filename override                             | FLOWS                     |
| 03     | Appearance, density, motion, counts, locale                                   | SETTINGS-MAP; COMPONENTS  |
| 04     | Stable inline task expansion                                                  | FLOWS; MOTION             |
| 05     | Compact density, selected rows, eligible batch counts                         | COMPONENTS; FLOWS         |
| 06     | Full detail, file hierarchy, priorities                                       | COMPONENTS; FLOWS         |
| 07     | BT file selection, metadata loading and failure                               | FLOWS                     |
| 08     | Video, audio, subtitle and container choice                                   | FLOWS; MEDIA contract     |
| 09     | Live duration confirmation, recording, publication, retry                     | FLOWS; MOTION             |
| 10     | Batch input, advanced headers/auth, validation, uncertain receipt             | FLOWS; DOWNLOADS contract |
| 11     | Completed history, missing files, removal with/without files                  | FLOWS                     |
| 12     | Local browser service, auto-submit/background dependency, masked secret       | SETTINGS-MAP; FLOWS       |
| 13     | Destination, categories, concurrent/connection limits, schedule               | SETTINGS-MAP              |
| 14     | Proxy, request settings, timeout/retry, restart and rollback                  | SETTINGS-MAP; FLOWS       |
| 15     | Category rules and User-Agent profiles/rules                                  | SETTINGS-MAP              |
| 16     | BT sharing/discovery/trackers and eD2k search                                 | SETTINGS-MAP; FLOWS       |
| 17     | First use, zero search results, refresh, native recovery                      | FLOWS                     |
| 18     | Startup, power, logs, updates, explicit database reset                        | SETTINGS-MAP; FLOWS       |
| 19     | Windows/macOS/Linux, full nav, icon rail, overlay nav                         | VISUAL-SPEC               |
| 20     | Buttons, fields, choices, focus, navigation, feedback, row specimens          | COMPONENTS                |
| 21     | Exit, expansion and dialog-close motion frames                                | MOTION                    |
| 22     | Context menu, sort, limit popover, peers/sources, metadata/verify/share/retry | COMPONENTS; FLOWS         |
| 23     | Long localized content, RTL, dark theme appendix                              | VISUAL-SPEC               |

## States specified by rules rather than a dedicated full screenshot

These are covered in the written flows and component patterns; they are not falsely claimed as individually rendered:

- Permissions/disk-full errors, authentication failure, unsupported media/container and live manifest changes.
- Partial batch success, duplicate submission conflicts, long receipt reconciliation and canceled inspection.
- Dirty-form leave, full rollback failure, clipboard refusal, canceled native file picker and invalid rule syntax.
- Pause/resume while finalization/verification changes native eligibility; restored selections and independent BT/media queues.
- Sharing-paused/completed distinctions, per-task options dirty/applying/error, tracker/blocklist/bootstrap sync failure.
- No update origin, checking/up-to-date/download/install/restart/error phases, native notification/tray variations.
- Database unavailable/failed reset, native recovery exhausted and explicit runtime-state cleanup.
- Short-window dialog scrolling at 373 × 240, text zoom, reduced motion, hidden WebView and resuming app.
- Optional advanced config within the 127-key map, including platform-specific settings.

Use the specified common components and source-driven text for these states; do not invent a separate visual language per failure.

## Visual QA observations

All final raster outputs were viewed during generation. Corrections were made for the download-settings tab and numeric ranges, BT/eD2k separation, browser connection semantics and database reset effects.

The remaining raster limitations must not be copied into implementation:

- Progress length, sample counts and sizes can be inconsistent; bind actual native values.
- Some file-tree crops draw duplicate or imperfect checkboxes; exactly one per logical row is required.
- Some boards show dialog/content crops as standalone mini-windows. Follow the actual surface type in FLOWS.md.
- Some submenu samples put speed controls near the top; in the app speed control is anchored to the global footer.
- The source/peer board combines protocol examples. Real details expose only tabs supported by the selected task kind.
- Example shortcut letters are not an approved global shortcut mapping.
- Image 20's generated gray hex swatches are illustrative. Use the existing theme palette pipeline and the written semantic mapping.
- Image 19's small-window dimensions are qualitative; validate the real native minimum and zoom separately.
- Generated localized text, logos and glyphs are approximate. Use the actual SVG/icon set and 27 locale files.
- The light baseline is authoritative for direction; the dark/RTL board is an adaptation appendix.

## Verification completed for this pack

- PNG signatures and actual pixel dimensions inspected from files.
- 127 declared AppConfig keys compared using the TypeScript AST against settings-map.json: no missing, extra or duplicate keys.
- Gallery and Markdown links checked against local files.
- Only the current design screens and implementation specifications are retained.
- Repository integrity and formatting of the new documentation checked; application code untouched.

Static images do not prove accessible focus behavior, native API behavior or smooth animation. The native acceptance list in MOTION.md remains an implementation requirement, not a completed test claim.
