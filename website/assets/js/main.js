/**
 * Rayburst website entry: language and theme pickers, navigation, dialogs,
 * and the scenes. No dependencies; modern browser APIs only.
 */
import { apply as applyI18n, LOCALES, locale, onChange, ready, setLocale, systemLocale, t } from './i18n.js'
import { initReveals } from './core/stage.js'
import { initConnect } from './sections/connect.js'
import { initCraft } from './sections/craft.js'
import { initDetails } from './sections/details.js'
import { initDownload } from './sections/download.js'
import { initEngine } from './sections/engine.js'
import { initHero } from './sections/hero.js'
import { initProtocols } from './sections/protocols.js'

const THEME_KEY = 'rayburst-website-theme'
const THEME_COLOR = { dark: '#0b0910', light: '#fbf8fd' }

/* ─── Pickers ─────────────────────────────────────────────────────────── */
function picker(root) {
  const toggle = root.querySelector('.picker-toggle')
  const close = () => {
    root.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
  }
  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = !root.classList.contains('is-open')
    document.querySelectorAll('.picker.is-open').forEach((p) => p.classList.remove('is-open'))
    root.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
  })
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  return close
}

function initLanguagePicker() {
  const root = document.getElementById('lang-picker')
  const menu = document.getElementById('lang-menu')
  const label = document.getElementById('lang-label')
  const close = picker(root)
  const sys = systemLocale()
  menu.innerHTML =
    `<button class="picker-option" type="button" data-lang="${sys}" data-system><span></span></button><div class="picker-sep"></div>` +
    Object.entries(LOCALES)
      .map(([code, name]) => `<button class="picker-option" type="button" data-lang="${code}" lang="${code}">${name}</button>`)
      .join('')
  const refresh = () => {
    label.textContent = LOCALES[locale()]
    menu.querySelector('[data-system] span').textContent = `${t('theme.system')} · ${LOCALES[sys]}`
    menu.querySelectorAll('[data-lang]:not([data-system])').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === locale()))
  }
  refresh()
  onChange(refresh)
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]')
    if (!b) return
    close()
    setLocale(b.dataset.lang)
  })
}

function initThemePicker() {
  const root = document.getElementById('theme-picker')
  const icon = document.getElementById('theme-icon')
  const meta = document.querySelector('meta[name="theme-color"]')
  const close = picker(root)
  const system = () => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  const stored = () => {
    try {
      const v = localStorage.getItem(THEME_KEY)
      return v === 'light' || v === 'dark' ? v : 'system'
    } catch {
      return 'system'
    }
  }
  const apply = (choice) => {
    const effective = choice === 'system' ? system() : choice
    document.documentElement.dataset.theme = effective
    meta.content = THEME_COLOR[effective]
    icon.setAttribute('href', effective === 'light' ? '#i-sunny-outline' : '#i-moon-outline')
    root.querySelectorAll('[data-theme]').forEach((o) => o.classList.toggle('is-active', o.dataset.theme === choice))
    try {
      if (choice === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, choice)
    } catch {
      // The theme still applies for this visit.
    }
  }
  apply(stored())
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => stored() === 'system' && apply('system'))
  root.querySelectorAll('[data-theme]').forEach((opt) =>
    opt.addEventListener('click', async () => {
      close()
      const choice = opt.dataset.theme
      const toggle = root.querySelector('.picker-toggle').getBoundingClientRect()
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply(choice)
      // Circular reveal from the toggle.
      const x = toggle.left + toggle.width / 2
      const y = toggle.top + toggle.height / 2
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      const vt = document.startViewTransition(() => apply(choice))
      await vt.ready
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.2, 0, 0, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    }),
  )
}

/* ─── Navigation: solid once the page leaves the top ──────────────────── */
function initNav() {
  const nav = document.getElementById('nav')
  const sentinel = document.createElement('div')
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none'
  document.body.prepend(sentinel)
  new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting)).observe(sentinel)
}

/* ─── Dialogs ─────────────────────────────────────────────────────────── */
function initDialogs() {
  const lightbox = document.getElementById('lightbox')
  const film = document.getElementById('film')
  const video = document.getElementById('film-video')
  for (const d of [lightbox, film]) {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close()
    })
  }
  window.openLightbox = (img) => {
    const target = document.getElementById('lightbox-img')
    target.src = img.currentSrc || img.src
    target.alt = img.alt
    lightbox.showModal()
  }
  film.addEventListener('close', () => video.pause())

  // The film button appears only when a web encode of the film is deployed.
  const src = new URL('assets/video/rayburst-film.mp4', document.baseURI)
  const button = document.getElementById('film-open')
  if (location.protocol.startsWith('http')) {
    fetch(src, { method: 'HEAD' })
      .then((res) => {
        if (res.ok && (res.headers.get('content-type') ?? '').startsWith('video')) button.hidden = false
      })
      .catch(() => {})
  }
  button.addEventListener('click', () => {
    if (!video.src) video.src = src.href
    film.showModal()
    video.play().catch(() => {})
  })
}

/* ─── Boot ────────────────────────────────────────────────────────────── */
initThemePicker()
initNav()
initDialogs()

await ready
applyI18n()
initLanguagePicker()
initDownload()
const hero = initHero()
const scenes = [hero, initProtocols(), initDetails(), initConnect(), initCraft()]
initEngine()
initReveals()
onChange(() => scenes.forEach((s) => s?.translate?.()))

// Start the hero once the text has its font, so the letters rise in their final shapes.
await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 700))])
requestAnimationFrame(() => hero.start())
