/**
 * DOM smoke test: loads index.html in linkedom with stubbed browser APIs,
 * boots the page in a language, drives every scene's clock for 40 simulated
 * seconds, switches to Arabic and to the light theme, and fails on any
 * exception or non-finite canvas value. It does not check layout.
 *
 *   npm i --no-save linkedom
 *   node tools/smoke.mjs [locale]          # REDUCED=1 for reduced motion
 */
import { readFileSync, existsSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const SITE = new URL('..', import.meta.url).pathname
const LANG = process.argv[2] || 'zh-CN'
const errors = []
const record = (where, e) => errors.push(`${where}: ${e?.stack?.split('\n').slice(0, 3).join(' | ') ?? e}`)
process.on('uncaughtException', (e) => record('uncaught', e))
process.on('unhandledRejection', (e) => record('rejection', e))
process.on('exit', () => { if (errors.length) console.log('errors at exit:\n' + errors.slice(0, 10).join('\n')) })

const { window, document } = parseHTML(readFileSync(SITE + 'index.html', 'utf8'))
let now = 0
const rafQ = []
const noop = () => {}
const g = globalThis
Object.assign(g, { window, document })
for (const k of ['HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'SVGElement', 'HTMLCanvasElement', 'DocumentFragment', 'MutationObserver']) {
  if (window[k] && !g[k]) g[k] = window[k]
}
Object.defineProperty(g, 'navigator', { value: { languages: [LANG], userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }, configurable: true })
g.location = new URL('http://localhost:8080/')
window.location = g.location
Object.defineProperty(document, 'baseURI', { value: 'http://localhost:8080/' })
g.localStorage = { getItem: () => null, setItem: noop, removeItem: noop }
g.matchMedia = (q) => ({ matches: process.env.REDUCED === '1' && q.includes('reduced'), addEventListener: noop })
g.devicePixelRatio = 2
g.innerWidth = 1440
g.innerHeight = 900
g.performance = { now: () => now }
g.requestAnimationFrame = (fn) => rafQ.push(fn)
window.requestAnimationFrame = g.requestAnimationFrame
g.getComputedStyle = () => ({ getPropertyValue: () => '#4a454e', color: 'rgb(74, 69, 78)' })
window.getComputedStyle = g.getComputedStyle
g.IntersectionObserver = class {
  constructor(cb) { this.cb = cb }
  observe(el) { queueMicrotask(() => this.cb([{ target: el, isIntersecting: true, boundingClientRect: { top: 100, bottom: 400 } }])) }
  unobserve() {}
  disconnect() {}
}
g.ResizeObserver = class {
  constructor(cb) { this.cb = cb }
  observe(el) { queueMicrotask(() => this.cb([{ target: el }])) }
  disconnect() {}
}
if (!g.MutationObserver) g.MutationObserver = class { observe() {} }
window.localeBoot = { finished: false, finish() { this.finished = true; document.documentElement.removeAttribute('data-locale-pending') } }
document.fonts = { ready: Promise.resolve() }
window.openLightbox = undefined

// Layout stubs
const P = window.HTMLElement.prototype
const box = function () {
  const w = this.__w ?? (this.classList?.contains('rbw') ? 1100 : 640)
  return { left: 40, top: 60, right: 40 + w, bottom: 460, width: w, height: 400, x: 40, y: 60 }
}
for (const proto of [window.HTMLElement.prototype, window.Element.prototype]) {
  proto.getBoundingClientRect = box
  for (const [k, v] of Object.entries({ clientWidth: 900, clientHeight: 400, offsetHeight: 680, offsetTop: 120, scrollTop: 0 })) {
    Object.defineProperty(proto, k, { get() { return v }, set() {}, configurable: true })
  }
  proto.animate = () => ({ finished: Promise.resolve() })
  proto.showModal = function () { this.open = true }
  proto.close = function () { this.open = false }
  proto.getTotalLength = () => 300
  proto.getPointAtLength = (l) => ({ x: l, y: l / 2 })
}
const ctx2d = new Proxy({}, {
  get(target, prop) {
    if (prop in target) return target[prop]
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop(o, c) { if (!(o >= 0 && o <= 1) || /NaN/.test(c)) record('gradient', new Error(`bad stop ${o} ${c}`)) } })
    return (...args) => { if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) record(`ctx.${String(prop)}`, new Error(`non-finite ${args}`)) }
  },
  set(target, prop, v) { if (typeof v === 'string' && /NaN|undefined/.test(v)) record(`ctx.${String(prop)}`, new Error(v)); target[prop] = v; return true },
})
window.HTMLCanvasElement.prototype.getContext = () => ctx2d

// fetch: local files; the network is unreachable
g.fetch = async (url, opts = {}) => {
  const u = new URL(String(url), 'http://localhost:8080/')
  if (u.host !== 'localhost:8080') throw new Error('offline')
  const p = SITE + u.pathname.slice(1)
  if (!existsSync(p) || opts.method === 'HEAD') return { ok: false, status: 404, headers: new Map() }
  const body = readFileSync(p, 'utf8')
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body, headers: new Map() }
}

