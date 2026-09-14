# Component contracts

These contracts implement the approved visual direction. Source contracts override generated pixels. The [component sheet](../screens/20-components.png) is a visual sample; exact behavior lives here.

| Component                  | Anatomy and variants                                         | Interaction and state contract                                                                |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| App shell                  | One global nav, one content pane, title region, footer       | Persist through route changes; platform window controls stay independent                      |
| Sidebar item               | 18 px icon, label, optional count, 40 px target              | Selected is not focused; accessible current-page state; counts never move labels              |
| Header                     | Title plus search, sort, more, primary create                | Selection mode replaces actions; overflow removes secondary items first                       |
| Search                     | Named input, clear button, result context                    | Retain query per scope; IME-aware; empty results do not clear native tasks                    |
| Task row                   | File icon, title, metadata, progress, principal action, more | One shared model for normal/compact; GID identity; capability-driven controls                 |
| Task progress              | Determinate line or phase label                              | Never fabricate total for live, metadata fetch or publication                                 |
| Row disclosure             | Accessible expand control, inline summary                    | One expanded task by default; opening another is user intent; no auto focus selection         |
| Full details               | Back, task header, kind-specific tabs                        | Restore previous list scope/order/scroll; omit irrelevant tabs rather than empty placeholders |
| Task selection             | Row checkboxes, selected count, batch actions                | Freeze target identities at click; action eligibility rechecked natively                      |
| Button                     | Primary / secondary / ghost / destructive                    | Default, hover, pressed, focus, disabled, pending, failed; stable width in pending            |
| Input                      | Persistent label, field, helper/error                        | Error links to field; no placeholder-only label; validation preserves input                   |
| Checkbox                   | Off / on / mixed                                             | One checkbox per logical row; folder mixed state reflects children                            |
| Radio                      | Single choice within labelled group                          | Arrow-key navigation via maintained primitive/native semantics                                |
| Switch                     | Label + explanation + on/off                                 | Off does not erase configured subordinate values                                              |
| Segmented choice           | Small mutually exclusive option set                          | Same semantics as radio group; selection not inferred from hover                              |
| Select / combobox          | Label, value, chevron                                        | Search only if option volume warrants it; maintained popup positioning                        |
| Dialog                     | Title, optional description, body, footer                    | Modal focus and inert background via primitive; state survives leave                          |
| Menu / popover             | Anchor, content, collision handling                          | Single active surface per layer; Escape returns to anchor; keyboard reachable                 |
| Toast                      | Short result, optional action, close                         | Non-blocking; no focus stealing; avoid toasts for every successful field save                 |
| Inline notice              | Icon + specific message + recovery                           | Used for local failure or unavailable capability; no unsupported action                       |
| File selector              | Tree, search, sizes, priority, selected total                | Large trees use mature virtualization if profiling requires it                                |
| Settings row               | Label/help left, control right                               | Intrinsic height; explanation wraps; units and required restart explicit                      |
| Settings save bar          | Dirty status, restore, apply                                 | Appears for grouped draft changes; persists until native/persistence result                   |
| Status footer              | Down/up speed, current limit                                 | Derived from native state; not a duplicate preference store                                   |
| Native file/dir chooser    | OS dialog                                                    | Existing Tauri dialog plugin, cancellation preserves draft; no custom filesystem browser      |
| Native notification / tray | OS integration                                               | Existing native APIs; platform availability controls visibility                               |

## Row-state priority

Choose the display state from the native task kind and phase. Resolve unavailable engine separately from the last known task state. A foreground command pending state can disable its own command without replacing all row content.

| Native/user condition      | Main presentation                                       | Main available action                             |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Active ordinary download   | Speed, ETA if meaningful, byte progress                 | Pause                                             |
| Waiting in engine queue    | Queued label; no fabricated progress increase           | Pause / more                                      |
| Paused                     | Paused label; retain last actual progress               | Resume if policy allows                           |
| BT metadata                | Obtaining file list; indeterminate                      | Choose later / policy action                      |
| BT file choice unresolved  | Needs selection                                         | Select files                                      |
| Media choice unresolved    | Needs video/audio choice                                | Select content                                    |
| Verification               | Verification label, verified progress only if available | Only native-supported actions                     |
| Seeding                    | Upload rate, ratio/time                                 | Pause sharing / finish sharing                    |
| Live capture               | Recorded duration, bytes, current rate                  | Finish and save; separate pause                   |
| Media finalization         | Publishing label; no fake percentage                    | Native-supported controls only                    |
| Recoverable failure        | Specific failure, retained-data information if known    | Native retry                                      |
| Unsupported terminal media | Specific unsupported reason                             | Details / remove, no fake conversion              |
| Completed final file       | Size/time, open action                                  | Open / redownload / remove record                 |
| File missing               | Missing path notice                                     | Open parent if present, redownload, remove record |
| Native command pending     | Existing row + local busy control                       | No repeated identical submission                  |

Do not use generated icon duplication as a pattern. In image 06 the folder row is illustrative: implementation must have exactly one selection control per row. Generated percentages and counts are sample data, not state fixtures.

## Input and failure behavior

- Invalid values receive a local explanation linked with aria-describedby and aria-invalid.
- On submit focus the first invalid field, while retaining all valid fields and scroll context.
- Busy button preserves its label area and accessible name; spinner must not cause width movement.
- A disabled action has an adjacent explanation when the reason is otherwise unclear. Do not rely on a tooltip that cannot be reached.
- Keep focus ring visible alongside error state. Focus is not removed because a control is busy.
- Table headers use proper associations. Native HTML tables are preferred over a manually implemented ARIA grid when advanced cell navigation is unnecessary.
- Use standard text controls for URLs, numbers and times where supported and appropriate; validation is still required.
- Tooltips supplement visible labels. Core task actions remain reachable with keyboard or touch.
- Menu shortcut examples in image 22 are illustrative and are not an approved keyboard map.
- Menu and speed-popover crops on a board illustrate alternate states; they do not instruct the application to open unrelated popovers simultaneously.

## Settings transaction families

1. Appearance-only choices can apply immediately with rollback and a local error if persistence fails. Theme, accent, list density, task counts and reduced motion apply immediately; grouped native settings retain explicit saves.
2. Related download/network/engine settings are edited as a draft and applied together. Keep restore, apply, pending, saved, failed and restart-required states.
3. For hot changes, preserve the current validated native/persistence transaction and rollback behavior. Do not mark saved after only one stage succeeds.
4. Non-hot settings follow existing restart capability metadata. No text saying settings are active before required restart.
5. Maintenance actions have their own explicit actions; they are not ordinary save toggles.
6. Closing or navigating away from a dirty grouped form offers keep editing / discard / apply. The choice applies to a concrete draft, not every minor navigation.
