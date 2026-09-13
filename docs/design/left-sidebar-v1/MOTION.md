# Motion specification

Primary requirement: no empty exit frame, no task teleportation, no full-window flash. [Storyboard](21-motion-storyboard.png) shows intent; timings below are proposed starting values, not measured performance claims.

## Ownership

Use a single animation owner for each property. Vue Transition handles simple enter/leave, mature layout/presence primitives handle coordinated task movement where needed, and the existing native engine owns download state. Do not stack AutoAnimate, TransitionGroup and Motion layout animation on the same node.

Motion for Vue is a candidate for interruptible layout/presence. Reka UI is a candidate for accessible unstyled dialog/menu primitives. Neither is installed or approved by this document. Stable supported versions are preferred; LTS branding is not a requirement. Prove the chosen combination in Tauri's actual webviews before replacing the existing components. CSS transitions and native platform APIs remain the default for simple changes. Do not write a custom spring solver, FLIP engine, modal focus trap or animation scheduler.

## Timing tokens

| Event                  | Duration              | Properties                       | Rule                                                  |
| ---------------------- | --------------------- | -------------------------------- | ----------------------------------------------------- |
| Hover / press / focus  | 100–120 ms            | color, background, border        | Focus must be visible immediately                     |
| Tooltip / menu         | 120 ms in, 100 ms out | opacity, <= 4 px position        | No bounce; collision positioning belongs to library   |
| Row enter              | 180 ms                | opacity + <= 6 px translation    | Same stable GID                                       |
| Row removal            | 180 ms total          | opacity and surviving-row layout | Exiting content survives until leave completion       |
| Row layout / reorder   | 180–220 ms            | transform via library            | No data-order simulation in animation layer           |
| Inline detail          | 220 ms                | measured layout, opacity         | Reverse from current interpolated state               |
| Dialog open            | 200 ms                | opacity, scale 0.985 to 1        | Body populated before appearance                      |
| Dialog close           | 160 ms                | opacity, scale 1 to 0.985        | Clear draft only after leave                          |
| Content view change    | 140–180 ms            | modest crossfade                 | Preserve shell; avoid empty out-in gap                |
| Progress               | 200–300 ms maximum    | bounded transform                | Only tween values for same GID, phase and denominator |
| State-label transition | 120–160 ms            | opacity                          | Stable text area; no rolling-number gimmick           |
| Toast                  | 140 ms in, 120 ms out | opacity, <= 4 px position        | No stealing focus                                     |

Default easing: cubic-bezier(0.2, 0, 0, 1). Exit may use ease-in. These are suggested tuning values, not physics requirements. Do not delay engine commands until animation ends. Do not serialize unrelated user input behind motion.

## Required sequences

### Removing a task

1. Capture identity, rendered row and focused origin. Mark the command pending; dispatch native action once.
2. On confirmed removal, retain an inert visual exit snapshot while the real item leaves. On failure keep the row and show a local retry.
3. Animate the exiting row and the surviving layout in one coordinated owner. Keep the scroll anchor stable.
4. Dispose after animation completion. Restore focus to the next logical task, previous task, or list heading when empty.
5. A late native failure must not resurrect a new identity or silently restore deleted files. Reflect the real result.

The UI may visually acknowledge intent earlier, but may not claim native deletion succeeded before confirmation. No Undo control unless the actual operation is reversible and implemented.

### Completing a task

Preserve selected/expanded task identity. A completion does not select the next fastest task or collapse the detail. In All tasks, move between groups with one coordinated keyed transition after native completion; keep focused content anchored until it is safe to move. New tasks or speed updates never steal focus. Seeding and media publication are distinct from a completed final file.

### Opening and closing a dialog

The dialog content, active field and draft exist before opening. On close set visibility false but keep content and identity mounted through leave. At after-leave, release focus/overlay according to the accessible primitive and then dispose or reset the draft. A newly queued media/BT dialog opens after the preceding dialog has left; never show the next item's text during the old item's exit.

Escape and outside-click rules are owned by the dialog primitive and flow policy. Closing a progress surface is not cancellation of a native operation unless that operation supports it. Irreversible native work may temporarily prevent dismissal and explains why in the surface.

### Interrupted input

Open → close → open must reverse from the current frame, not snap to an endpoint. Rapid expand/collapse must converge to the latest intent. A stale completion callback may not clear a newer draft or restore focus to an obsolete trigger; bind callbacks to the instance/operation identity.

### Refreshing, sorting and paging

Keep previous data only within the same scope and label it stale when necessary. Never expose old-scope actions as if they belonged to a new scope. First load can use a skeleton; background refresh must not replace known rows with skeletons.

Stable sort tie-breaks prevent jitter. A speed-sorted list moves only because that sort is explicitly selected; while interacting with a row preserve the anchor and avoid perpetual reordering. Paging restores route scroll, not a new full-screen entrance animation.

## Reduced motion and hidden windows

Honor the application preference and, as a proposed accessibility improvement, the OS prefers-reduced-motion signal. Existing code currently exposes the application flag; OS integration is a planned change, not already implemented behavior.

Reduced motion removes spatial translation and scale; use immediate state changes or a short opacity change where appropriate. Run the same cleanup, queue and focus completion logic even at zero duration. Never depend solely on transitionend firing.

When minimized, hidden, or lightweight WebView is suspended, stop unnecessary visual animation and polling. Downloads and native receipts continue. On return hydrate native state and render a coherent current frame; do not replay every missed transfer update.

## Native acceptance scenarios

- Delete the first, middle, last and only row, both normal and compact.
- Complete a selected expanded row while another arrives; preserve focus and scroll.
- Open/close/open a modal rapidly; close while a native file picker is active.
- Resolve media metadata during dialog exit; next queue item must not bleed through.
- Sort while progress updates; switch scope during an outstanding fetch.
- Toggle reduced motion during a transition; hide/show window; switch theme at cold start.
- Long filenames, 27 locales, 200% text/zoom, narrow and short windows.
- Run in WebView2, WKWebView and supported WebKitGTK; no Chromium-only proof of cross-platform success.

Target visibly stable 60 Hz behavior on ordinary supported hardware; measure actual frame pacing and input latency. This static pack cannot validate those measurements.