const i18n = await import(SITE + 'assets/js/i18n.js')
const main = import(SITE + 'assets/js/main.js').catch((e) => record('main', e))
// Let boot finish (it awaits locale files and fonts).
for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 5))

async function frames(seconds) {
  const n = Math.round(seconds * 60)
  for (let i = 0; i < n; i++) {
    now += 1000 / 60
    const q = rafQ.splice(0)
    for (const fn of q) {
      try { fn(now) } catch (e) { record('frame', e) }
    }
    if (i % 30 === 0) await new Promise((r) => setTimeout(r, 0))
  }
}
await frames(20)
const hero = document.getElementById('hero')
const checks = {
  lang: document.documentElement.lang,
  heroLive: hero.classList.contains('is-live'),
  heroCards: document.querySelectorAll('#hero-app .rbw-card').length,
  protoLit: document.querySelectorAll('.proto.is-lit').length,
  protoCards: document.querySelectorAll('#proto-app .rbw-card').length,
  toastsSeen: document.querySelectorAll('.rbw-toast').length,
  connectCards: document.querySelectorAll('#connect-app .rbw-card').length,
  popupOpen: document.querySelector('.pp')?.classList.contains('is-open'),
  term: document.getElementById('term-body').textContent.split('\n').length,
  swatches: document.querySelectorAll('.swatch').length,
  tray: document.querySelector('.tray-item em')?.textContent,
  sidebar: document.querySelector('.rbw-nav span')?.textContent,
  badge: [...document.querySelectorAll('.rbw-badge-t')].map((e) => e.textContent).filter(Boolean).slice(0, 4),
  heroDownload: document.getElementById('hero-download-text').textContent,
  stores: [...document.querySelectorAll('.store b')].map((e) => e.textContent),
  yourBrowser: document.querySelector('.store.is-yours')?.dataset.store,
  dlPrimary: `${document.getElementById('dl-primary-text').textContent} · ${document.getElementById('dl-primary-meta').textContent}`,
  archSwitch: [...document.querySelectorAll('#dl-arch [data-arch]')].map((b) => b.textContent),
  platforms: document.querySelectorAll('.plat').length,
  packages: document.querySelectorAll('.pkg').length,
  yourPlatform: document.querySelector('.plat.is-yours h4')?.textContent,
  engine: `${document.querySelector('[data-engine-label]').textContent} · ${document.querySelector('[data-engine-sub]').textContent}`,
  engineBuilds: document.querySelectorAll('#engine-builds a').length,
  film: document.getElementById('film-meta').textContent,
  studioCards: document.querySelectorAll('#studio-app .rbw-card').length,
  studioLook: document.getElementById('studio-app').dataset.look,
  studioScheme: document.getElementById('studio-scheme').textContent,
  studioLang: document.getElementById('studio-lang').textContent,
  studioSidebar: document.querySelector('#studio-app .rbw-nav span')?.textContent,
  langChips: document.querySelectorAll('.lang-chip').length,
  pick: `${document.querySelector('.pick-head b').textContent} · ${document.querySelector('[data-v="count"]').textContent} — ${document.querySelector('[data-v="size"]').textContent}`,
  filmCard: document.querySelector('#film-open b').textContent,
  overview: document.querySelectorAll('.ov-point').length,
}
// Pick a language and a scheme in the studio, as a visitor would.
document.querySelector('.lang-chip[data-lang="ko"]').dispatchEvent(new window.Event('click', { bubbles: true }))
document.querySelector('.swatch[data-i="4"]').dispatchEvent(new window.Event('click', { bubbles: true }))
document.querySelector('#studio-look [data-look="light"]').dispatchEvent(new window.Event('click', { bubbles: true }))
await frames(3)
checks.studioPicked = {
  look: document.getElementById('studio-app').dataset.look,
  scheme: document.getElementById('studio-scheme').textContent,
  lang: document.getElementById('studio-lang').textContent,
  sidebar: document.querySelector('#studio-app .rbw-nav span')?.textContent,
}
await i18n.setLocale('ar')
await frames(10)
checks.afterSwitch = { lang: document.documentElement.lang, dir: document.documentElement.dir, sidebar: document.querySelector('.rbw-nav span')?.textContent, proto: document.querySelector('.proto-name')?.textContent, store: document.querySelector('.store b')?.textContent, help: document.querySelector('.plat-help')?.textContent }
document.documentElement.dataset.theme = 'light'
await frames(10)
await main
console.log(JSON.stringify(checks, null, 1))
const unique = [...new Set(errors)]
console.log(unique.length ? `✗ ${unique.length} error(s):\n  ` + unique.slice(0, 20).join('\n  ') : `✓ 40 s of scenes, no errors`)
process.exit(unique.length ? 1 : 0)
