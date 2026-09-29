/**
 * @fileoverview Page language switching: fetch first, then cross-fade the whole
 * page into the new language (View Transitions) when motion is allowed.
 */
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadLocale, setLocale, type Locale } from '@/i18n'
import { reducedMotion } from '@/motion/gsap'

export function useLanguage() {
  const { locale } = useI18n()

  async function switchTo(code: Locale) {
    if (code === locale.value) return
    if (!document.startViewTransition || reducedMotion()) {
      await setLocale(code)
      return
    }
    await loadLocale(code)
    const root = document.documentElement
    root.classList.add('vt-fade')
    const vt = document.startViewTransition(async () => {
      await setLocale(code)
      await nextTick()
    })
    vt.finished.finally(() => root.classList.remove('vt-fade'))
  }

  return { locale, switchTo }
}
