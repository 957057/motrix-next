# Interaction and state flows

The diagrams are design contracts, not new backend algorithms. Existing Rust receipts, native task policy and SQLite remain authoritative.

## Main navigation

- All tasks: download work, waiting, needs-action and recent completion groups; no automatic featured task.
- In progress: active, queued, paused, verifying, metadata and sharing phases. Resolved native policy determines membership; needs-action presentation must not create a duplicate underlying task.
- Completed: native completion/history, with date groups and missing-file state.
- Needs action: failed tasks and unresolved selection surfaced through a native projection in the proposed architecture. The current failed route alone is not assumed to provide this aggregate.
- Settings: General, Downloads, Network, BitTorrent, eD2k, Connections and Advanced use one horizontal category row. Connections groups browser extension behavior, independent API/RPC credentials and their shared access scope. A listening local service does not prove that an extension is connected.

Navigation preserves query, sort, scroll and selected task per scope. Newly arriving tasks do not steal focus or change the expanded task. Header counts use defined scope semantics, not the number of rows currently loaded.

## Create an ordinary download

```text
manual paste / deep link / native file drop / browser confirmation
                          |
                  populate editable intent
                          |
          validate input, path and applicable options
                          |
                   submit native command
                          |
        +-----------------+-------------------+
        |                 |                   |
    created GID     needs confirmation    outcome uncertain
        |                 |                   |
  existing task row   keep pending intent   reconcile same ID
        |                                     |
  actual native state             receipt / explicit retry state
```

The filename input is an explicit override when edited; otherwise label a browser suggestion as a suggestion. Never perform an extra frontend HEAD request to infer a final filename. Native code owns decoding, collision handling and final path.

For batches, parse and validate each line and preserve successful and failed outcomes individually. Do not retry an entire batch with fresh identities after partial success. A mixed result shows created count and per-line failures without dismissing the remaining editable intent.

Browser needs-confirmation is not an engine GID. An ambiguous receipt must not show a fabricated task or invite duplicate submission. For inspection-only browser media, no history/task row exists until committed.

Native file dialogs return the selected path or cancellation; maintain form state in either case. Drop targets handle supported links/torrents through the current Tauri native drag/drop path; do not replace it with incompatible HTML5 drag behavior on Windows.

## BitTorrent and magnets

```text
torrent inspection / magnet metadata
       -> file tree ready -> select files and priorities -> native submission/update
       -> still loading -> keep waiting OR choose later
       -> failed -> retry supported inspection OR choose later
```

Choose later retains unresolved intent/task in the appropriate paused state. It does not silently download everything. Restored tasks do not automatically reopen a selection modal. Resume-all skips unresolved selection. A user-requested download-all policy remains explicit.

File priorities use the existing off/normal/high/top mapping. Folder checkbox state is aggregated; search must not silently select all hidden children. Selected counts and totals derive from actual selected files. Metadata itself may have native task identity; do not manufacture another.

## Media, live and publication

Finite media: select one video, one audio and optional one subtitle; default/none options follow native capabilities. MP4/MKV are container choices. Use native codec/container validation; choosing another container is not transcoding. DRM, arbitrary webpage extraction, translation and multi-audio mixing are not added.

Live media always confirms duration: finite time or explicitly unlimited. Show recorded duration rather than a completion percentage. Finish and save is distinct from Pause and Delete.

```text
inspect -> needs selection -> selected -> transferring / recording
                                  |               |
                               pause          finalizing
                                  |               |
                               resume       native publication
                                                  |
                                               completed
                             error -> native retry using same GID
```

Retries preserve identity and valid retained fragments according to native policy. A completed task redownload is a new operation. A changed selection may invalidate fragments only through the native implementation. Final payload bytes can differ from final container size.

BT and media queues remain separate native-aware selection flows. One visible modal at a time; the next instance opens only after the previous exit. Do not clear body content while fading out.

## Task actions and details

Normal and compact views use one capability map. Main action reflects current state; uncommon actions live in a menu. Clicking a file name expands quick details through an accessible control. Full details open in the main pane; appropriate tabs include overview/files, sources or peers, trackers, activity and options.

Task option changes are draft-based, validated and applied only to the selected stable GID. Dirty state is not reassigned to another task when selection changes. Tabs unrelated to the task kind are absent.

Batch actions capture exact identities; native policy rechecks eligibility. Show pause/resume counts separately for a mixed selection. Partial failure remains reviewable; do not claim all items succeeded. Selection across pagination must say its scope explicitly; default select-all selects current loaded result set, not unseen history.

Manual row order is display order. Engine queue movement, where supported, is separately named. Never map a visual drag to engine priority implicitly. Sorting by speed/progress is only exposed in supported scopes; the board menu is illustrative, not permission to add unsupported sort fields.

## History and deletion

Removing a record and deleting files are separate user intents. The confirmation states exact item count and file effect. Default file deletion is unchecked unless the user's explicit saved policy says otherwise. Trash and permanent deletion use distinct language. If trash fails, report failure; do not silently switch to permanent deletion.

Missing-file history remains visible until removed or the actual configured cleanup policy removes it. Do not invent a relink scanner. Open parent is only enabled when the parent exists. Any destructive bulk operation uses current resolved native paths, never paths inferred from an old image or DOM text.

Database reset explicitly clears history, receipts and saved website credentials, preserves downloaded files/preferences and restarts the app. Use existing native reset. It is not an automatic recovery response.

## Settings and browser handoff

Settings map documents every existing AppConfig key and the proposed location. UI-only instant changes are distinct from grouped native changes. Unapplied grouped changes survive field validation errors and async failure.

Browser autoSubmitFromExtension is the auto-submit control. silentAutoSubmitFromExtension is available only when auto-submit is enabled. Do not invent another receive master switch. The UI may display local-service availability; actual extension connectivity requires real evidence. Secrets remain masked except explicit reveal/copy; never include them in logs or visual fixtures.

## Empty, loading and failure

| Condition                  | Presentation                                              | Recovery                                       |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| First use                  | Small explanation and create action                       | Add link / native torrent file / browser guide |
| No search results          | Query remains visible                                     | Clear or edit query                            |
| First load                 | Stable skeleton / loading label                           | No unsupported mutations                       |
| Refresh                    | Keep current rows, mark updating if needed                | Retry local query without resetting list       |
| Offline engine             | Last known task data labelled stale                       | Native recovery                                |
| Recovery running           | Stop/start/verify phases from native state                | Cancel only if operation permits               |
| Recovery failure           | Specific native error and bounded next step               | Retry / explicitly explained runtime cleanup   |
| Database unavailable       | Storage-dependent features disabled, specific explanation | Retry if supported; explicit reset separately  |
| Access denied / disk full  | Local task error and actionable path information          | Native retry after user correction             |
| Update unavailable locally | No fabricated release availability                        | Explain no configured update source if opened  |
| Update pending             | Native progress; fixed action area                        | Cancel only when supported                     |
| Update install/restart     | Actual native busy state                                  | No fake finished toast before native result    |

## Native integrations

Native notifications, tray menu, clipboard, file operations, keep-awake and window close remain platform-owned. Keep local task processing independent from WebView visibility. A shutdown-on-completion preference must have visible enabled state and a cancellable native flow if implemented; no surprise activation.

Website reconstruction and extension-wide redesign remain later work. Their existing contracts inform this desktop handoff only.
