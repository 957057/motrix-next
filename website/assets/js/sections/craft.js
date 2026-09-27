/**
 * The little things: small live demos, each built from the product's own
 * data: the ten color schemes (palettes generated like colorScheme.ts), the
 * unedited screenshots, "Download" in the 27 shipped languages, the tray
 * title and menu (stat.rs, tray.rs), the completion notification and the
 * real constants.ts.
 */
import { t } from '../i18n.js'
import { noise } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { AppWindow } from '../ui/appwindow.js'
import { esc, fmt, h, ic, setClass, setText } from '../ui/dom.js'
import { compactSpeed, MB } from '../ui/format.js'
import { KINDS, scenario } from '../ui/tasks.js'

/** "Download" in the 27 locales Rayburst ships (their hero.download). */
const WORDS = [
  ['en-US', 'Download'],
  ['zh-CN', '下载'],
  ['ja', 'ダウンロード'],
  ['de', 'Herunterladen'],
  ['ar', 'تنزيل'],
  ['fr', 'Télécharger'],
  ['ko', '다운로드'],
  ['es', 'Descargar'],
  ['hi', 'डाउनलोड'],
  ['ru', 'Скачать'],
  ['pt-BR', 'Baixar'],
  ['th', 'ดาวน์โหลด'],
  ['it', 'Scarica'],
  ['zh-TW', '下載'],
  ['tr', 'İndir'],
  ['el', 'Λήψη'],
  ['vi', 'Tải xuống'],
  ['pl', 'Pobierz'],
  ['fa', 'دانلود'],
  ['uk', 'Завантажити'],
  ['nl', 'Downloaden'],
  ['id', 'Unduh'],
  ['hu', 'Letöltés'],
  ['ro', 'Descarcă'],
  ['bg', 'Изтегляне'],
  ['nb', 'Last ned'],
  ['ca', 'Descarregar'],
]

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

async function initSchemes() {
  const demo = document.getElementById('scheme-demo')
  const swatches = document.getElementById('swatches')
  const res = await fetch(new URL('assets/data/schemes.json', document.baseURI))
  const schemes = await res.json()
  const win = new AppWindow(demo, { tr: t, rows: 2 })
  const model = scenario([KINDS.bt(-30, 0.1, 12, 0), KINDS.sftp(-10, 0.5)], { newestFirst: true })

  swatches.innerHTML = schemes
    .map(
      (s, i) =>
        `<button class="swatch" type="button" role="radio" aria-checked="${i === 0}" data-i="${i}" style="--s: ${s.seed}"><i></i><span data-k="scheme.${s.id}"></span></button>`,
    )
    .join('')
  const buttons = [...swatches.children]
  let current = 0
  let manual = false
  const apply = (i) => {
    current = i
    const dark = document.documentElement.dataset.theme !== 'light'
    const vars = schemeVars(schemes[i][dark ? 'dark' : 'light'], dark)
    for (const [k, v] of Object.entries(vars)) demo.style.setProperty(k, v)
    buttons.forEach((b, j) => {
      setClass(b, 'is-on', j === i)
      b.setAttribute('aria-checked', String(j === i))
    })
  }
  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      manual = true
      apply(i)
    }),
  )
  new MutationObserver(() => apply(current)).observe(document.documentElement, { attributeFilter: ['data-theme'] })
  apply(0)
  const translate = () => {
    buttons.forEach((b) => setText(b.querySelector('span'), t(b.querySelector('span').dataset.k)))
    win.translate()
  }
  translate()
  let step = 0
  new Stage(demo, {
    still: 10,
    render: (time) => {
      win.update(model(time, t))
      // Cycle the schemes until the visitor picks one.
      const next = Math.floor(time / 2.4) % schemes.length
      if (!manual && next !== step) {
        step = next
        apply(next)
      }
    },
  })
  return translate
}

function initShots() {
  const box = document.getElementById('shots')
  const imgs = [...box.querySelectorAll('img')]
  const buttons = [...document.querySelectorAll('#shot-toggle button')]
  let manual = false
  let shown = 0
  const show = (i) => {
    shown = i
    imgs.forEach((img, j) => setClass(img, 'is-off', j !== i))
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
  }
  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      manual = true
      show(i)
    }),
  )
  box.addEventListener('click', () => window.openLightbox?.(imgs[shown]))
  new Stage(box, {
    still: 0,
    render: (time) => {
      const i = Math.floor(time / 3.6) % 2
      if (!manual && i !== shown) show(i)
    },
  })
}

function initLangs() {
  const box = document.getElementById('langs')
  const code = h('<span class="langs-code"></span>')
  box.append(code)
  let shown = -1
  let current = null
  new Stage(box, {
    still: 0,
    render: (time) => {
      const i = Math.floor(time / 1.5) % WORDS.length
      if (i === shown) return
      shown = i
      const [lang, word] = WORDS[i]
      current?.classList.replace('is-in', 'is-out')
      const old = current
      old?.addEventListener('animationend', () => old.remove(), { once: true })
      current = h(`<span class="langs-word is-in" lang="${lang}" dir="${lang === 'ar' || lang === 'fa' ? 'rtl' : 'ltr'}">${esc(word)}</span>`)
      box.prepend(current)
      setText(code, lang)
    },
  })
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

function initNotify() {
  const box = document.getElementById('notify')
  box.innerHTML = `
    <div class="notify-card">
      <img src="assets/img/logo.svg" alt="" width="36" height="36" />
      <div><b data-k="native.doneTitle"></b><span data-v="body"></span></div>
    </div>`
  const card = box.querySelector('.notify-card')
  const titleEl = card.querySelector('b')
  const bodyEl = card.querySelector('[data-v="body"]')
  const translate = () => {
    setText(titleEl, t('native.doneTitle'))
    setText(bodyEl, fmt(t('native.doneBody'), { name: 'blender-4.5.3-linux-x64.tar.xz' }))
  }
  translate()
  let state = ''
  new Stage(box, {
    still: 2,
    loop: 6,
    render: (time) => {
      const next = time > 0.4 && time < 4.8 ? 'is-in' : time >= 4.8 ? 'is-out' : ''
      if (next === state) return
      card.classList.remove('is-in', 'is-out')
      if (next) card.classList.add(next)
      state = next
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
  initSchemes().then((fn) => translators.push(fn))
  initShots()
  initLangs()
  translators.push(initTray(), initNotify())
  initCode()
  // Spotlight that follows the pointer on each tile.
  document.querySelectorAll('.tile').forEach((tile) =>
    tile.addEventListener('pointermove', (e) => {
      const r = tile.getBoundingClientRect()
      tile.style.setProperty('--mx', `${e.clientX - r.left}px`)
      tile.style.setProperty('--my', `${e.clientY - r.top}px`)
    }),
  )
  return { translate: () => translators.forEach((fn) => fn()) }
}
