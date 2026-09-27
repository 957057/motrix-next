import { initFilm } from './ui/film.js'
/**
 * Rayburst website entry: language and theme pickers, navigation, dialogs,
 * and the scenes. No dependencies; modern browser APIs only.
 */
import { apply as applyI18n, LOCALES, locale, onChange, preload, ready, setLocale, systemLocale, t } from './i18n.js'
import { reducedMotion } from './core/motion.js'
import { initReveals } from './core/stage.js'
import { initConnect } from './sections/connect.js'
import { initCraft } from './sections/craft.js'
import { initDetails } from './sections/details.js'
import { initDownload } from './sections/download.js'
import { initEngine } from './sections/engine.js'
import { initFamily } from './sections/family.js'
import { initHero } from './sections/hero.js'
import { initProtocols } from './sections/protocols.js'
import { picker } from './ui/picker.js'

const THEME_KEY = 'rayburst-website-theme'
const THEME_COLOR = { dark: '#0b0910', light: '#fbf8fd' }

/* ─── Pickers ─────────────────────────────────────────────────────────── */
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
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lang]')
    if (!b) return
    close()
    const code = b.dataset.lang
    if (code === locale()) return
    if (!document.startViewTransition || reducedMotion()) return setLocale(code)
    // Fetch first, then cross-fade the whole page into the new language.
    await preload(code)
    const root = document.documentElement
    root.classList.add('vt-fade')
    const vt = document.startViewTransition(() => setLocale(code))
    vt.finished.finally(() => root.classList.remove('vt-fade'))
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
      if (!document.startViewTransition || reducedMotion()) return apply(choice)
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

/* ─── Migration note: height and text glide open and closed ───────────── */
function initMigrate() {
  const box = document.querySelector('.migrate')
  const summary = box.querySelector('summary')
  const body = box.querySelector('.migrate-body')
  let anim = null
  let fade = null
  summary.addEventListener('click', (e) => {
    if (reducedMotion()) return
    e.preventDefault()
    const opening = !box.open || box.classList.contains('is-closing')
    const from = box.getBoundingClientRect()
    anim?.cancel()
    fade?.cancel()
    // Measure both end states (no paint happens in between).
    box.classList.remove('is-closing')
    box.open = false
    const closed = box.getBoundingClientRect()
    box.open = true
    const full = box.getBoundingClientRect()
    box.classList.toggle('is-closing', !opening)
    const to = opening ? full : closed
    // Width and height move together, and the text keeps its open width so it never reflows.
    body.style.width = `${body.getBoundingClientRect().width}px`
    box.style.overflow = 'hidden'
    anim = box.animate(
      [
        { width: `${from.width}px`, height: `${from.height}px` },
        { width: `${to.width}px`, height: `${to.height}px` },
      ],
      {
        duration: opening ? 520 : 380,
        easing: opening ? 'cubic-bezier(0.2, 0, 0, 1)' : 'cubic-bezier(0.3, 0, 0.2, 1)',
      },
    )
    fade = body.animate(
      opening
        ? [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: opening ? 380 : 200, delay: opening ? 80 : 0, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: opening ? 'backwards' : 'forwards' },
    )
    anim.onfinish = () => {
      box.style.overflow = ''
      body.style.width = ''
      fade?.cancel()
      fade = null
      if (!opening) {
        box.open = false
        box.classList.remove('is-closing')
      }
      anim = null
    }
  })
}

/* ─── Boot ────────────────────────────────────────────────────────────── */
initThemePicker()
initNav()
initMigrate()
initFilm()

await ready
applyI18n()
initLanguagePicker()
initDownload()
initFamily()
const hero = initHero()
const scenes = [hero, initProtocols(), initDetails(), initConnect(), initCraft()]
initEngine()
initReveals()
onChange(() => scenes.forEach((s) => s?.translate?.()))

// Start the hero once the text has its font, so the letters rise in their final shapes.
await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 700))])
requestAnimationFrame(() => hero.start())
