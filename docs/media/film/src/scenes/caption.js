/**
 * Callouts: one typographic system for every feature beat.
 *
 *   caption   left column: index kicker, title, subtitle (screen space, at
 *             rest while it is read)
 *   loupe     a magnified live view of the real UI detail the caption talks
 *             about, so small interface text is legible without cutting in
 *   leader    a line from the callout to that detail on screen, with light
 *             flowing along it toward the interface (as in the first cut)
 */
import { C } from '../brand/palette.js'
import { applyCamera, frame, toScreen } from '../core/camera.js'
import { circle, glow, ring, rr, shadow, strokeRR } from '../core/draw.js'
import { M3, prog } from '../core/ease.js'
import { bezier, clamp, lerp, rgba } from '../core/math.js'
import { measure, reveal, text, wrap } from '../core/text.js'

/** Left-side scrim so the column reads over any footage; `k` 0..1. */
export function sideScrim(ctx, k, width = 900) {
  if (k <= 0) return
  const g = ctx.createLinearGradient(0, 0, width, 0)
  g.addColorStop(0, rgba('#06040C', 0.82 * k))
  g.addColorStop(0.55, rgba('#06040C', 0.55 * k))
  g.addColorStop(1, 'rgba(6,4,12,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, 1080)
}

/**
 * o: { index, title, sub, at, out, x = 110, y = 420 (first title baseline),
 *      size = 58, maxWidth = 640, accent }
 * Returns the column's bottom y (for placing a loupe) or null when hidden.
 */
export function caption(ctx, t, o) {
  const lt = t - o.at
  if (lt <= 0) return null
  const exit = o.out != null && t >= o.out ? t - o.out : null
  if (exit != null && exit > 0.6) return null
  const x = o.x ?? 110
  const size = o.size ?? 58
  const maxW = o.maxWidth ?? 640
  const titleO = { size, weight: 800, tracking: -0.025, color: o.color ?? C.white }
  const lines = wrap(ctx, o.title, maxW, titleO)
  const lh = size * 1.12
  const y = o.y ?? 420
  const vis = M3.enter(prog(t, o.at, 0.5)) * (exit == null ? 1 : 1 - M3.exit(clamp(exit / 0.35)))
  const accent = o.accent ?? C.lilac200

  if (o.index) {
    ctx.save()
    ctx.globalAlpha *= vis
    const ky = y - size - 20
    text(ctx, o.index, x, ky, { size: 20, weight: 700, tracking: 0.08, color: accent })
    const iw = measure(ctx, o.index, { size: 20, weight: 700, tracking: 0.08 })
    ctx.fillStyle = rgba(accent, 0.75)
    ctx.fillRect(x + iw + 14, ky - 7, 56 * M3.enter(prog(t, o.at + 0.1, 0.6)), 2)
    ctx.restore()
  }
  lines.forEach((line, i) => {
    reveal(ctx, line, x, y + i * lh, titleO, lt - i * 0.08, { mode: 'mask', dur: 0.6, stagger: 0.045, exit })
  })
  let bottom = y + (lines.length - 1) * lh
  if (o.sub) {
    const subO = { size: 27, weight: 500, color: '#D4CBE6' }
    const subLines = wrap(ctx, o.sub, maxW, subO)
    subLines.forEach((line, i) => {
      reveal(ctx, line, x + 2, bottom + 52 + i * 38, subO, lt - 0.22 - i * 0.06, { dur: 0.6, stagger: 0.03, exit })
    })
    bottom += 52 + (subLines.length - 1) * 38
  }
  return bottom
}

/**
 * Magnified view of the desk. drawView(ctx, cam) draws the desk world under a
 * camera; `target` is the world point to magnify.
 * o: { rect {x, y, w, h}, target, zoom, k (0..1), color, bg }
 */
export function loupe(ctx, drawView, o) {
  const k = clamp(o.k)
  if (k <= 0) return
  const { x, y, w, h } = o.rect
  const e = M3.enter(k)
  ctx.save()
  ctx.globalAlpha *= clamp(k * 1.4)
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.translate(cx, cy)
  ctx.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e)
  ctx.translate(-cx, -cy)
  shadow(ctx, x, y, w, h, 16, 40, 0.55, 14)
  ctx.save()
  rr(ctx, x, y, w, h, 16)
  ctx.clip()
  ctx.fillStyle = o.bg ?? '#211f22'
  ctx.fillRect(x, y, w, h)
  ctx.save()
  applyCamera(ctx, frame(o.target, o.zoom, [cx, cy]))
  drawView(ctx)
  ctx.restore()
  // Glass sheen on the lens.
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, 'rgba(255,255,255,0.06)')
  g.addColorStop(0.4, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.restore()
  strokeRR(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 16, rgba(o.color ?? C.lilac, 0.85), 1.5)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.shadowColor = rgba(o.color ?? C.lilac, 0.55)
  ctx.shadowBlur = 24
  strokeRR(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 16, rgba(o.color ?? C.lilac, 0.35), 1.5)
  ctx.restore()
  ctx.restore()
}

/**
 * Leader line from `from` (screen) to the world point `target` under `cam`,
 * drawn on over `draw` (0..1), with light flowing toward the interface.
 */
export function leader(ctx, t, cam, from, target, o = {}) {
  const k = clamp(o.draw ?? 1)
  const alpha = clamp(o.alpha ?? 1)
  if (k <= 0 || alpha <= 0) return
  const color = o.color ?? C.lilac
  const to = toScreen(cam, target)
  const mx = lerp(from[0], to[0], 0.45)
  const b = o.bulge ?? 0
  const path = b
    ? [from, [from[0] + 160, from[1] + b], [to[0] - 120, to[1] + b], to]
    : [from, [mx, from[1]], [mx, to[1]], to]
  const n = 40
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = rgba(color, 0.7)
  ctx.lineWidth = 1.8
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const [px, py] = bezier(...path, (i / n) * k)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  circle(ctx, from[0], from[1], 4, color)
  ctx.globalCompositeOperation = 'lighter'
  if (k >= 1) {
    // Data flowing along the line.
    const count = o.label ? 3 : 4
    for (let j = 0; j < count; j++) {
      const cycle = t * (o.speed ?? 0.9) + j / count
      const u = cycle % 1
      const [px, py] = bezier(...path, u)
      const a = Math.sin(Math.PI * u)
      glow(ctx, px, py, 16, color, 0.55 * a)
      circle(ctx, px, py, 2.2, rgba('#FFFFFF', 0.9 * a))
      if (o.label) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        const la = a * clamp((1 - u) / 0.35)
        text(ctx, o.label(Math.floor(cycle) * count + j), px, py - 12, {
          size: 13,
          weight: 500,
          fam: 'mono',
          color: rgba('#E4EAFF', 0.9 * la),
          align: 'center',
        })
        ctx.restore()
      }
    }
    circle(ctx, to[0], to[1], 4.5, '#F4EEFF')
    ring(ctx, to[0], to[1], 10 + 5 * Math.sin(t * 5), rgba(color, 0.55), 1.5)
    glow(ctx, to[0], to[1], 42, color, 0.35)
  }
  ctx.restore()
}
