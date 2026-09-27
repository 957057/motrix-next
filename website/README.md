# Rayburst website

The standalone site for Rayburst: plain HTML, CSS and JavaScript modules with
no build step and no runtime dependencies. Serve the folder as is.

## Preview

```bash
python3 -m http.server 8080      # or: npm run serve
# open http://localhost:8080
```

Use a local server rather than opening `index.html` from disk: browsers block
module scripts and locale requests on `file://`.

## What is on the page

| Section | What plays |
| --- | --- |
| Hero | The logo traces itself and fills in, the name and slogan rise, a live Rayburst window lands below. Completion and seeding toasts appear as tasks finish |
| Protocols | Six protocol families light up in turn; each link types out and a ribbon carries it into the window, where the task lands |
| Details | Three tabs on their own clock: parallel connections, the Task Details piece map, live recording with streaming segments |
| Rayburst Connect | The popup's real flow: sniff, Media options, MKV, Download, confirmation, then the hand-off to Rayburst |
| Aria2 Next | Gold data lanes converge on a terminal typing the engine's quick-start commands |
| The little things | The ten color schemes (click to recolor the window), unedited screenshots, 27 languages, the tray title and menu, the completion notification, no telemetry, the real `constants.ts` |
| Download | OS detection, the latest stable release, the architecture picker and every package |

All interface mock-ups are rebuilt in HTML from the apps' components and show
the apps' own labels in every language (see `tools/sync-ui-strings.py`).
Speeds and sizes are illustrative.

## Motion rules

- Nothing is tied to the scroll position. A scene starts its own clock when it
  comes into view, pauses when it leaves, and draws its final frame when it
  ends, so fast or slow scrolling never makes it stutter (`assets/js/core/stage.js`).
- Reveals are one-shot, fixed-length transitions. Elements already above the
  viewport after a reload or anchor jump are shown at once.
- Text rises with `cubic-bezier(0.33, 1, 0.68, 1)`; interface elements use
  Rayburst's Material 3 curves.
- Scenes tilt only while moving and land flat before anything has to be read.
- With reduced motion, every scene shows a representative still frame.

## Layout

```
index.html               page, icon sprite (generated), English fallback text
404.html
assets/css/style.css     tokens, sections and the window rebuild
assets/js/
  main.js                boot: pickers, navigation, dialogs, sections
  i18n.js                locale detection and loading, RTL
  core/                  motion curves, the stage clock and reveals
  ui/                    window and card rebuild, task model, formatting
  sections/              one module per section
assets/data/schemes.json the ten color schemes, light and dark
assets/fonts/            Inter, JetBrains Mono (digits and Latin subset)
assets/img/              logos and the unedited screenshots
locales/*.json           27 languages
tools/                   maintenance scripts (not needed at runtime)
```

## Maintenance

| Task | Command |
| --- | --- |
| Check keys, fallbacks, icons, local-only assets and size budget | `node tools/check.mjs` |
| Run every scene for 40 s in a fake DOM and fail on any error | `npm i --no-save linkedom && node tools/smoke.mjs zh-CN` |
| Refresh interface strings from the apps' locales | `python3 tools/sync-ui-strings.py` (`--check` to verify) |
| Rebuild the icon sprite after using a new Ionicons name | `python3 tools/build-icons.py` |
| Regenerate the color schemes | `npm i --no-save @material/material-color-utilities@0.4.0 && node tools/build-schemes.mjs` |

`sync-ui-strings.py` finds the Rayburst and Rayburst Connect repositories
through `$RAYBURST_LAB`, `../rayburst-lab`, or `../..` when the site lives in
`rayburst/website`.

New copy must exist in all 27 locale files; `check.mjs` fails otherwise.
Headlines and slogans carry no terminal punctuation.

## The film (optional)

The hero shows a "Watch the film" button only when
`assets/video/rayburst-film.mp4` is deployed. Cloudflare Pages accepts files up
to 25 MiB, so encode a web copy from the master render:

```bash
ffmpeg -i rayburst-4k.mp4 -vf "scale=1920:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p \
  -maxrate 2600k -bufsize 5200k -movflags +faststart \
  -c:a aac -b:a 160k assets/video/rayburst-film.mp4
ffmpeg -ss 10 -i rayburst-4k.mp4 -frames:v 1 -vf "scale=1920:-2" -q:v 3 assets/video/rayburst-film.jpg
```

The video loads only when the visitor presses the button.

## Deployment

Replace the contents of `rayburst/website` with this folder. Cloudflare Pages
settings stay the same (root `website`, output `.`, no build). The page loads
only local files; the one network request is the public GitHub API for stars,
downloads and release assets, as described in `docs/PRIVACY.md`.
