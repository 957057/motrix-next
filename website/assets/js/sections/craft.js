/**
 * Make it yours: a studio around one live Rayburst window. The visitor picks
 * light or dark, one of the ten color schemes (palettes generated like
 * colorScheme.ts) and any of the 27 languages the app ships, and the window
 * follows at once. Until the first pick, a slow tour changes one thing at a
 * time. Below it: the tray title and menu (stat.rs, tray.rs), torrent file
 * selection (BtSelectionDialog) and the real constants.ts.
 */
import { LOCALES, locale, onChange, preload, t } from '../i18n.js'
import { noise, reducedMotion } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { AppWindow } from '../ui/appwindow.js'
import { esc, fmt, ic, setClass, setText } from '../ui/dom.js'
import { bytes, compactSpeed, MB } from '../ui/format.js'
import { KINDS, scenario } from '../ui/tasks.js'
import { toastsFor } from './shared.js'

/** rayburst/src/shared/constants.ts, lines 64–77, verbatim. */
const CODE_FIRST = 64
const CODE = [
  'export const ENGINE_RPC_PORT = 29100',
  'export const EXTENSION_API_PORT = 29110',
  'export const BT_LISTEN_PORT = 29120',
  'export const ED2K_LISTEN_PORT = 29140',
  'export const ED2K_UDP_LISTEN_PORT = 29150',
  "export const ED2K_SERVER_MET_URL = 'https://upd.emule-security.org/server.met'",
  "export const ED2K_NODES_DAT_URL = 'https://upd.emule-security.org/nodes.dat'",
  "export const BT_PEER_BLOCKLIST_URL = 'https://bcr.pbh-btn.com/combine/all.txt'",
  'export const PORT_RECOVERY_RANGE_START = 29000',
  'export const PORT_RECOVERY_RANGE_END = 29999',
  'export const ENGINE_DEFAULT_STREAM_CONNECTIONS = 64',
  'export const ENGINE_DEFAULT_BT_MAX_PEERS = 128',
  "export const ENGINE_DEFAULT_BT_USER_AGENT = 'qBittorrent/5.2.3'",
  "export const ENGINE_DEFAULT_BT_PEER_ID_PREFIX = '-qB5230-'",
]
const CODE_HOT = 74

