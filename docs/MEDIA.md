# Native media downloads

Motrix Next uses Aria2 Next's GPAC, libcurl and FFmpeg integration for HLS and
DASH. No separate downloader, player or transcoding executable is required.
The bundled engine must advertise the current RPC contract and implement
`aria2.finishMedia` and `aria2.retryMedia`. Older sidecars are rejected.

## Downloading

Add an HTTP(S) manifest URL through the normal download dialog or browser
extension. The engine detects media from URL suffixes and response MIME types.
The advanced source mode can force HLS/DASH or save the original resource.

New presentations pause after discovery and automatically enter the same
selection queue used by BitTorrent. The content dialog shows available video,
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
