/**
 * @fileoverview Accent scheme catalogue and custom seed validation.
 *
 * Kept dependency-free so configuration hydration can validate persisted
 * values without loading the color engine. Scheme ids are persisted in user
 * preferences and are therefore stable identifiers, not display names.
 */
import type { I18nKey } from '@shared/i18nTypes'

export interface ColorScheme {
  /** Stable identifier persisted in configuration. */
  id: string
  labelKey: I18nKey
  /** Seed color that defines the accent hue and chroma. */
  seed: string
  /** Neutral schemes keep surfaces achromatic instead of tinting them with the seed hue. */
  neutral?: boolean
}

export const COLOR_SCHEMES: readonly ColorScheme[] = [
  { id: 'electric', labelKey: 'preferences.color-scheme-electric', seed: '#7B3ED1' },
  { id: 'space', labelKey: 'preferences.color-scheme-space', seed: '#4A6CF7' },
  { id: 'mint', labelKey: 'preferences.color-scheme-mint', seed: '#10B981' },
  { id: 'rose', labelKey: 'preferences.color-scheme-rose', seed: '#F43F5E' },
  { id: 'aurora', labelKey: 'preferences.color-scheme-aurora', seed: '#8B5CF6' },
  { id: 'coral', labelKey: 'preferences.color-scheme-coral', seed: '#F97316' },
  { id: 'glacier', labelKey: 'preferences.color-scheme-glacier', seed: '#06B6D4' },
  { id: 'evergreen', labelKey: 'preferences.color-scheme-evergreen', seed: '#15803D' },
  { id: 'graphite', labelKey: 'preferences.color-scheme-graphite', seed: '#737373', neutral: true },
  { id: 'sakura', labelKey: 'preferences.color-scheme-sakura', seed: '#EC4899' },
]

export const CUSTOM_COLOR_SCHEME_ID = 'custom'
export const DEFAULT_CUSTOM_COLOR_SCHEME = '#737373'

const HEX_COLOR_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalizes any user-provided value to an uppercase six-digit hex color. */
export function normalizeCustomColorScheme(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CUSTOM_COLOR_SCHEME
  const match = value.trim().match(HEX_COLOR_RE)
  if (!match) return DEFAULT_CUSTOM_COLOR_SCHEME
  const hex = match[1]
  const expanded = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex
  return `#${expanded.toUpperCase()}`
}

export function getAllowedColorSchemeIds(): string[] {
  return [...COLOR_SCHEMES.map((scheme) => scheme.id), CUSTOM_COLOR_SCHEME_ID]
}

export function resolveColorScheme(id: string | undefined, customSeed: string | undefined): ColorScheme {
  if (id === CUSTOM_COLOR_SCHEME_ID) {
    return { id, labelKey: 'preferences.color-scheme-custom', seed: normalizeCustomColorScheme(customSeed) }
  }
  return COLOR_SCHEMES.find((scheme) => scheme.id === id) ?? COLOR_SCHEMES[0]
}
