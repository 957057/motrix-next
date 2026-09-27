/**
 * Locale loading and DOM translation.
 *
 *   1. Language: ?lang= / #lang= > saved choice > navigator.languages > en-US
 *   2. locales/en-US.json is the base; the chosen locale is layered on top
 *   3. [data-i18n] → textContent, [data-i18n-html] → innerHTML (with link
 *      variables), [data-i18n-alt|aria-label|title] → attributes
 *   4. Arabic and Persian switch the page to right-to-left
 *
 * Text waits for its language (data-locale-pending) so the page never flashes
 * English before switching; the bootstrap in index.html gives up after 8 s.
 */

export const LOCALES = {
  ar: 'العربية',
  bg: 'Български',
  ca: 'Català',
  de: 'Deutsch',
  el: 'Ελληνικά',
  'en-US': 'English',
  es: 'Español',
  fa: 'فارسی',
  fr: 'Français',
  hi: 'हिन्दी',
  hu: 'Magyar',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nb: 'Norsk bokmål',
  nl: 'Nederlands',
  pl: 'Polski',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
}
const CODES = Object.keys(LOCALES)
const RTL = new Set(['ar', 'fa'])
const FALLBACK = 'en-US'
const STORAGE_KEY = 'rayburst-website-lang'
const LINKS = {
  aria2Next: '<a href="https://github.com/AnInsomniacy/aria2-next" target="_blank" rel="noopener">Aria2 Next</a>',
}

let current = FALLBACK
let base = readStaticEnglish()
let messages = base
let request = null
let english = null
const listeners = []

/** English copy baked into the page, used until (or if) the locale files load. */
function readStaticEnglish() {
  const out = {}
  const roots = [document, document.getElementById('locale-fallback')?.content].filter(Boolean)
  for (const root of roots) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      out[el.dataset.i18n] = el.textContent.trim().replace(/\s+/g, ' ')
    })
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      out[el.dataset.i18nHtml] = el.innerHTML.trim().replace(/\s+/g, ' ')
    })
  }
  return out
}

export function resolve(raw) {
  if (!raw) return null
  const v = raw.trim()
  if (CODES.includes(v)) return v
  const lower = v.toLowerCase()
  if (['zh-hk', 'zh-mo', 'zh-tw', 'zh-hant'].some((p) => lower.startsWith(p))) return 'zh-TW'
  const exact = CODES.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  const lang = lower.split('-')[0]
  if (lang === 'no' || lang === 'nn') return 'nb'
  return CODES.find((c) => c.toLowerCase().split('-')[0] === lang) ?? null
}

export const systemLocale = () => navigator.languages.map(resolve).find(Boolean) ?? FALLBACK

function detect() {
  const param = new URLSearchParams(location.search).get('lang') ?? location.hash.match(/lang=([^&]+)/)?.[1]
  const fromUrl = resolve(param)
  if (fromUrl) return fromUrl
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (CODES.includes(saved)) return saved
  } catch {
    // Storage is optional.
  }
  return systemLocale()
}

async function load(code, signal) {
  try {
    const res = await fetch(new URL(`locales/${code}.json`, document.baseURI), { signal })
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

export function t(key, vars) {
  const raw = messages[key] ?? base[key] ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : raw
}

export const locale = () => current
export const isRtl = () => RTL.has(current)
export const onChange = (fn) => listeners.push(fn)

export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml, LINKS)
  })
  for (const attr of ['alt', 'aria-label', 'title']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)))
    })
  }
}

export async function setLocale(code, persist = true) {
  if (!CODES.includes(code)) return
  const root = document.documentElement
  request?.abort()
  const controller = new AbortController()
  request = controller
  const signal = AbortSignal.any ? AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) : controller.signal
  const [en, loc] = await Promise.all([english ?? load(FALLBACK, signal), code === FALLBACK ? null : load(code, signal)])
  if (request !== controller) return
  request = null
  if (en && !english) {
    english = en
    base = { ...base, ...en }
  }
  messages = code === FALLBACK ? base : (loc ?? base)
  current = code === FALLBACK || loc ? code : FALLBACK
  root.lang = current
  root.dir = RTL.has(current) ? 'rtl' : 'ltr'
  apply()
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, current)
    } catch {
      // The choice simply is not remembered.
    }
  }
  window.localeBoot?.finish()
  for (const fn of listeners) fn(current)
}

export const ready = setLocale(detect(), false)
