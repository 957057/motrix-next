# Desktop implementation

The desktop follows the approved left-navigation reference. The download engine,
browser submission identities and native file operations keep their existing
ownership. There is one interface, without a legacy layout switch.

## Interaction corrections

Naive UI theme overrides use resolved color values. CSS color expressions remain
in CSS; they are not passed to the library's JavaScript color calculations.
Torrent selection tests mount the actual data table with both application themes
and exercise checked rows and filtered selections.

Task rows and details use the same localized lifecycle labels. Seeding and ED2K
sharing show upload speed and expose their stop action inline. Batch actions are
visible in the toolbar, limit pause/resume to eligible selected tasks, and retain
failed or unresolved selections. Select-all is explicitly scoped to the page.
Native completion and file-preservation behavior remains unchanged.

The displayed task scope changes with the accepted query result. Stale responses
cannot relabel the visible list. Query errors retain their retry action outside
the temporarily inactive rows. Vue Transition crossfades title and state text;
Naive UI owns disclosures, and Motion retains row layout and identity. No custom
animation scheduler or replacement drag/drop implementation is introduced.

Creation fields use explicit spacing between labeled groups. Optional request
and authentication details use library disclosures. Settings use section borders
instead of a divider on every row, right-aligned actions, and a responsive grid
for clipboard types. The speed-limit trigger uses a stateful upward chevron.

These are code and component-test guarantees, not native visual acceptance.

## Toolbar organization

The task header keeps search, View, Select and New in one row. View groups density,
sort field and explicit direction using Naive UI controls. Queue-wide pause/resume
is restricted to the progress page's Queue menu. Normal refresh follows polling;
failed queries expose Retry beside the retained error.

Selection replaces the header title with its selected count. Only applicable
selected-task actions are shown; narrow containers move secondary actions into
an overflow menu. Done restores the normal controls without clearing search.
CSS container queries own responsiveness; no custom width measurement or menu
positioning is used. View-preference persistence failures remain visible.

## Visual implementation

The reference is the light sidebar and unboxed-list composition, with neutral
white content, quiet separators, consistent typography and restrained purple
actions. Settings keep the seven current categories; Connections supersedes the
standalone browser entry in older raster references.

`SettingsRow.vue` composes Naive UI form items into a label/description column
and a right-aligned control column. Short containers stack the same row. There
are no fixed 260 px label columns, divider titles or label-padding shims.
Appearance comes first; version and system information live in `AboutDialog.vue`.
Appearance saves preserve unrelated drafts and restore the control on failure.
Grouped forms expose their save bar only while dirty or applying.

Settings search uses Naive UI filtering over `settingsCatalog.ts`, which owns
only translated labels and destinations. Native configuration ownership does
not move into the catalog. Search can reveal dependent fields without enabling
their controlling settings. Each result targets an actual form anchor and uses
native scrolling and focus. The catalog has a regression check for stale links.

`AppDialog.vue` centralizes Naive UI modal focus, close policy, title, scrolling
body and action layout. New download uses top labels, link/torrent tabs, location,
file name and library disclosure for advanced fields. URL validation reuses the
existing input parser and the native URL parser; non-web protocol grammar stays
with the engine. Empty drafts cannot submit. Errors retain the draft.

Media quality uses radio choices; track, container and recording controls retain
native identifiers and capabilities. File filters retain selections outside the
visible results. Detail headers reuse task display and action models, including
missing-file and protocol-specific behavior.

The former glass About panel, staggered entrances, count rolling, search icon
scaling, recovery halo, progress shimmer, hand-written collapse geometry and
private tab-animation access are removed. Rule editors use light lists and
library drag/drop; reset confirmation uses Naive UI. Piece graphics use native
Canvas roundRect without a custom shape algorithm or activation glow.

## Reference coverage

This table records implementation coverage, not completed visual acceptance.
Every surface still needs the maintainer's separately built-app E2E review.

| References     | Surface                                             | Current implementation                                                                 |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 01, 04, 05     | List, expansion, density, batch operations          | Shared task row, native query identity, Motion presence/layout                         |
| 02, 10         | New download and advanced/error states              | Shared dialog, top-labelled form, library disclosure, preserved submission lifecycle   |
| 03, 12, 13, 14 | General, connections, download and network settings | Shared setting rows, searchable locations, explicit grouped apply                      |
| 06, 22         | Detail, files, sources, peers and task actions      | Shared summary/actions and quiet library tables                                        |
| 07             | Torrent/magnet selection                            | Shared dialog, file search and stable selection                                        |
| 08, 09         | Media selection and live recording                  | Quality radios, track selectors, native duration/finalization states                   |
| 11             | History and removal                                 | Selected-task confirmation, separate file deletion                                     |
| 15             | Category and User-Agent rules                       | Shared dialog, list/editor layout, library reordering                                  |
| 16             | BitTorrent and eD2k                                 | Shared settings rows, native search and protocol operations                            |
| 17, 18         | Empty, recovery, updates, maintenance               | Existing native state machines with simplified presentation                            |
| 19, 23         | Platforms, narrow layouts, localization and themes  | Logical CSS, system fonts, existing platform APIs and 27 locales                       |
| 20, 21         | Controls and motion                                 | Shared theme/control anatomy, CSS/Vue and Naive UI; Motion only for coordinated layout |

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
| Shared settings rows                  | `src/components/preference/SettingsRow.vue`                  |
| Shared dialogs                        | `src/components/common/AppDialog.vue`                        |
| About                                 | `src/components/about/AboutDialog.vue`                       |
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

All 27 locale resources remain present. New labels and descriptions are translated in
every locale. Chinese and English copy also use concise, context-specific actions. The active locale sets document language and direction, and Naive
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

## Settings density and engine feedback

Settings use 36 px controls, 52 px minimum rows, 8 px block padding, 4 px helper
spacing, and 24 px between sections. Labels and descriptions stay together;
field instructions sit under the field. Dependent labels indent by 16 px without shifting the control column.
The settings surface is capped at 960 px. All control groups share the trailing
edge, including switches, segmented choices, fields and maintenance actions.
Checkbox labels remain leading-aligned inside their group. Narrow layouts stack
inside the same setting row and align every control group to the leading edge.

Connections exposes extension credentials directly alongside the RPC section.
RPC restart guidance belongs to the section; access-scope help belongs to its
switch. Tracker, blocklist, bootstrap and maintenance actions use labeled rows
with trailing buttons. Source selection remains a standard checkbox group.

Engine recovery retains the stop/start/verify track through success. CSS fades
markers and colors; Vue owns text transitions, and Naive UI owns dialog and
collapse lifecycles. The last presentation survives dismissal until after-leave.
Success dismissal is tied to the native operation ID and never delays native
readiness. The action area keeps its height when Cancel changes to Close.
Tests cover retained leave content, superseded operations and repeated snapshots;
real WebView animation acceptance remains the maintainer's responsibility.
