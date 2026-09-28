/**
 * Canvas typography with i18n support.
 *
 * Latin text animates by word (kerning stays intact), CJK by character.
 * Alignment is computed here so every renderer measures the same way.
 */
import { clamp } from './math.js'
import { M3 } from './ease.js'

const STACK = {
  sans: '"Inter Var", sans-serif',
  mono: '"JetBrains Mono", monospace',
}
let CJK_LOCALE = false

export function setFontStack({ sans, mono, cjk } = {}) {
  if (sans) STACK.sans = sans
  if (mono) STACK.mono = mono
  CJK_LOCALE = Boolean(cjk)
}

export function isCjkLocale() {
  return CJK_LOCALE
}

export function font(size, weight = 500, fam = 'sans') {
  return `${weight} ${size}px ${STACK[fam] ?? fam}`
}

const CJK = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/
const ALIGN = { left: 0, center: 0.5, right: 1 }

function apply(ctx, o) {
  const size = o.size ?? 32
  let tracking = o.tracking ?? 0
  // Negative tracking suits Latin display type but crowds CJK glyphs.
  if (CJK_LOCALE && tracking < 0) tracking = 0
  ctx.font = font(size, o.weight ?? 500, o.fam ?? 'sans')
  ctx.letterSpacing = `${tracking * size}px`
  ctx.textAlign = 'left'
  ctx.textBaseline = o.baseline ?? 'alphabetic'
  return size
}

export function measure(ctx, str, o = {}) {
  ctx.save()
  apply(ctx, o)
  const w = ctx.measureText(str).width
  ctx.restore()
  return w
}

/** Draw a single line. Returns its width. */
export function text(ctx, str, x, y, o = {}) {
  if (!str) return 0
  ctx.save()
  apply(ctx, o)
  const w = ctx.measureText(str).width
  const x0 = x - w * (ALIGN[o.align ?? 'left'] ?? 0)
  ctx.globalAlpha *= clamp(o.alpha ?? 1)
  if (o.stroke) {
    ctx.lineWidth = o.stroke.width ?? 2
    ctx.strokeStyle = o.stroke.color ?? '#fff'
    ctx.lineJoin = 'round'
    ctx.strokeText(str, x0, y)
  }
  if (o.color !== null) {
    ctx.fillStyle = o.color ?? '#fff'
    ctx.fillText(str, x0, y)
  }
  ctx.restore()
  return w
}

/** Split text into animation units: Latin words (with trailing space) or single CJK glyphs. */
export function units(str, split = 'words') {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const out = []
  let cur = ''
  for (const { segment: g } of seg.segment(str)) {
    if (split === 'chars' || CJK.test(g)) {
      if (cur) out.push(cur)
      cur = ''
      out.push(g)
    } else {
      cur += g
      if (/\s/.test(g)) {
        out.push(cur)
        cur = ''
      }
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Staggered reveal of one line.
 *  lt:   seconds since the reveal starts (negative → hidden)
 *  r.mode: 'rise' (fade and rise) or 'mask' (slide up from behind a baseline mask)
 *  r.exit: seconds since the exit starts (optional)
 */
export function reveal(ctx, str, x, y, o = {}, lt = 0, r = {}) {
  if (!str || lt <= 0) return 0
  const { stagger = 0.05, dur = 0.6, mode = 'rise', ease = M3.enter, split = 'words', exitDur = 0.35 } = r
  ctx.save()
  const size = apply(ctx, o)
  const us = units(str, split)
  const full = ctx.measureText(str).width
  const x0 = x - full * (ALIGN[o.align ?? 'left'] ?? 0)
  const baseAlpha = ctx.globalAlpha * clamp(o.alpha ?? 1)
  const out = r.exit != null ? M3.exit(clamp(r.exit / exitDur)) : 0
  if (out >= 1) {
    ctx.restore()
    return full
  }
  if (mode === 'mask') {
    ctx.beginPath()
    ctx.rect(x0 - size, y - size * 1.25, full + size * 2, size * 1.62)
    ctx.clip()
  }
  ctx.fillStyle = o.color ?? '#fff'
  let prefix = ''
  for (let i = 0; i < us.length; i++) {
    const px = ctx.measureText(prefix).width
    prefix += us[i]
    const e = ease(clamp((lt - i * stagger) / dur))
    if (e <= 0) continue
    const eo = out > 0 ? M3.exit(clamp(out * (1 + us.length * 0.15) - i * 0.15)) : 0
    let dy
    let a
    if (mode === 'mask') {
      dy = (1 - e) * size * 1.15 - eo * size * 1.2
      a = Math.min(1, e * 1.6) * (1 - eo * 0.5)
    } else {
      dy = (1 - e) * size * 0.45 - eo * size * 0.3
      a = e * (1 - eo)
    }
    ctx.globalAlpha = baseAlpha * a
    ctx.fillText(us[i], x0 + px, y + dy)
  }
  ctx.restore()
  return full
}

/** Truncate with an ellipsis so the line fits maxWidth (like CSS text-overflow). */
export function ellipsize(ctx, str, maxWidth, o = {}) {
  if (measure(ctx, str, o) <= maxWidth) return str
  const chars = [...str]
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(ctx, `${chars.slice(0, mid).join('')}…`, o) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`
}

/** Greedy line wrap: spaces for Latin, any glyph boundary for CJK. */
export function wrap(ctx, str, maxWidth, o = {}) {
  ctx.save()
  apply(ctx, o)
  const lines = []
  let line = ''
  for (const u of units(str)) {
    const test = line + u
    if (line && ctx.measureText(test.trimEnd()).width > maxWidth) {
      lines.push(line.trimEnd())
      line = u.trimStart()
    } else {
      line = test
    }
  }
  if (line) lines.push(line.trimEnd())
  ctx.restore()
  return lines
}

/** Largest size (≤ size) at which str fits maxWidth. */
export function fit(ctx, str, maxWidth, o = {}) {
  let size = o.size ?? 32
  const w = measure(ctx, str, o)
  if (w > maxWidth) size = Math.floor(size * (maxWidth / w))
  return size
}

/** Fill a template like "{n} peers". */
export function fmt(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
