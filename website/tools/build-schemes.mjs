/**
 * Generates assets/data/schemes.json: the ten built-in Rayburst color schemes,
 * light and dark, computed exactly as src/shared/utils/colorScheme.ts does.
 *
 *   npm i --no-save @material/material-color-utilities@0.4.0
 *   node tools/build-schemes.mjs
 */
import { writeFileSync } from 'node:fs';
import { CorePalette, Hct, Scheme, argbFromHex, customColor, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

// rayburst/src/shared/constants.ts
const SCHEMES = [
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
];
const EXTENDED = [
  { name: 'info', value: argbFromHex('#0061A4'), blend: true },
  { name: 'success', value: argbFromHex('#386A20'), blend: true },
];
const SURFACE = {
  light: { lowest: 98, low: 94, container: 91, high: 88, highest: 85 },
  dark: { lowest: 4, low: 10, container: 12, high: 17, highest: 22 },
};

function theme(s) {
  const source = argbFromHex(s.seed);
  if (s.variant !== 'content') return themeFromSourceColor(source, EXTENDED.map((c) => ({ ...c })));
  const p = CorePalette.contentOf(source);
  return {
    source,
    schemes: { light: Scheme.lightContent(source), dark: Scheme.darkContent(source) },
    palettes: { primary: p.a1, neutral: p.n1 },
    customColors: EXTENDED.map((c) => customColor(source, { ...c })),
  };
}

function tokens(th, dark) {
  const sc = dark ? th.schemes.dark : th.schemes.light;
  const n = th.palettes.neutral;
  const tone = SURFACE[dark ? 'dark' : 'light'];
  const ext = (name) => {
    const g = th.customColors.find((c) => c.color.name === name);
    const v = dark ? g.dark : g.light;
    return { color: hexFromArgb(v.color), container: hexFromArgb(v.colorContainer) };
  };
  const hex = (v) => hexFromArgb(v);
  return {
    primary: hex(sc.primary),
    onPrimary: hex(sc.onPrimary),
    primaryContainer: hex(sc.primaryContainer),
    onPrimaryContainer: hex(sc.onPrimaryContainer),
    surface: hex(sc.surface),
    lowest: hex(n.tone(tone.lowest)),
    low: hex(n.tone(tone.low)),
    container: hex(n.tone(tone.container)),
    high: hex(n.tone(tone.high)),
    highest: hex(n.tone(tone.highest)),
    text: hex(sc.onSurface),
    textDim: hex(sc.onSurfaceVariant),
    outline: hex(sc.outline),
    outlineVariant: hex(sc.outlineVariant),
    info: ext('info').color,
    success: ext('success').color,
    successContainer: ext('success').container,
  };
}

const out = SCHEMES.map((s) => {
  const th = theme(s);
  return { id: s.id, seed: s.seed, light: tokens(th, false), dark: tokens(th, true) };
});
writeFileSync(new URL('../assets/data/schemes.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(out.map((s) => `${s.id} ${s.light.primary} ${s.dark.primary}`).join('\n'));
