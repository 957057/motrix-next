/**
 * 44–50 s · The engine. The palette turns to Aria2 Next's black and gold:
 * data lanes converge on the engine chip while packets stream in, faster and
 * faster through the build.
 */
import { C } from '../brand/palette.js'
import { goldRoom } from '../fx/background.js'
import { flare } from '../fx/light.js'
import { fillRR, glow, rr, shadow } from '../core/draw.js'
import { outCubic, prog, spring } from '../core/ease.js'
import { bezier, bezierTangent, clamp, hash2, lerp, rgba, smoothstep } from '../core/math.js'
import { reveal } from '../core/text.js'
import { CHIP } from './layout.js'

const LANES = (() => {
  const out = []
  const n = 13
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j < n; j++) {
      const f = j / (n - 1)
      const left = side === 0
      const y0 = -260 + f * 1600
      const x0 = left ? -160 : 2080
      const ex = CHIP.x + (left ? -CHIP.size / 2 : CHIP.size / 2)
      const ey = CHIP.y + (f - 0.5) * CHIP.size * 0.72
      out.push({
        p: [
          [x0, y0],
          [left ? 520 : 1900, y0 * 0.85 + 80],
          [ex + (left ? -420 : 240), ey],
          [ex, ey],
        ],
        depth: 0.3 + 0.7 * hash2(31, side * n + j),
        speed: 0.22 + 0.25 * hash2(32, side * n + j),
        seed: side * n + j,
      })
    }
  }
  return out
})()

function drawLane(ctx, lane, reveal, t, rush, boost) {
  const [p0, p1, p2, p3] = lane.p
  const steps = 40
  const g = ctx.createLinearGradient(p0[0], p0[1], p3[0], p3[1])
  g.addColorStop(0, rgba(C.goldDeep, 0))
  g.addColorStop(0.6, rgba(C.goldDeep, 0.35 * lane.depth))
  g.addColorStop(1, rgba(C.gold, 0.8 * lane.depth))
  ctx.strokeStyle = g
  ctx.lineWidth = 1.2 + lane.depth * 3
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const [x, y] = bezier(p0, p1, p2, p3, (i / steps) * reveal)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  // Packets
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    const u = (hash2(lane.seed, k) + lane.speed * (t + 2.6 * boost)) % 1
    if (u > reveal) continue
    const [x, y] = bezier(p0, p1, p2, p3, u)
    const [tx, ty] = bezierTangent(p0, p1, p2, p3, u)
    const tl = Math.hypot(tx, ty) || 1
    const len = (14 + 40 * lane.depth) * (1 + 1.5 * rush)
    const a = (0.35 + 0.65 * lane.depth) * smoothstep(0, 0.2, u)
    ctx.strokeStyle = rgba(C.goldLight, a)
    ctx.lineWidth = 2 + lane.depth * 2.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - (tx / tl) * len, y - (ty / tl) * len)
    ctx.stroke()
    glow(ctx, x, y, 18 + 20 * lane.depth, C.gold, 0.25 * a)
  }
  ctx.restore()
}

function drawCompass(ctx, s, stroke) {
  // Compass-style "A": two legs from a hinge, with an arched crossbar.
  ctx.strokeStyle = stroke
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = s * 0.07
  ctx.beginPath()
  ctx.moveTo(-s * 0.22, s * 0.3)
  ctx.lineTo(0, -s * 0.2)
  ctx.lineTo(s * 0.22, s * 0.3)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.13, s * 0.1)
  ctx.quadraticCurveTo(0, s * 0.04, s * 0.13, s * 0.1)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -s * 0.25, s * 0.055, 0, Math.PI * 2)
  ctx.stroke()
}

function drawChip(ctx, t, glowAmt) {
  const { x, y, size } = CHIP
  const float = Math.sin(t * 1.2) * 6
  ctx.save()
  ctx.translate(x, y + float)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, 0, 0, size * 1.6, '#FFCF7A', 0.18 + 0.3 * glowAmt)
  ctx.restore()
  // Pins
  for (let i = 0; i < 9; i++) {
    const py = -size * 0.36 + (i * size * 0.72) / 8
    fillRR(ctx, -size / 2 - 14, py - 3, 16, 6, 2, rgba(C.gold, 0.8))
    fillRR(ctx, size / 2 - 2, py - 3, 16, 6, 2, rgba(C.gold, 0.8))
  }
  shadow(ctx, -size / 2, -size / 2, size, size, 40, 60, 0.7, 30)
  const body = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2)
  body.addColorStop(0, '#2A251C')
  body.addColorStop(1, '#0D0C0A')
  rr(ctx, -size / 2, -size / 2, size, size, 40)
  ctx.fillStyle = body
  ctx.fill()
  const rim = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2)
  rim.addColorStop(0, C.goldLight)
  rim.addColorStop(0.5, C.gold)
  rim.addColorStop(1, C.goldDeep)
  ctx.strokeStyle = rim
  ctx.lineWidth = 5
  ctx.stroke()
  rr(ctx, -size / 2 + 18, -size / 2 + 18, size - 36, size - 36, 26)
  ctx.strokeStyle = rgba(C.gold, 0.25)
  ctx.lineWidth = 1.5
  ctx.stroke()
  const glyph = ctx.createLinearGradient(0, -size * 0.3, 0, size * 0.3)
  glyph.addColorStop(0, C.goldLight)
  glyph.addColorStop(1, C.gold)
  drawCompass(ctx, size, glyph)
  ctx.restore()
}

