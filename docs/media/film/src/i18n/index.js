/**
 * Locale registry. To add a language: copy en.js to <code>.js, translate the
 * strings, register it below, then run `npm run lint`.
 */
import en from './en.js'
import zhCN from './zh-CN.js'

export const LOCALES = { en, 'zh-CN': zhCN }
export const DEFAULT_LOCALE = 'en'

export function getLocale(code) {
  const pack = LOCALES[code]
  if (!pack) throw new Error(`Unknown locale "${code}". Available: ${Object.keys(LOCALES).join(', ')}`)
  const fallback = LOCALES[DEFAULT_LOCALE].strings
  const s = (key) => {
    const v = pack.strings[key] ?? fallback[key]
    if (v == null) throw new Error(`Missing string: ${key}`)
    return v
  }
  return { ...pack.meta, s, strings: pack.strings }
}
