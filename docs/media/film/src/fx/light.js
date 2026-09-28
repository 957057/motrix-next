/** Additive light: god rays, flares, shockwaves, spark bursts and ribbons. */
import { C } from '../brand/palette.js'
import { glow, streak } from '../core/draw.js'
import { bezier, bezierTangent, clamp, hash2, rgba, TAU } from '../core/math.js'

/**
 * Radial light shafts from a point, echoing the poster flare at the logo's
 * convergence point. Angles in radians (screen space, y down).
 */
export function godRays(ctx, x, y, t, o = {}) {
  const {
    count = 42,
    length = 2200,
    from = -Math.PI * 0.62,
    to = Math.PI * 0.08,
    intensity = 1,
    color = '#C9A8FF',
    seed = 5,
    spin = 0.04,
    back = 0.35,
  } = o
  if (intensity <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i++) {
    const main = i < count * (1 - back)
    const r0 = hash2(seed, i)
    const r1 = hash2(seed + 1, i)
    const r2 = hash2(seed + 2, i)
    const ang = main ? from + (to - from) * r0 + Math.sin(t * spin * TAU + i) * 0.015 : r0 * TAU
    const width = (main ? 0.006 + r1 * 0.028 : 0.004 + r1 * 0.01) * (0.8 + 0.2 * Math.sin(t * 1.3 + i))
    const len = length * (0.35 + r2 * 0.65) * (main ? 1 : 0.55)
    const flicker = 0.55 + 0.45 * Math.sin(t * (0.8 + r1 * 1.7) + r2 * 9)
    const a = intensity * (main ? 0.22 : 0.08) * flicker
    const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    g.addColorStop(0, rgba(color, a))
    g.addColorStop(0.35, rgba(color, a * 0.35))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(ang - width) * len, y + Math.sin(ang - width) * len)
    ctx.lineTo(x + Math.cos(ang + width) * len, y + Math.sin(ang + width) * len)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** Hot core + halo + anamorphic streak. */
export function flare(ctx, x, y, o = {}) {
  const { intensity = 1, size = 1, color = C.lilac, core = '#FFFFFF' } = o
  if (intensity <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, x, y, 420 * size, color, 0.35 * intensity)
  glow(ctx, x, y, 140 * size, '#E7D6FF', 0.6 * intensity)
  glow(ctx, x, y, 40 * size, core, clamp(1.0 * intensity))
  streak(ctx, x, y, 900 * size, 16 * size, '#D9C4FF', 0.5 * intensity)
  streak(ctx, x, y, 420 * size, 5 * size, '#FFFFFF', 0.6 * intensity)
  ctx.restore()
}

export function shockwave(ctx, x, y, age, o = {}) {
  const { speed = 2600, life = 0.9, color = '#D8C2FF', width = 18 } = o
  if (age <= 0 || age > life) return
  const k = age / life
  const r = speed * age * (1 - 0.35 * k)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const [w, a] of [
    [width * 4, 0.08],
    [width, 0.35],
    [width * 0.25, 0.8],
  ]) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.strokeStyle = rgba(color, a * (1 - k) * (1 - k))
    ctx.lineWidth = w * (1 - 0.5 * k)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Sparks thrown from a point. Deterministic per index; drawn as velocity
 * streaks so they read as fast even before sub-frame motion blur.
 */
export function sparks(ctx, x, y, age, o = {}) {
  const {
    count = 260,
    speed = 1500,
    drag = 2.6,
    life = 1.6,
    from = -Math.PI * 0.7,
    to = Math.PI * 0.15,
    spread = 0.25,
    seed = 9,
    colors = ['#FFFFFF', '#E7D6FF', C.lilac, C.seed],
    gravity = 60,
    scale = 1,
  } = o
  if (age <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    const lf = life * (0.4 + hash2(seed, i) * 0.6)
    if (age > lf) continue
    const inside = hash2(seed + 1, i) > spread
    const ang = inside ? from + (to - from) * hash2(seed + 2, i) : hash2(seed + 2, i) * TAU
    const v0 = speed * (0.2 + Math.pow(hash2(seed + 3, i), 1.6) * 0.8) * scale
    const travel = (v0 * (1 - Math.exp(-drag * age))) / drag
    const vNow = v0 * Math.exp(-drag * age)
    const px = x + Math.cos(ang) * travel
    const py = y + Math.sin(ang) * travel + gravity * age * age
    const len = Math.min(140, vNow * 0.035 + 2)
    const k = age / lf
    const a = (1 - k) * (1 - k)
    ctx.strokeStyle = rgba(colors[i % colors.length], a)
    ctx.lineWidth = (1 + hash2(seed + 4, i) * 2.2) * scale
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px - Math.cos(ang) * len, py - Math.sin(ang) * len)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Luminous ribbon: a bundle of thin bezier strands with a bright core and
 * flowing pulses. p = [p0, p1, p2, p3].
 */
export function ribbon(ctx, p, t, o = {}) {
  const {
    color = C.lilac,
    core = '#F4ECFF',
    strands = 9,
    width = 60,
    alpha = 1,
    flow = 0.35,
    seed = 1,
    reveal = 1,
    pulses = true,
  } = o
  if (alpha <= 0 || reveal <= 0) return
  const [p0, p1, p2, p3] = p
  const n = 48
  const tMax = clamp(reveal)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let s = 0; s < strands; s++) {
    const off = (s / Math.max(1, strands - 1) - 0.5) * width
    const wob = hash2(seed, s) * TAU
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * tMax
      const [bx, by] = bezier(p0, p1, p2, p3, u)
      const [tx, ty] = bezierTangent(p0, p1, p2, p3, u)
      const tl = Math.hypot(tx, ty) || 1
      const nx = -ty / tl
      const ny = tx / tl
      const env = Math.sin(Math.PI * Math.min(1, u * 1.1))
      const o2 = off * env * (0.6 + 0.4 * Math.sin(u * 6 + t * 0.9 + wob))
      if (i === 0) ctx.moveTo(bx + nx * o2, by + ny * o2)
      else ctx.lineTo(bx + nx * o2, by + ny * o2)
    }
    const centre = 1 - Math.abs(s / Math.max(1, strands - 1) - 0.5) * 2
    ctx.strokeStyle = rgba(color, alpha * (0.08 + 0.22 * centre))
    ctx.lineWidth = 1.2 + centre * 1.6
    ctx.stroke()
  }
  // Core line
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const [bx, by] = bezier(p0, p1, p2, p3, (i / n) * tMax)
    if (i === 0) ctx.moveTo(bx, by)
    else ctx.lineTo(bx, by)
  }
  ctx.strokeStyle = rgba(core, alpha * 0.55)
  ctx.lineWidth = 2
  ctx.stroke()
  if (pulses) {
    for (let k = 0; k < 3; k++) {
      const u = (t * flow + k / 3 + hash2(seed, 99)) % 1
      if (u > tMax) continue
      const [bx, by] = bezier(p0, p1, p2, p3, u)
      glow(ctx, bx, by, 38, core, alpha * 0.5 * Math.sin(Math.PI * u))
    }
  }
  ctx.restore()
}

/** Comet travelling along a bezier, with a fading trail. u ∈ [0, 1]. */
export function comet(ctx, p, u, o = {}) {
  const { color = '#E9DDFF', trail = 0.25, size = 1, alpha = 1 } = o
  if (u <= 0 || alpha <= 0) return
  const [p0, p1, p2, p3] = p
  const tail = Math.max(0, u - trail)
  const steps = 30
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  let prev = bezier(p0, p1, p2, p3, tail)
  for (let i = 1; i <= steps; i++) {
    const v = tail + ((u - tail) * i) / steps
    const q = bezier(p0, p1, p2, p3, Math.min(1, v))
    const k = i / steps
    ctx.strokeStyle = rgba(color, alpha * k * k)
    ctx.lineWidth = (2 + 10 * k * k) * size
    ctx.beginPath()
    ctx.moveTo(prev[0], prev[1])
    ctx.lineTo(q[0], q[1])
    ctx.stroke()
    prev = q
  }
  const head = bezier(p0, p1, p2, p3, Math.min(1, u))
  glow(ctx, head[0], head[1], 90 * size, color, 0.55 * alpha)
  glow(ctx, head[0], head[1], 22 * size, '#FFFFFF', alpha)
  ctx.restore()
  return head
}
