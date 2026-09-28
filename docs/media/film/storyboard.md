# Rayburst film storyboard

66 seconds · 1920 × 1080 base canvas · 60 fps · 120 BPM · D minor · 33 bars.
`timeline.json` supplies the timing for scenes and soundtrack.

## Visual direction

Preserve the five polygons and gradients from the master logo. Outline and
crystal treatments resolve to the flat artwork before the logo holds. Keep
product names untranslated and use the approved English and Chinese slogans
without terminal punctuation or release numbers.

Rayburst uses lavender (`#9E74D5`), Connect uses blue-violet light, and Aria2
Next uses black and gold. Interface colors and geometry follow the product
references. The protocol sequence uses the application's ten color seeds.

Text intended for reading is at least 20 base-canvas pixels. Camera movement
settles before captions appear; readable holds last at least 1.2 seconds.
Captions remain in screen space. Magnified interface details are redrawn rather
than enlarged from screenshots. Perspective tilt returns to a flat view before
a reading hold.

Bloom samples coverage over 16 × 16 pixels so thin text and interface rules do
not glow. Chromatic aberration stays outside the central 35% of the frame,
with a normal maximum of 0.6 pixels and brief transition pulses. Grain is
concentrated in shadows.

From 12 to 44 seconds, the application and browser share one desktop world.
Camera moves connect the scenes. Numbered callouts and moving light along
leader lines direct attention to the relevant interface detail.

## Shots

| Time    | Scene     | Picture                                                                                                                                                                                                                                                   | Sound                                                                                        |
| ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0–4 s   | Wait      | `project-assets.zip` crawls at 12 KB/s as its remaining time grows. The headline rises through a mask. Two glitches interrupt progress; the bar tip lights at 3.5 s.                                                                                      | Filtered pad, D drone, quarter-note ticks, glitches and a rising spark.                      |
| 4–8 s   | Ignite    | The spark reaches the logo's convergence point. Rays trace its outline from 4.75 s; the mark becomes recognizable around 5.5 s. Exposure falls at 7.875 s.                                                                                                | Riser, opening filter, arpeggio, bell motif and snare roll; the final eighth-beat is silent. |
| 8–12 s  | Burst     | White flash, crystal-to-flat logo, rays and shockwave. The name and slogan settle. At 11.5 s the camera dives into the convergence point and carries white light into the next shot.                                                                      | Impact, cymbal and three-note motif; a reverse cymbal leads into the protocol hits.          |
| 12–15 s | Protocols | HTTPS, SFTP, BitTorrent, magnet, ED2K and HLS/DASH appear on successive beats. Large labels sit above typed example links; the palette changes between protocols.                                                                                         | Restrained hits, sub-bass and chord-following stabs.                                         |
| 15–18 s | Protocols | The camera lands on Add Task. Five links enter the input field; the cursor selects Create.                                                                                                                                                                | Light typing and plucks; the arpeggio returns.                                               |
| 18–20 s | Protocols | The dialog closes and five tasks enter on sixteenth notes. Magnet metadata and live-media probing precede downloading.                                                                                                                                    | Soft impact and five rising pops.                                                            |
| 20–32 s | App       | Three callouts show parallel connections, the torrent piece map and live recording. Magnifiers expose task details; segments flow into the recording task. Completion and seeding notifications appear, then close before the camera pans to the browser. | Main melody, callout bells, clicks, drawer movement and notification cues.                   |
| 32–38 s | Connect   | Open the extension, discover resources and choose a media stream. Media options move from probing to the form, MKV selection, submission and confirmation.                                                                                                | Continuous groove, ticks, clicks and popup cues.                                             |
| 38–44 s | Connect   | Pull back to the browser and Rayburst. A light arc carries the confirmed download into the task list. Push toward the new task, then dive into its progress bar as it turns gold.                                                                         | Stereo handoff sweep, arrival chord and reverse cymbal.                                      |
| 44–50 s | Engine    | Gold data lanes converge on the Aria2 Next chip. The name, subtitle and protocols hold in a black-and-gold scene.                                                                                                                                         | D pedal, metallic FM bells and a riser; one beat of silence.                                 |
| 50–56 s | Craft     | Six cuts show light/dark appearance, ten palettes, 27 languages, Tauri 2 and Rust, no telemetry, and open source.                                                                                                                                         | Cut accents and snare roll; one beat of silence.                                             |
| 56–66 s | Outro     | Final logo burst. Name, slogan, platforms, website and supported browsers appear in sequence, followed by a highlight sweep and end-card hold.                                                                                                            | Final drop, resolution to D major and a fading tail.                                         |

## Product references

Task cards and actions follow `TaskItem.vue`, `TaskDragHandle.vue`,
`TaskItemActions.vue` and `useTaskCardModel.ts`. Add Task follows `AddTask.vue`;
the details drawer and piece map follow `TaskDetail.vue`,
`TaskDetailActivity.vue` and `TaskGraphic.vue`. Notifications follow
`useTaskNotifyHandlers.ts` and `useNotificationToast.ts`.

Connect's popup and media form follow `PopupHeader.vue`, `MediaPanel.vue` and
`MediaSelection.vue`. The locale check compares the film's interface labels
with both repositories. Camera movement, lighting and the handoff beam are
presentation effects; transfer rates are illustrative.

## Music

| Bars  | Chords                  | Arrangement                                                    |
| ----- | ----------------------- | -------------------------------------------------------------- |
| 0–1   | Dm Dm                   | Drone, filtered pad and ticks                                  |
| 2–3   | B-flat C                | Opening filter, arpeggio, riser and roll                       |
| 4–5   | Dm B-flat               | Full drop and main motif                                       |
| 6–7   | F C                     | Kick, bass and protocol stabs; arpeggio returns with the links |
| 8–9   | Dm B-flat               | Full groove                                                    |
| 10–15 | F C Dm B-flat F C       | Main melody                                                    |
| 16–21 | Dm B-flat F C Dm B-flat | Lift and motif reprise                                         |
| 22–24 | Gm B-flat A             | D pedal, gold bells and dominant return                        |
| 25–27 | Dm B-flat C             | Quick-cut groove                                               |
| 28–32 | Dm B-flat C D D         | Final motif and major resolution                               |

Kick-driven ducking lowers the bass and pad. Interface cues sit below the
music. Events marked `gap` in the timeline supply the pre-drop silences.
