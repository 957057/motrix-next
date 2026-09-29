/**
 * @fileoverview Locale detection, lazy loading and switching (vue-i18n).
 *
 *   1. Language: ?lang= / #lang= > saved choice > navigator.languages > en-US
 *   2. en-US ships in the entry bundle as the fallback; other locales load on demand
 *   3. Arabic and Persian switch the page to right-to-left
 */
import { createI18n } from 'vue-i18n'
import en from './locales/en-US.json'

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
} as const

export type Locale = keyof typeof LOCALES
export type Messages = typeof en
/** Translator signature shared by the mock-ups, so a scene can render another locale. */
export type Translate = (key: string, named?: Record<string, unknown>) => string

export const FALLBACK: Locale = 'en-US'
const CODES = Object.keys(LOCALES) as Locale[]
const RTL = new Set<Locale>(['ar', 'fa'])
const STORAGE_KEY = 'rayburst-website-lang'

export const i18n = createI18n<[Messages], Locale, false>({
  legacy: false,
  locale: FALLBACK,
  fallbackLocale: FALLBACK,
  messages: { [FALLBACK]: en } as Record<Locale, Messages>,
  missingWarn: false,
  fallbackWarn: false,
})

const loaders = import.meta.glob<{ default: Messages }>(['./locales/*.json', '!./locales/en-US.json'])
const pending = new Map<Locale, Promise<boolean>>()

export const isLocale = (value: unknown): value is Locale => CODES.includes(value as Locale)
export const isRtl = (code: Locale) => RTL.has(code)

/** Map a BCP 47 tag onto a supported locale. */
export function resolveLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null
  const value = raw.trim()
  if (isLocale(value)) return value
  const lower = value.toLowerCase()
  if (['zh-hk', 'zh-mo', 'zh-tw', 'zh-hant'].some((p) => lower.startsWith(p))) return 'zh-TW'
  const exact = CODES.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  const lang = lower.split('-')[0]
  if (lang === 'no' || lang === 'nn') return 'nb'
  return CODES.find((c) => c.toLowerCase().split('-')[0] === lang) ?? null
}

export const systemLocale = (): Locale => navigator.languages.map(resolveLocale).find(Boolean) ?? FALLBACK

export function detectLocale(): Locale {
  const param = new URLSearchParams(location.search).get('lang') ?? location.hash.match(/lang=([^&]+)/)?.[1]
  const fromUrl = resolveLocale(param)
  if (fromUrl) return fromUrl
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Storage is optional; fall back to the browser languages.
  }
  return systemLocale()
}

/** Load a locale's messages once; resolves false when they cannot be fetched. */
export function loadLocale(code: Locale): Promise<boolean> {
  if (i18n.global.availableLocales.includes(code)) return Promise.resolve(true)
  let job = pending.get(code)
  if (!job) {
    const loader = loaders[`./locales/${code}.json`]
    job = loader
      ? loader().then(
          (mod) => {
            i18n.global.setLocaleMessage(code, mod.default)
            return true
          },
          () => {
            pending.delete(code)
            return false
          },
        )
      : Promise.resolve(false)
    pending.set(code, job)
  }
  return job
}

/** Switch the page language; untranslatable requests fall back to English. */
export async function setLocale(code: Locale, persist = true): Promise<Locale> {
  const ok = await loadLocale(code)
  const next = ok ? code : FALLBACK
  i18n.global.locale.value = next
  const root = document.documentElement
  root.lang = next
  root.dir = isRtl(next) ? 'rtl' : 'ltr'
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice is simply not remembered.
    }
  }
  return next
}

/** A translator bound to one locale (the studio previews languages without switching the page). */
export function translatorFor(code: Locale): Translate {
  return (key, named) => i18n.global.t(key, named ?? {}, { locale: code })
}