function highlight(line) {
  return esc(line)
    .replace(/^export const /, '<span class="kw">export const </span>')
    .replace(/(&#39;.*&#39;)/, '<span class="st">$1</span>')
    .replace(/= (\d+)$/, '= <span class="nu">$1</span>')
}

/** Map generated tokens onto the window's roles (sidebar, list, cards). */
function schemeVars(tok, dark) {
  const v = {
    '--w-text': tok.text,
    '--w-dim': tok.textDim,
    '--w-outline': tok.outline,
    '--w-ov': tok.outlineVariant,
    '--w-primary': tok.primary,
    '--w-on-primary': tok.onPrimary,
    '--w-info': tok.info,
    '--w-success': tok.success,
    '--w-highest': tok.highest,
    '--w-high': tok.high,
  }
  if (dark) Object.assign(v, { '--w-side': tok.low, '--w-main': tok.high, '--w-item': tok.container })
  else Object.assign(v, { '--w-side': tok.container, '--w-main': tok.low, '--w-item': tok.lowest })
  return v
}

/** Languages the tour visits, one per step, before it returns to the page's own. */
const TOUR = ['ja', 'de', 'ar', 'fr', 'ko', 'es', 'ru', 'hi', 'zh-CN', 'pt-BR', 'th', 'it']
const STEP = 2.6

async function initStudio() {
  const studio = document.getElementById('studio')
  const host = document.getElementById('studio-app')
  const swatches = document.getElementById('swatches')
  const schemeName = document.getElementById('studio-scheme')
  const langName = document.getElementById('studio-lang')
  const langBox = document.getElementById('studio-langs')
  const lookSeg = document.getElementById('studio-look')
  const schemes = await (await fetch(new URL('assets/data/schemes.json', document.baseURI))).json()

  const state = {
    look: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    scheme: 0,
    lang: locale(),
    dict: null,
    manual: false,
  }
  const tr = (key, vars) => fmt(state.dict?.[key] ?? t(key), vars ?? {})
  // The full window with its sidebar, so a scheme recolors every surface.
  const win = new AppWindow(host, { tr, height: 620, rows: 4, wideFrom: 620 })
  const model = scenario(
    [KINDS.live(-50, 3120), KINDS.sftp(-30, 0.62), KINDS.bt(-4, 0.3, 30, 0.8), KINDS.http(0, 0.2), KINDS.media(0, 0.44, (x) => `${x('connect.pageTitle')}.mkv`)],
    { newestFirst: true },
  )

  swatches.innerHTML = schemes
    .map((s, i) => `<button class="swatch" type="button" role="radio" data-i="${i}" style="--s: ${s.seed}" title=""><i></i></button>`)
    .join('')
  const swatchEls = [...swatches.children]
  langBox.innerHTML = Object.entries(LOCALES)
    .map(([code, name]) => `<button class="lang-chip" type="button" role="radio" data-lang="${code}" lang="${code}">${esc(name)}</button>`)
    .join('')
  const chips = [...langBox.children]
  const looks = [...lookSeg.querySelectorAll('[data-look]')]

  const paintScheme = () => {
    const dark = state.look === 'dark'
    const vars = schemeVars(schemes[state.scheme][dark ? 'dark' : 'light'], dark)
    for (const [k, v] of Object.entries(vars)) host.style.setProperty(k, v)
    host.dataset.look = state.look
    swatchEls.forEach((b, j) => {
      setClass(b, 'is-on', j === state.scheme)
      b.setAttribute('aria-checked', String(j === state.scheme))
    })
    lookSeg.style.setProperty('--at', state.look === 'light' ? 0 : 1)
    looks.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.look === state.look)))
  }
  const paintLabels = () => {
    setText(schemeName, t(`scheme.${schemes[state.scheme].id}`))
    swatchEls.forEach((b, j) => b.setAttribute('title', t(`scheme.${schemes[j].id}`)))
    setText(langName, LOCALES[state.lang])
  }
  const setLang = async (code) => {
    const dict = await preload(code)
    state.lang = code
    state.dict = dict
    chips.forEach((c) => {
      setClass(c, 'is-on', c.dataset.lang === code)
      c.setAttribute('aria-checked', String(c.dataset.lang === code))
    })
    win.translate()
    paintLabels()
    // The window's labels change language in place; a short fade marks the switch.
    if (!reducedMotion()) host.animate([{ opacity: 0.55, filter: 'blur(2px)' }, { opacity: 1, filter: 'none' }], { duration: 380, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
  }

  const pick = () => {
    state.manual = true
    studio.classList.add('is-manual')
  }
  swatches.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]')
    if (!b) return
    pick()
    state.scheme = Number(b.dataset.i)
    paintScheme()
    paintLabels()
  })
  lookSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]')
    if (!b) return
    pick()
    state.look = b.dataset.look
    paintScheme()
  })
  langBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]')
    if (!b) return
    pick()
    setLang(b.dataset.lang)
  })
  // Until the visitor picks something, the window follows the page's theme and language.
  new MutationObserver(() => {
    if (state.manual) return
    state.look = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    paintScheme()
  }).observe(document.documentElement, { attributeFilter: ['data-theme'] })
  onChange(() => {
    paintLabels()
    if (!state.manual) setLang(locale())
  })

  paintScheme()
  await setLang(state.lang)

  let step = -1
  new Stage(studio, {
    still: 8,
    render: (time) => {
      const m = model(time, tr)
      win.update(m)
      win.toasts(toastsFor(m, time, tr))
      if (state.manual || reducedMotion()) return
      // The tour: every step changes one thing (scheme, language, then appearance).
      const k = Math.floor(time / STEP)
      if (k === step || k === 0) return
      step = k
      const phase = k % 4
      if (phase === 1 || phase === 3) {
        state.scheme = (state.scheme + 1) % schemes.length
        paintScheme()
        paintLabels()
      } else if (phase === 2) {
        setLang(TOUR[Math.floor(k / 4) % TOUR.length])
      } else {
        state.look = state.look === 'dark' ? 'light' : 'dark'
        paintScheme()
      }
    },
  })
  return () => paintLabels()
}

function initTray() {
  const box = document.getElementById('menubar')
  box.innerHTML = `
    <div class="menubar-strip">
      <span class="tray-item"><img src="assets/img/logo.svg" alt="" width="15" height="15" /><em class="mono"></em></span>
      ${ic('search-outline')}
      <span class="mono" data-clock></span>
    </div>
    <div class="tray-menu">
      <div data-k="tray.show"></div><hr />
      <div data-k="tray.new"></div><div data-k="tray.resume"></div><div data-k="tray.pause"></div><hr />
      <div data-k="tray.quit"></div>
    </div>
    <div class="tray-note"><span>Tauri 2</span><span>Rust</span></div>`
  const item = box.querySelector('.tray-item')
  const title = item.querySelector('em')
  const menu = box.querySelector('.tray-menu')
  const entries = [...menu.querySelectorAll('div')]
  const clock = box.querySelector('[data-clock]')
  const translate = () => entries.forEach((el) => setText(el, t(el.dataset.k)))
  translate()
  const LOOP = 8
  new Stage(box, {
    still: 3.4,
    loop: LOOP,
    render: (time) => {
      const bps = (37.8 + 6 * noise(time * 0.7, 3)) * MB
      setText(title, compactSpeed(bps))
      setText(clock, '9:41')
      const open = time > 2.2 && time < 6.4
      setClass(menu, 'is-open', open)
      setClass(item, 'is-on', open)
      const hot = open && time > 2.9 ? Math.min(3, Math.floor((time - 2.9) / 0.6)) : -1
      entries.forEach((el, i) => setClass(el, 'is-hot', i === hot))
    },
  })
  return translate
}

