/**
 * @fileoverview The ten built-in Rayburst color schemes, light and dark,
 * generated exactly as the desktop app's src/shared/utils/colorScheme.ts does
 * (seeds from src/shared/constants.ts).
 */
import {
  argbFromHex,
  CorePalette,
  customColor,
  hexFromArgb,
  Scheme,
  themeFromSourceColor,
  type CustomColorGroup,
  type TonalPalette,
} from '@material/material-color-utilities'

interface SchemeSeed {
  id: string
  seed: string
  variant?: 'content'
}

const SEEDS: SchemeSeed[] = [
  { id: 'rayburst', seed: '#9E74D5', variant: 'content' },
  { id: 'amber', seed: '#E0A422' },
  { id: 'space', seed: '#4A6CF7' },
  { id: 'mint', seed: '#10B981' },
  { id: 'rose', seed: '#F43F5E' },
  { id: 'coral', seed: '#F97316' },
  { id: 'glacier', seed: '#06B6D4' },
  { id: 'evergreen', seed: '#15803D' },
  { id: 'graphite', seed: '#737373', variant: 'content' },
  { id: 'sakura', seed: '#EC4899' },
]
const EXTENDED = [
  { name: 'info', value: argbFromHex('#0061A4'), blend: true },
  { name: 'success', value: argbFromHex('#386A20'), blend: true },
]
const SURFACE = {
  light: { lowest: 98, low: 94, container: 91, high: 88, highest: 85 },
  dark: { lowest: 4, low: 10, container: 12, high: 17, highest: 22 },
}

export interface SchemeTokens {
  primary: string
  onPrimary: string
  text: string
  textDim: string
  outline: string
  outlineVariant: string
  info: string
  success: string
  lowest: string
  low: string
  container: string
  high: string
  highest: string
}

export interface ColorScheme {
  id: string
  seed: string
  light: SchemeTokens
  dark: SchemeTokens
}

interface Theme {
  schemes: { light: Scheme; dark: Scheme }
  neutral: TonalPalette
  customColors: CustomColorGroup[]
}

function theme(s: SchemeSeed): Theme {
  const source = argbFromHex(s.seed)
  if (s.variant !== 'content') {
    const th = themeFromSourceColor(source, EXTENDED)
    return { schemes: th.schemes, neutral: th.palettes.neutral, customColors: th.customColors }
  }
  return {
    schemes: { light: Scheme.lightContent(source), dark: Scheme.darkContent(source) },
    neutral: CorePalette.contentOf(source).n1,
    customColors: EXTENDED.map((c) => customColor(source, c)),
  }
}

function tokens(th: Theme, dark: boolean): SchemeTokens {
  const sc = dark ? th.schemes.dark : th.schemes.light
  const tone = SURFACE[dark ? 'dark' : 'light']
  const ext = (name: string) => {
    const group = th.customColors.find((c) => c.color.name === name)
    return group ? hexFromArgb((dark ? group.dark : group.light).color) : '#808080'
  }
  return {
    primary: hexFromArgb(sc.primary),
    onPrimary: hexFromArgb(sc.onPrimary),
    text: hexFromArgb(sc.onSurface),
    textDim: hexFromArgb(sc.onSurfaceVariant),
    outline: hexFromArgb(sc.outline),
    outlineVariant: hexFromArgb(sc.outlineVariant),
    info: ext('info'),
    success: ext('success'),
    lowest: hexFromArgb(th.neutral.tone(tone.lowest)),
    low: hexFromArgb(th.neutral.tone(tone.low)),
    container: hexFromArgb(th.neutral.tone(tone.container)),
    high: hexFromArgb(th.neutral.tone(tone.high)),
    highest: hexFromArgb(th.neutral.tone(tone.highest)),
  }
}

export const SCHEMES: ColorScheme[] = SEEDS.map((s) => {
  const th = theme(s)
  return { id: s.id, seed: s.seed, light: tokens(th, false), dark: tokens(th, true) }
})
