# Native media downloads

Motrix Next uses Aria2 Next's GPAC, libcurl and FFmpeg integration for HLS and
DASH. No separate downloader, player or transcoding executable is required.
The bundled engine must advertise the current RPC contract and implement
`aria2.finishMedia` and `aria2.retryMedia`. Older sidecars are rejected.

## Downloading

Add an HTTP(S) manifest URL through the normal download dialog or browser
extension. The engine detects media from URL suffixes and response MIME types.
The advanced source mode can force HLS/DASH or save the original resource.

The Downloads preferences define the default container and whether new finite
presentations require content selection. With selection enabled, new presentations
pause after discovery and enter the selection queue used by BitTorrent. With it
disabled, the desktop resolves the native probe and continues finite sources with
`changeOption` and `unpause`, while keeping live recording behind confirmation.
The engine receives only its existing boolean pause option. Preferences apply to
new tasks only; restored tasks never enter automatic selection. The content dialog shows available video,
audio and subtitles, the output container, and a duration limit for live sources.
Confirming starts the same GID. Choose Later keeps it paused with a direct action
on its task card; it does not repeatedly reopen. Restored tasks remain accessible
without automatically interrupting startup. Ordinary files do not enter this flow.
Explicit native options can bypass selection; resume-all skips unresolved choices.

Audio and subtitle selectors accept a language or a native representation ID.
`best` chooses the native default and `none` excludes that track type. An HLS
multiplexed representation can contain both audio and video. This is not an
arbitrary multi-audio or multi-subtitle selection interface.

MP4 and Matroska are output containers, not encoding presets. Unsupported codec
or subtitle combinations fail explicitly; choose MKV when MP4 cannot carry the
selected subtitles. DRM, webpage extraction, subtitle translation and transcoding
are outside the engine's supported scope.

## Recording and recovery

Live tasks report recorded duration instead of a percentage. **Finish recording
and save** requests publication of committed media; it does not report success
until the engine emits ordinary task completion. The toolbar can request this
operation for all recordings in the current task list. Pause retains recovery
data; deletion discards it. These operations are not interchangeable.

Failed media uses the native `retryMedia` transaction, preserving its GID and
recovery data. The shared content dialog also allows changing media options before a
retry. Changing selection or container may invalidate prior fragments according
to the engine's identity rules. Already expired live segments cannot be recovered.

Re-downloading a completed presentation creates a new task. Native automatic
file renaming protects existing output and persists the chosen destination for
restart. The application never copies or edits the engine's media SQLite records.

## Integration boundaries

- `Aria2Task.media` passes through Rust, frontend snapshots and history metadata.
- Numeric RPC values remain decimal strings. Durations are milliseconds and
  presentation progress is a fraction. The string `"false"` is not truthy media
  state.
- Source payload bytes differ from final container bytes. File size becomes
  authoritative after publication; finalization has no fabricated percentage.
- Completion persistence runs in Rust and remains available in lightweight mode.
  History retains non-sensitive media options, not copied credential headers.
- Network headers, authentication, proxies, TLS and speed limits use the existing
  transport. Certificate verification uses the native system trust policy.
- The engine owns manifest timing, segment retention, decryption, muxing and
  transactional publication. Frontend logic does not reproduce those algorithms.

## Validation

Run the normal TypeScript, Vitest and Rust checks. In the engine repository,
`tools/transfer_validation/media/recovery.py` exercises selection across restart,
partial failure, native retry, decoded output equality and output collisions
using the existing Caddy/FFmpeg validation helpers. Public media validation covers
subtitles, audio-only downloads and live recording controls separately.

All six platform sidecars must be built from the updated engine source before
distribution. Updating the Windows development binary alone does not update
the other packaged targets.

## Selection UI ownership

BitTorrent and media have independent dialogs and submission paths. The selection
queue stores only task identifiers, dialog kinds, and prompting state. Task
snapshots determine readiness outside the queue. The host waits for `after-leave`
before presenting the next dialog; each dialog retains its content through exit.
The native media dialog owns track loading, output options and same-GID retry.
BitTorrent retains its existing file selector and category routing. Both use
Naive UI modal primitives and the application's shared motion styles.

Modal instances stay mounted with `show=false` until selected, allowing Naive UI's
native enter transition to run on the first opening. Loading, errors and forms
share stable dialog bounds; the footer does not move during asynchronous updates.
The task overview renders media-specific rows inside its existing descriptions
and provides selection beside status, without repeating protocol or diagnostics.


## Browser media API

The desktop implements the extension's `/media/v1` inspection contract in Rust.
The endpoints are authenticated with the Extension API secret; media requests
require a nonempty secret and an extension origin (or an authenticated native
client with no Origin header). Browser-page origins cannot use these endpoints.
Media operations remain available when the main webview is closed.

Only `hls` and `dash` are advertised, based on the running engine's capabilities.
Direct-file inspection is not advertised: the existing engine's HEAD/dry-run path
cannot establish the required media inspection contract without changing the engine.
Ordinary file downloads through the existing `/add` endpoint remain available.

Browser request contexts containing headers are rejected with `unsupported_source`.
The existing engine cannot enforce exact-origin forwarding for arbitrary custom
headers at every redirect. The adapter neither flattens these contexts nor silently
drops them. Public HLS/DASH sources can be inspected with cookie and request-header
forwarding disabled in the extension. Signed source URLs remain unchanged.
This limitation does not change the ordinary download dialog's HTTP options.

An inspection uses `media-pause-after-probe=true`, retains its GID through selection,
and stays outside download lists, history, notifications and bulk resume/pause.
Confirmation validates native track IDs and starts that GID without another desktop
selection dialog. Native container/codec validation remains authoritative.

`media-operations.db` stores bounded operation identities and submission receipts
using SQLite transactions. It contains request fingerprints, not source URLs or
browser credentials. Inspections expire after five minutes; cancellation tombstones
and submission receipts remain for at least 24 hours. Repeated submissions return
the same GID. A lost RPC reply preserves the submission intent for reconciliation.
Restart invalidates unsubmitted inspections and preserves acknowledged submissions.
The journal has its own native lifecycle and does not require the history webview.

Transport ambiguity returns HTTP 503; the current extension preserves its operation
identity on that response and can reconcile by polling. It does not mean that the
engine failed to create or start a task. Unsupported sources and selections use the
contract's terminal error codes. No legacy media endpoints or raw RPC proxy exist.

Run the isolated Windows native boundary test explicitly with:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib bundled_engine_probes_without_payload_and_submits_the_same_gid -- --ignored
```

It uses the unchanged bundled engine, private fixture ports and a temporary output
folder. It verifies that probing requests no payload and confirmation starts the
same GID. The fixture intentionally returns a missing segment after confirmation;
it validates the control boundary, not full-file decoding or browser UI behavior.
