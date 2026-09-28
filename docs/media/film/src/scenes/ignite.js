/**
 * 4–8 s · Ignition. The spark leaves the progress bar and flies to the point
 * where the logo's rays converge. Three rays trace the mark outward, light
 * ribbons and particles are drawn in, then everything holds its breath for
 * the drop.
 */
import { C } from '../brand/palette.js'
import { drawLogo, traceLogo } from '../brand/logo.js'
import { night } from '../fx/background.js'
import { comet, flare, ribbon } from '../fx/light.js'
import { outCubic, prog, inOutCubic } from '../core/ease.js'
import { clamp, hash2, lerp, rgba, smoothstep, TAU } from '../core/math.js'
import { BURST_ORIGIN, LOGO_BURST } from './layout.js'
import { drawWaitLayer, tipPoint } from './wait.js'

// Trace order: tall ray, short ray, lightning, lower ray, then the highlight.
const TRACE_DELAY = [0.45, 0.14, 0, 0.3, 0.85]
const TRACE_DUR = 1.15

const RIBBONS = [
  [[-200, 1180], [200, 900], [150, 820], null],
  [[-240, 420], [140, 520], [260, 760], null],
  [[900, 1260], [700, 1000], [560, 820], null],
  [[1100, -120], [800, 200], [520, 560], null],
  [[2100, 980], [1400, 900], [700, 820], null],
]

export default {
  id: 'ignite',
  draw(ctx, S) {
    const { t, T } = S
    const t0 = S.sec.start
    const end = S.sec.end
    const hush = T.ev('hush')
    const energy = smoothstep(t0, hush, t)
    const [ox, oy] = BURST_ORIGIN

    night(ctx, t, { intensity: lerp(0.35, 1.0, energy), dust: 0.6 + energy })

    // Camera: push towards the origin, then snap back just before the drop.
    const zoom = 1 + 0.1 * smoothstep(t0, hush - 0.2, t) - 0.1 * smoothstep(hush - 0.2, end, t)
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(zoom, zoom)
    ctx.translate(-ox, -oy)

    drawWaitLayer(ctx, S, prog(t, t0, 0.7))

    // Spark flight from the bar tip to the convergence point.
    const tip = tipPoint(t0)
    const path = [tip, [tip[0] + 60, tip[1] - 260], [ox - 220, oy - 200], [ox, oy]]
    const fly = inOutCubic(prog(t, T.ev('travel'), 1.0))
    if (fly < 1) comet(ctx, path, Math.max(0.02, fly), { trail: 0.35, size: 0.9 })

    // Ribbons converge into the origin.
    RIBBONS.forEach((r, i) => {
      const reveal = outCubic(prog(t, t0 + 0.8 + i * 0.12, 1.6))
      ribbon(ctx, [r[0], r[1], r[2], [ox, oy]], t, {
        reveal,
        alpha: 0.25 + 0.5 * energy,
        width: 70,
        strands: 8,
        seed: i + 1,
        flow: 0.4 + energy,
        color: i % 2 ? C.lilac : C.seed,
      })
    })

    // Particles pulled inward.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    const pull = smoothstep(t0 + 1, hush, t)
    for (let i = 0; i < 140; i++) {
      const ang = hash2(5, i) * TAU
      const R = 500 + hash2(6, i) * 700
      const ph = (t * (0.6 + hash2(7, i) * 0.8) + hash2(8, i)) % 1
      const r = R * Math.pow(1 - ph, 1.6)
      const x = ox + Math.cos(ang) * r
      const y = oy + Math.sin(ang) * r
      const len = 10 + 60 * ph * pull
      const a = pull * Math.sin(Math.PI * ph) * 0.8
      ctx.strokeStyle = rgba(i % 3 ? '#E7D6FF' : C.lilac, a)
      ctx.lineWidth = 1.2 + hash2(9, i) * 1.5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len)
      ctx.stroke()
    }
    ctx.restore()

    // The mark: faint body plus bright traced outlines.
    const tr = T.ev('trace')
    const contract = 1 - 0.06 * smoothstep(hush - 0.15, end, t)
    const logo = { ...LOGO_BURST, size: LOGO_BURST.size * contract }
    drawLogo(ctx, { ...logo, alpha: 0.34 * smoothstep(tr + 0.4, hush, t) })
    traceLogo(ctx, {
      ...logo,
      width: 3.2,
      alpha: 0.9 + 0.1 * Math.sin(t * 30),
      progress: (i) => outCubic(prog(t, tr + TRACE_DELAY[i], TRACE_DUR)),
    })

    // Origin light swells with the riser and dips in the hush.
    const swell =
      clamp(smoothstep(T.ev('travel') + 0.9, hush, t) * 1.2 + 0.2 * (fly >= 1)) * (1 - 0.85 * smoothstep(hush, end, t))
    if (fly >= 0.98) flare(ctx, ox, oy, { intensity: swell, size: 0.6 + 0.6 * swell })
    ctx.restore()

    return {
      saturation: lerp(0.85, 1.05, energy),
      bloom: 0.9 + 0.5 * energy,
      threshold: 0.52,
      aberration: 0.6 + 2.5 * energy,
      vignette: lerp(0.5, 0.38, energy),
      grain: 0.04,
      exposure: 1 - 0.45 * smoothstep(hush, end, t),
    }
  },
}
