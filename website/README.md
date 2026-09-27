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
| Hero | The first screen: the logo traces itself and fills in, the name and slogan rise; Sponsor (rose), Download and GitHub, then the film card (a local cover) on its own row |
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
- The film uses native dialog dismissal and releases its player on close.
  The migration note and menus animate. Switching language
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

## The film

The English film opens in a native dialog using YouTube's privacy-enhanced
player. The cover is local; no YouTube resources load until the visitor opens
it. Closing the dialog removes the player and stops playback. Without
JavaScript, the film link opens YouTube directly.

The watch URL in `index.html` is the source for the video ID and external link.
YouTube handles playback quality and controls. Network access to YouTube is
required. The player preserves the HTTP Referer with
`strict-origin-when-cross-origin`; do not suppress it in deployment headers.

## Deployment

Replace the contents of `rayburst/website` with this folder. Cloudflare Pages
settings stay the same (root `website`, output `.`, no build). The page loads local assets and requests GitHub release metadata and statistics.
Opening the film connects to YouTube, as described in `docs/PRIVACY.md`.
