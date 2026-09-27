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
| Hero | The first screen: the logo traces itself and fills in, the name and slogan rise; Sponsor (rose), Download and GitHub, then the film card (a moving thumbnail) on its own row |
| Overview | A centred heading, then a first look at the whole window (sidebar, task cards, toolbar, speedometer). A short tour on the left lights each part up in turn, or on hover |
| Protocols | Six protocol families light up in turn; each link types out and a ribbon carries it into the window, where the task lands |
| Details | Three 6-second tabs: 48 connection ranges that always add up to the card's progress, the Task Details piece map, live recording with streaming segments |
| Rayburst Connect | Chrome, Edge and Firefox store buttons (the visitor's browser is filled in), then the popup's real flow: sniff, Media options, MKV, Download, confirmation, hand-off to Rayburst |
| Aria2 Next | A black-and-gold band: data lanes converge on a terminal typing the engine's quick-start commands; a gold download button for the visitor's system with every build in a menu, and a Docker command that copies itself |
| Make it yours | A studio around one live window: light or dark, ten color schemes and all 27 languages, applied as they are picked (a slow tour runs until the first pick). Below: the tray title and menu, file selection (torrent and magnet files, stream tracks), the real `constants.ts`, and six more features |
| Download | A slow burst of light, one button for the visitor's system with an architecture switch, a card per platform with every package, then the family: Connect, Aria2 Next and Sponsor |

All interface mock-ups are rebuilt in HTML from the apps' components and show
the apps' own labels in every language (see `tools/sync-ui-strings.py`).
Speeds and sizes are illustrative.

## Motion rules

- Nothing is tied to the scroll position. A scene starts its own clock when it
  comes into view, pauses when it leaves, and draws its final frame when it
  ends, so fast or slow scrolling never makes it stutter (`assets/js/core/stage.js`).
- Reveals are one-shot, fixed-length transitions. Elements already above the
  viewport after a reload or anchor jump are shown at once.
- Anchor links glide; the download button glows once when the page arrives.
- Everything that opens also closes with motion: the migration note, menus,
  dialogs (the screenshot flies back into its tile). Switching language
  cross-fades the page; switching theme reveals it in a circle.
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
assets/img/              logos
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
Headlines and slogans carry no terminal punctuation. The three slogans are the
repositories' GitHub descriptions and stay word for word:

- Rayburst: Redefining the open-source download manager
- Rayburst Connect: Redefining the companion browser extension
- Aria2 Next: Redefining the next generation of aria2

## The film (optional)

The hero always shows a "Watch the film" link under the buttons; it reads "1:06 · EN" in other
languages because the film is captioned in English. The player opens on a
branded poster (the hero's light, the mark and the name) that fades once the
first frame plays, and says the film is on its way while
`assets/video/rayburst-film.mp4` is not deployed. Cloudflare Pages serves files up to 25 MiB, so the 4K60
master (about 3 GB) needs a web copy. At 1080p60, a two-pass 2.8 Mbit/s encode
of the 66-second film comes to about 23 MiB:

```bash
mkdir -p assets/video
ffmpeg -y -i rayburst-4k.mp4 -vf "scale=1920:-2:flags=lanczos" -r 60 \
  -c:v libx264 -preset slow -b:v 2800k -pass 1 -an -f mp4 /dev/null      # NUL on Windows
ffmpeg -i rayburst-4k.mp4 -vf "scale=1920:-2:flags=lanczos" -r 60 \
  -c:v libx264 -preset slow -b:v 2800k -maxrate 4200k -bufsize 5600k -pass 2 \
  -profile:v high -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k assets/video/rayburst-film.mp4
```

`node tools/check.mjs` fails if the file exceeds 25 MiB. The video loads only
when the visitor presses the link. To show the 4K master instead, host it
somewhere without the size limit (for example Cloudflare R2) and point the
`src` in `assets/js/main.js` at it.

## Deployment

Replace the contents of `rayburst/website` with this folder. Cloudflare Pages
settings stay the same (root `website`, output `.`, no build). The page loads
only local files; the one network request is the public GitHub API for stars,
downloads and release assets, as described in `docs/PRIVACY.md`.