export default {
  id: 'engine',
  draw(ctx, S) {
    const { t, T, s } = S
    const sec = S.sec
    const gold = T.ev('gold')
    const riser = T.ev('riser2')
    const rush = smoothstep(riser, sec.end, t)
    goldRoom(ctx, t, { intensity: 1 + 0.4 * rush })

    const cam = 1 + 0.05 * prog(t, sec.start, sec.dur) + 0.04 * rush
    ctx.save()
    ctx.translate(CHIP.x, CHIP.y)
    ctx.scale(cam, cam)
    ctx.translate(-CHIP.x, -CHIP.y)

    const reveal0 = outCubic(prog(t, sec.start, 1.2))
    // Integral of the rush curve, so packets accelerate without jumping.
    const D = sec.end - riser
    const u = clamp((t - riser) / D)
    const boost = t <= riser ? 0 : D * (u * u * u - (u * u * u * u) / 2) + Math.max(0, t - sec.end)
    LANES.forEach((lane, i) => drawLane(ctx, lane, clamp(reveal0 * 1.3 - hash2(40, i) * 0.3), t, rush, boost))
    const hit = Math.exp(-Math.max(0, t - gold) * 2.5)
    drawChip(ctx, t, hit + 0.6 * rush + 0.3 * T.pulse(t, 'kick', 6))
    if (t < gold + 1.2) flare(ctx, CHIP.x, CHIP.y, { intensity: hit * 0.9, color: '#FFD68A', size: 0.9 })
    ctx.restore()

    // Keep the copy legible: lanes fade out behind the text column.
    const shade = ctx.createLinearGradient(0, 0, 1150, 0)
    shade.addColorStop(0, 'rgba(8,7,5,0.92)')
    shade.addColorStop(0.62, 'rgba(8,7,5,0.78)')
    shade.addColorStop(1, 'rgba(8,7,5,0)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, 1150, 1080)

    // Copy
    const x = 150
    const titleLt = t - T.ev('engineTitle')
    reveal(ctx, s('engine.over'), x, 380, { size: 28, weight: 600, tracking: 0.16, color: C.gold }, titleLt + 0.2, {
      dur: 0.6,
    })
    const aria = reveal(ctx, 'Aria2', x, 530, { size: 140, weight: 800, tracking: -0.03, color: C.cream }, titleLt, {
      mode: 'mask',
      split: 'chars',
      stagger: 0.04,
      dur: 0.7,
    })
    const ng = ctx.createLinearGradient(x + aria, 430, x + aria + 380, 540)
    ng.addColorStop(0, C.goldLight)
    ng.addColorStop(0.5, C.gold)
    ng.addColorStop(1, '#B8914A')
    reveal(ctx, 'Next', x + aria + 36, 530, { size: 140, weight: 800, tracking: -0.03, color: ng }, titleLt - 0.18, {
      mode: 'mask',
      split: 'chars',
      stagger: 0.04,
      dur: 0.7,
    })
    reveal(ctx, s('engine.tag'), x + 4, 612, { size: 34, weight: 500, color: '#D2C6AE' }, t - T.ev('engineTag'), {
      dur: 0.7,
    })
    reveal(
      ctx,
      s('engine.list'),
      x + 4,
      676,
      { size: 22, weight: 600, tracking: 0.04, color: rgba(C.gold, 0.85) },
      t - T.ev('engineTag') - 0.5,
      {
        dur: 0.7,
        stagger: 0.03,
      },
    )

    const settle = spring(t - gold, { freq: 1.6, damping: 0.7 })
    return {
      tint: [1.05, 1.0, 0.9],
      saturation: 0.95,
      bloom: 0.9 + 0.5 * rush,
      threshold: 0.62,
      flash: 0.35 * hit * (t >= gold ? 1 : 0),
      flashColor: [1, 0.82, 0.5],
      exposure: lerp(1, 1.12, rush) * (0.94 + 0.06 * clamp(settle)),
      vignette: 0.4,
      grain: 0.04,
      aberration: 0.6 + 2 * rush + 6 * hit,
    }
  },
}
