/** Full-frame backgrounds. Each fills the whole 1920×1080 design space. */
import { C } from '../brand/palette.js'
import { glow } from '../core/draw.js'
import { clamp, hash2, noise1, rgba, TAU } from '../core/math.js'

const W = 1920
const H = 1080

/** Deep violet night: nebula glows plus slow drifting dust. */
export function night(ctx, t, o = {}) {
  const { intensity = 1, dust = 1, base = C.ink1, glowColor = C.violet800, accent = C.violet700, seed = 3 } = o
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, base)
  g.addColorStop(1, C.ink0)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const blobs = [
    [0.12, 0.88, 900, glowColor, 0.5],
    [0.88, 0.12, 820, glowColor, 0.38],
    [0.55, 0.55, 700, accent, 0.16],
    [0.3, 0.2, 520, accent, 0.12],
  ]
  blobs.forEach(([bx, by, r, col, a], i) => {
    const x = bx * W + (noise1(t * 0.07, seed + i) - 0.5) * 160
    const y = by * H + (noise1(t * 0.06, seed + 10 + i) - 0.5) * 120
    glow(ctx, x, y, r, col, a * intensity)
  })
  ctx.restore()
  if (dust > 0) drawDust(ctx, t, dust * intensity, seed)
}

export function drawDust(ctx, t, amount = 1, seed = 3, color = '#E6DAFF', count = 150) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i++) {
    const depth = 0.3 + hash2(seed, i) * 0.7
    const x = (hash2(seed + 1, i) * W + t * 12 * depth) % W
    const y = (((hash2(seed + 2, i) * H - t * 18 * depth) % H) + H) % H
    const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + hash2(seed + 3, i) * 2.5) + i)
    const r = 0.8 + depth * 1.8
    const a = amount * (0.12 + 0.4 * tw) * depth
    ctx.fillStyle = rgba(color, a)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Blue-violet field used for the browser extension scene (Connect campaign art). */
export function electric(ctx, t, o = {}) {
  const { intensity = 1 } = o
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#07061A')
  g.addColorStop(1, '#0B0620')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, 1500 + Math.sin(t * 0.3) * 60, 500, 900, '#2B3FB8', 0.35 * intensity)
  glow(ctx, 300, 950, 900, C.violet800, 0.45 * intensity)
  glow(ctx, 960, -100, 700, '#3A2AA0', 0.25 * intensity)
  ctx.restore()
  drawDust(ctx, t, 0.6 * intensity, 11, '#CFE0FF', 110)
}

/** Warm black studio for the engine scene. */
export function goldRoom(ctx, t, o = {}) {
  const { intensity = 1 } = o
  ctx.fillStyle = C.goldInk
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, 1330, 540, 900, '#3A2A12', 0.55 * intensity)
  glow(ctx, 300, 300, 700, '#1E1710', 0.5 * intensity)
  ctx.restore()
  // Floor reflection band.
  const f = ctx.createLinearGradient(0, H * 0.72, 0, H)
  f.addColorStop(0, 'rgba(0,0,0,0)')
  f.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = f
  ctx.fillRect(0, H * 0.72, W, H * 0.28)
  drawDust(ctx, t, 0.45 * intensity, 21, '#FFE3A8', 90)
}

/** A colour-tinted dark field (for per-scheme and feature cards). */
export function tinted(ctx, t, color, o = {}) {
  const { intensity = 1, x = W / 2, y = H / 2 } = o
  ctx.fillStyle = C.ink0
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, x, y, 900, color, clamp(0.28 * intensity))
  glow(ctx, W * 0.1, H * 0.95, 700, color, clamp(0.16 * intensity))
  ctx.restore()
  drawDust(ctx, t, 0.35, 31)
}
