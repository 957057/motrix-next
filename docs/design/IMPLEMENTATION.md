# Desktop implementation

The desktop follows the approved left-navigation reference. The download engine,
browser submission identities and native file operations keep their existing
ownership. There is one interface, without a legacy layout switch.

## Interface ownership

| Area                                  | Implementation                                               |
| ------------------------------------- | ------------------------------------------------------------ |
| Window composition                    | `src/layouts/MainLayout.vue`                                 |
| Native listeners and window lifecycle | `src/composables/useDesktopRuntime.ts`                       |
| Global navigation                     | `src/components/layout/AppSidebar.vue`                       |
| Transfer status and speed limits      | `src/components/layout/StatusBar.vue`                        |
| Search, selection and expansion       | `src/stores/taskView.ts`                                     |
| Normal and compact task rows          | `src/components/task/TaskRow.vue`                            |
| Contextual task capabilities          | `src/components/task/TaskItemActions.vue`                    |
| Full task details                     | `src/components/task/TaskDetail.vue`                         |
| Connections settings                  | `src/components/preference/Connections.vue`                  |
| Shared settings layout                | `src/views/PreferenceView.vue`, `src/styles/preferences.css` |

Navigation is 192 px wide, becomes a 56 px rail below 960 px, and uses the
library drawer below 720 px. The native minimum window size remains 373 × 240.
The toolbar has a title, search, two menu triggers and one primary creation
action. Selection replaces its action area; destructive batch commands use
explicitly selected GIDs. File deletion remains a separate, unchecked choice.

Details occupy the right workspace. The underlying list stays mounted, retains
scroll position and becomes inert while details are open. Returning restores
keyboard focus where the initiating element still exists. Query, expansion,
density and native task identity are independent of the detail component.

Settings contain General, Downloads, Network, BitTorrent, eD2k, Connections,
and Advanced. Connections owns browser behavior, extension API credentials,
RPC credentials and their shared access scope. It has one draft and save bar;
there is no separate connection route or sidebar entry. Low-frequency extension
credentials use Naive UI disclosure. Secrets have bounded-width fields and
labelled reveal, copy and regenerate buttons.

Connection saves confirm changes once, await the native runtime cache refresh,
and await engine restart when RPC or access scope changes. The HTTP binding
operation is idempotent, so combined changes keep an already matching listener.
Native port recovery remains authoritative and its applied values replace the
successful draft. Failed saves restore persisted configuration before restoring
runtime services; failed restoration is reported separately. While saving,
duplicate saves share one promise, discard is disabled and route changes are
blocked. No service command waits for an animation to complete.

All 127 configuration fields remain supported. Appearance changes retain their
existing immediate behavior; engine settings use explicit save/discard. Failed
saves restore the native configuration and keep the editable proposal dirty.
Language selection retains the existing application restart contract.

All 27 locale resources remain present. New interface text is translated in
every locale. The active locale sets document language and direction, and Naive
UI supplies its exported RTL control styles. System fonts and the official SVG
logo remain the only typography and logo sources.

## Data boundary

`TaskService::query_tasks` applies native visibility policy and delegates to the
existing SQLite owner. `database/task_query.sql` combines native task projections
with persisted history, removes duplicate protocol identities, filters and sorts
the result, and returns one page. Counts, total and page bounds come from one
transaction. Dynamic ordering uses an allowlist; search and values are bound
parameters. Literal percent and underscore characters are not SQL wildcards.

Only the selected page's history records cross IPC. The engine still supplies
its task snapshot to the native service; this change does not introduce a new
engine protocol or rewrite its download algorithms. Selection eligibility is
returned independently of pagination, so an off-page selection request remains
reachable. Peers are requested only while the Peers tab is open.

The attention count includes failures and unresolved selections. It can overlap
the in-progress count. Search changes the result total without changing global
navigation counts. Manual order applies to display order, never engine priority;
known positions come first, with unknown GIDs appended using stable ordering.

Pinia consumes native page order, preserves the previous snapshot on query
failure, rejects stale scope/search responses and tracks pending operations per
GID. A retry does not suspend other downloads' refreshes. A new submission uses
its own GID; no replacement borrows an old component key.

## Motion ownership

| Interaction                                    | Owner                           |
| ---------------------------------------------- | ------------------------------- |
| Hover, focus, progress and simple fades        | CSS and Vue Transition          |
| Row presence and layout                        | Motion for Vue 2.4.2            |
| Inline details                                 | Motion height/opacity animation |
| Task, category and UA rule ordering            | Motion Reorder                  |
| Modal focus, stacking and dismissal            | Naive UI                        |
| Files, window controls, notifications and tray | Tauri/native services           |

The presence owner stays mounted when the final row leaves. Rows use stable GID
keys across progress, completion and density changes. Layout animation uses
position projection; it does not scale task text. Managers use the same library
for dragging and expose keyboard ordering. There is no custom drag geometry,
floating clone, animation frame loop or drop-settling timer.

Typical timing is 120 ms for feedback, 160–200 ms for views and dialogs, 200 ms
for layout, and 240 ms for progress. Naive UI has no public modal-motion override;
one documented CSS adapter replaces its large scale transition with a 6 px
translation. The system and application reduced-motion preferences are combined;
zero duration still completes lifecycle cleanup. Hidden documents pause visual
polling while Rust continues downloads and persistence.

The add dialog retains its form and batch through exit. Clipboard and inspection
callbacks check the current draft generation. BT and media dialogs retain their
existing generation and closing-state contracts. Tracker sync and system proxy
detection no longer wait for artificial minimum animation durations.

Removed: the double sidebar, floating speed capsule and width observer, duplicate
full/compact cards, rolling labels/counts, AutoAnimate, SortableJS and manual
drag-settling code. Window surfaces are opaque; no glass material is used.

## Acceptance

Repository tests cover native page bounds, counts, identity deduplication,
literal search, stable ordering, stale responses, pending operations, partial
batch failures, row identity, the last-row presence owner, form rollback and
selection-dialog lifecycle. Standard lint, type, build, locale and Rust checks
remain required.

Native visual acceptance is still required on separately built Windows, macOS
and Linux applications. Browser automation is not a substitute for that check.
Check these cases with real downloads:

- Add, delete and complete the final visible task; rapidly reverse expansion.
- Reorder by pointer and keyboard, including a scrolled list and a task completing
  during a drag. Check pointer capture and edge scrolling in each WebView.
- Open/close/reopen creation and selection dialogs while IPC is pending.
- Verify batch partial failures and the optional file-deletion choice.
- Open details, switch tabs, return, and confirm focus and scroll position.
- Inspect 373 × 240, rail and full-sidebar widths, long filenames, CJK and RTL.
- Check light/dark themes, system/app reduced motion, hide/restore and native
  title-bar controls. Measure frame behavior on Linux's configured renderer.

The website rebuild and extension visual alignment remain separate work after
desktop acceptance.