/** Torrent file selection (BtSelectionDialog, BtFileSelector): untick what you don't need, then start. */
const FILES = [
  ['bbb_sunflower_2160p_60fps_normal.mp4', 642 * MB],
  ['bbb_sunflower_1080p_60fps_normal.mp4', 355.9 * MB],
  ['subtitles/en.srt', 42 * 1024],
  ['extras/making-of.mkv', 1.1 * 1024 * MB],
]
/** When each file is unticked during the loop (null: stays selected). */
const UNTICK = [null, 1.3, null, 2.1]
const PICK_LOOP = 7

function initPick() {
  const box = document.getElementById('pick')
  box.classList.add('rbw')
  box.innerHTML = `
    <div class="pick-win">
      <div class="pick-head"><b data-k="ui.selectFiles"></b>${ic('close-outline')}</div>
      <div class="pick-name">Big Buck Bunny 4K</div>
      <div class="pick-table">
        <div class="pick-row pick-th"><i class="pick-box">${ic('checkmark-outline')}</i><span data-k="ui.fileNo"></span><span data-k="ui.fileName"></span><span data-k="ui.fileSize"></span></div>
        ${FILES.map(
          ([name, size], i) =>
            `<div class="pick-row" data-i="${i}"><i class="pick-box">${ic('checkmark-outline')}</i><span>${i + 1}</span><span class="pick-file">${esc(name)}</span><span>${bytes(size)}</span></div>`,
        ).join('')}
      </div>
      <div class="pick-foot">
        <span class="pick-sum"><b class="mono" data-v="count"></b><em>—</em><b class="mono" data-v="size"></b></span>
        <span class="pick-btns"><i data-k="ui.chooseLater"></i><i class="is-primary" data-k="ui.startDownload"></i></span>
      </div>
    </div>`
  const rows = [...box.querySelectorAll('.pick-row[data-i]')]
  const all = box.querySelector('.pick-th')
  const count = box.querySelector('[data-v="count"]')
  const size = box.querySelector('[data-v="size"]')
  const start = box.querySelector('.is-primary')
  const labels = [...box.querySelectorAll('[data-k]')]
  const translate = () => labels.forEach((el) => setText(el, t(el.dataset.k)))
  translate()
  new Stage(box, {
    still: 3,
    loop: PICK_LOOP,
    render: (time) => {
      let n = 0
      let bytesOn = 0
      rows.forEach((row, i) => {
        const on = UNTICK[i] == null || time < UNTICK[i]
        setClass(row, 'is-off', !on)
        setClass(row, 'is-hot', UNTICK[i] != null && time > UNTICK[i] - 0.35 && time < UNTICK[i] + 0.25)
        if (on) {
          n++
          bytesOn += FILES[i][1]
        }
      })
      setClass(all, 'is-some', n < FILES.length)
      setText(count, `${n}/${FILES.length}`)
      setText(size, bytes(bytesOn))
      setClass(start, 'is-press', time > 3.1 && time < 3.4)
      setClass(box, 'is-sent', time > 3.4 && time < PICK_LOOP - 0.4)
    },
  })
  return translate
}

function initCode() {
  const box = document.getElementById('code')
  box.innerHTML = `
    <div class="code-bar">${ic('code-slash-outline')}src/shared/constants.ts</div>
    <pre>${CODE.map((line, i) => {
      const n = CODE_FIRST + i
      return `<span data-n="${n}"${n === CODE_HOT ? ' class="is-hot"' : ''}>${highlight(line)}</span>`
    }).join('')}</pre>`
  // Keep the highlighted line in view on short tiles.
  const pre = box.querySelector('pre')
  const hot = box.querySelector('.is-hot')
  new ResizeObserver(() => {
    const room = pre.clientHeight
    pre.scrollTop = Math.max(0, hot.offsetTop - room * 0.55)
  }).observe(pre)
}

export function initCraft() {
  const translators = []
  initStudio().then((fn) => translators.push(fn))
  translators.push(initTray(), initPick())
  initCode()
  return { translate: () => translators.forEach((fn) => fn()) }
}
