/**
 * 0–4 s · Waiting. A download crawls at 12 KB/s and stutters; the headline
 * names the problem. At the spark the bar's tip catches light.
 */
import { C } from '../brand/palette.js'
import { night } from '../fx/background.js'
import { flare } from '../fx/light.js'
import { fillRR, glow } from '../core/draw.js'
import { M3, prog } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, hash2, lerp, smoothstep } from '../core/math.js'
import { reveal, text } from '../core/text.js'
import { WAIT_ROW } from './layout.js'

const GLITCH_LEN = 0.22

export function waitProgress(t) {
  // Stair-stepped crawl: progress only moves in small, irregular jumps.
  const steps = Math.floor(t * 3)
  let p = 0.016
  for (let i = 0; i < steps; i++) p += 0.0012 + hash2(77, i) * 0.0022
  return p
}

export function tipPoint(t) {
  const { x0, x1, y } = WAIT_ROW
  return [x0 + (x1 - x0) * waitProgress(t), y + 3]
}

function glitchAmount(T, t) {
  let g = 0
  for (const id of ['glitch1', 'glitch2']) {
    const d = t - T.ev(id)
    if (d >= 0 && d < GLITCH_LEN) g = Math.max(g, 1 - d / GLITCH_LEN)
  }
  return g
}

/** The progress row and headline; `exit` 0..1 fades them away (used by ignite). */
export function drawWaitLayer(ctx, S, exit = 0) {
  const { t, T, s } = S
  const { x0, x1, y } = WAIT_ROW
  const g = glitchAmount(T, t)
  const a = 1 - M3.exit(clamp(exit))
  if (a <= 0) return g
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(0, M3.exit(clamp(exit)) * 40)

  reveal(
    ctx,
    s('wait.headline'),
    x0,
    470,
    { size: 88, weight: 700, color: C.white, tracking: -0.025 },
    t - T.ev('headline'),
    {
      mode: 'mask',
      stagger: 0.07,
      dur: 0.75,
    },
  )

  const shake = g > 0 ? (hash2(3, Math.floor(t * 60)) - 0.5) * 18 * g : 0
  const drawRow = (dx, tint, alpha) => {
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.translate(dx, 0)
    const p = waitProgress(t)
    icon(ctx, 'file', x0, y - 62, 30, tint ?? C.dim, 1.8)
    text(ctx, s('wait.file'), x0 + 44, y - 38, { size: 26, weight: 500, color: tint ?? C.text })
    const secs = 3 * 3600 + 47 * 60 + 12 + Math.floor(t * 2.3)
    const hh = Math.floor(secs / 3600)
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const ss = String(secs % 60).padStart(2, '0')
    const speed = g > 0.35 ? '0.0 KB/s' : `${(12.4 + Math.sin(t * 7) * 0.6).toFixed(1)} KB/s`
    text(ctx, `${speed}   ·   ${s('wait.remaining')} ${hh}:${mm}:${ss}`, x1, y - 38, {
      size: 24,
      weight: 500,
      color: tint ?? C.dim,
      align: 'right',
    })
    fillRR(ctx, x0, y, x1 - x0, 6, 3, 'rgba(255,255,255,0.08)')
    fillRR(ctx, x0, y, Math.max(6, (x1 - x0) * p), 6, 3, tint ?? C.violet700)
    text(ctx, `${(p * 100).toFixed(1)}%`, x0, y + 48, { size: 22, weight: 600, color: tint ?? C.faint })
    ctx.restore()
  }
  if (g > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawRow(-10 * g + shake, '#FF3D6E', 0.5 * g)
    drawRow(10 * g - shake, '#3DE0FF', 0.5 * g)
    ctx.restore()
  }
  drawRow(shake * 0.3, null, 1 - 0.4 * g)
  ctx.restore()
  return g
}

export default {
  id: 'wait',
  draw(ctx, S) {
    const { t, T } = S
    night(ctx, t, { intensity: 0.32, dust: 0.5 })
    const g = drawWaitLayer(ctx, S, 0)

    const sp = T.ev('spark')
    if (t > sp - 0.05) {
      const k = smoothstep(sp - 0.05, sp + 0.4, t)
      const [x, y] = tipPoint(t)
      flare(ctx, x, y, { intensity: k * (0.75 + 0.25 * Math.sin(t * 40)), size: 0.45 + 0.25 * k })
    } else {
      const [x, y] = tipPoint(t)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, x, y, 26, C.lilac, 0.25)
      ctx.restore()
    }
    const warm = smoothstep(sp - 0.3, S.sec.end, t)
    return {
      saturation: lerp(0.45, 0.85, warm),
      vignette: 0.55,
      grain: 0.05,
      aberration: 0.6 + 14 * g,
      bloom: 0.8,
      threshold: 0.66,
      exposure: 0.95 + 0.05 * prog(t, 0, 0.4),
    }
  },
}
