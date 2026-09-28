# Rayburst film

Source for the 66-second Rayburst promotional film in English and Simplified
Chinese. Canvas 2D draws the scenes, WebGL 2 applies post-processing, and
Playwright captures frames for FFmpeg. NumPy and SciPy synthesize the soundtrack.
Both use `timeline.json` for timing.

This project is independent of the desktop build and website deployment.
Its local `pnpm-workspace.yaml` keeps dependency installation separate from the app.
Generated video, audio, downloaded fonts and local environments are ignored.

## Setup

Run commands from `docs/media/film`. Use Node.js 20 or later, the pnpm version
pinned in `package.json`, Python 3.10 or later, and a system FFmpeg executable.
Set `FFMPEG` to its path if it is not on `PATH`. The renderer can also use
`ffmpeg-static` after its installation script has supplied the binary.

```sh
pnpm install --frozen-lockfile
pnpm run setup
python3 -m venv .venv
.venv/bin/python -m pip install -r audio/requirements.txt
```

On Windows, use `.venv\Scripts\python.exe` for the Python commands.
`pnpm run setup` installs Chromium and downloads the Noto fonts. Inter and
JetBrains Mono are included with their OFL licenses. Run `pnpm fonts` to retry
font downloads; missing fonts cause system fallbacks and can change the layout.

## Check and preview

```sh
pnpm check
.venv/bin/python audio/soundtrack.py --stems
pnpm preview
```

`pnpm check` needs only Node.js. It checks the timeline, sound cues, scene
coverage, deterministic drawing and translations, then exercises the scenes
with a simulated canvas. It does not verify browser layout or GPU output.
The locale check finds this repository and the sibling `rayburst-connect`
checkout automatically. Set `RAYBURST_LAB` to their parent directory if needed.

Preview at `http://localhost:5173/?lang=en` or `?lang=zh-CN`. Add `&t=40` to
start at 40 seconds or `&scale=0.5` for a smaller preview. Audio is loaded from
`out/soundtrack.wav` when present.

| Key                  | Action                          |
| -------------------- | ------------------------------- |
| Space                | Play or pause                   |
| Left / Right         | Step one frame                  |
| Shift + Left / Right | Step one second                 |
| 1–9                  | Jump to a scene                 |
| M                    | Toggle motion blur while paused |
| L                    | Loop the current scene          |

## Render

```sh
pnpm stills
pnpm draft
pnpm render
pnpm render:zh
pnpm render:all
pnpm render:4k
```

Output goes to `out/`. The default render is 1080p at 60 fps with eight motion
samples per frame. `render:4k` renders both languages at 3840 × 2160. Generate
the soundtrack first to include music; otherwise the renderer produces silent
video. Audio generation also writes a MIDI score and six stems.

```sh
node scripts/render.mjs --at 9.5,21,40.5 --lang zh-CN
node scripts/render.mjs --draft --from 30 --to 45
node scripts/render.mjs --lang en --scale 2 --gl gpu --workers 2
node scripts/render.mjs --lang en --codec prores
```

The default WebGL backend is SwiftShader. `--gl gpu` uses hardware acceleration;
results can vary by GPU. Use `--samples`, `--workers`, `--crf` and `--preset` to
balance quality, memory and render time. The renderer reports frame progress;
encoding and audio muxing still need to finish after the last frame.

If Chromium is unavailable, run `pnpm exec playwright install chromium`. If
FFmpeg cannot start, check `FFMPEG` or install a system executable. Keep master
renders outside Git; distribute a compressed copy separately.

## Source layout

| Path                    | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `timeline.json`         | Beats, sections, chords and synchronized events        |
| `src/scenes/`           | Scenes, shared desktop world, camera keys and captions |
| `src/ui/`               | Product interface drawing                              |
| `src/core/`             | Timeline, drawing, camera and post-processing          |
| `src/brand/`, `src/fx/` | Logo geometry, palette and visual effects              |
| `src/i18n/`             | Film copy and interface labels                         |
| `audio/soundtrack.py`   | Synthesis, arrangement, mixing and MIDI export         |
| `scripts/`              | Preview server, checks, font downloads and rendering   |

See [storyboard.md](storyboard.md) for shot timing and sound design.
Use the master artwork in `../../../public/logo.svg` and follow
[the brand rules](../../BRAND.md). Interface labels are checked against the
products' language bundles; speeds and transfer sizes are illustrative.
