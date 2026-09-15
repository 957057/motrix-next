/**
 * @fileoverview Single owner of appearance state: light/dark resolution, the
 * active accent scheme, CSS custom properties and Naive UI overrides.
 */
import { computed, inject, provide, watchEffect, type ComputedRef, type InjectionKey } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { usePreferenceStore } from '@/stores/preference'
import { APP_THEME } from '@shared/constants'
import { resolveColorScheme } from '@shared/theme/schemes'
import { buildThemeTokens, themeCssVariables, type ThemeTokens } from '@shared/theme/palette'
import { buildNaiveOverrides } from '@shared/theme/naive'

const THEME_TOKENS_KEY: InjectionKey<ComputedRef<ThemeTokens>> = Symbol('theme-tokens')

/** Call once at the application root; descendants read tokens through {@link useThemeTokens}. */
export function provideAppTheme() {
  const preferences = usePreferenceStore()
  const systemDark = usePreferredDark()
  const isDark = computed(() => {
    const theme = preferences.theme
    if (!theme || theme === APP_THEME.AUTO) return systemDark.value
    return theme === APP_THEME.DARK
  })
  const scheme = computed(() =>
    resolveColorScheme(preferences.config.colorScheme, preferences.config.customColorScheme),
  )
  const tokens = computed(() =>
    buildThemeTokens({ seed: scheme.value.seed, neutral: scheme.value.neutral, dark: isDark.value }),
  )
  const naiveTheme = computed(() => (isDark.value ? darkTheme : null))
  const naiveOverrides = computed<GlobalThemeOverrides>(() => buildNaiveOverrides(tokens.value))

  watchEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark.value)
    root.style.colorScheme = isDark.value ? 'dark' : 'light'
    for (const [name, value] of Object.entries(themeCssVariables(tokens.value))) {
      root.style.setProperty(name, value)
    }
  })

  provide(THEME_TOKENS_KEY, tokens)
  return { isDark, scheme, tokens, naiveTheme, naiveOverrides }
}

export function useThemeTokens(): ComputedRef<ThemeTokens> {
  const tokens = inject(THEME_TOKENS_KEY)
  if (!tokens) throw new Error('Theme tokens are unavailable outside the application root')
  return tokens
}
