/**
 * 8–12 s · Burst. On the drop the traced mark becomes the solid crystal logo,
 * spinning into its flat master pose while light shafts fire from the point
 * where the rays converge. Wordmark and slogan land beside it. In the last
 * half second the camera dives into that convergence point and punches
 * through to the protocol slams.
 */
import { C } from '../brand/palette.js'
import { drawLogo3D, originOnScreen } from '../brand/logo.js'
import { night } from '../fx/background.js'
import { flare, godRays, shockwave, sparks } from '../fx/light.js'
import { fillRR, glow } from '../core/draw.js'
import { inCubic, M3, prog, spring, tw } from '../core/ease.js'
import { clamp, lerp } from '../core/math.js'
import { reveal, wrap } from '../core/text.js'
import { BURST_ORIGIN, LOGO_BURST } from './layout.js'

/** Shared by the outro: logo + light burst anchored on the logo centre. */
export function logoBurst(ctx, S, o) {
  const { t, T } = S
  const lt = t - o.at
  const sp = spring(lt, { freq: o.freq ?? 1.05, damping: 0.62 })
  const size = o.size * (1 + 0.22 * (1 - sp))
  const [ox, oy] = originOnScreen(o.x, o.y, size)
  const pulse = T.pulse(t, 'kick', 7)
  godRays(ctx, ox, oy, t, { intensity: 1.7 * Math.exp(-lt * 1.4) + 0.5 + 0.12 * pulse, length: 2400 })
  shockwave(ctx, ox, oy, lt, { speed: 2800, life: 1.0 })
  shockwave(ctx, ox, oy, lt - 0.12, { speed: 1700, life: 0.8, width: 10 })
  sparks(ctx, ox, oy, lt, { count: 320, speed: 1900, life: 1.8, seed: o.seed ?? 9 })
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, o.x, o.y, size * 0.9, C.violet, 0.22 + 0.1 * pulse)
  ctx.restore()
  drawLogo3D(ctx, {
    x: o.x,
    y: o.y,
    size,
    depth: 48,
    yaw: (o.yaw ?? -0.95) * (1 - sp),
    pitch: 0.35 * (1 - sp),
    rim: 0.9 * (1 - sp) + 0.08,
    sheen: o.sheenAt != null ? (t - o.sheenAt) / 1.1 : null,
    sheenAlpha: 0.45,
  })
  flare(ctx, ox, oy, { intensity: 1.3 * Math.exp(-lt * 2.2) + 0.35 + 0.1 * pulse, size: 0.9 })
  return lt
}

export default {
  id: 'burst',
  draw(ctx, S) {
    const { t, T, s } = S
    const drop = T.ev('drop')
    const lt = t - drop
    night(ctx, t, { intensity: 1.15, dust: 1.2 })

    const push = 1 + 0.025 * clamp(lt / 4)
    const dive = T.ev('dive')
    const dk = prog(t, dive, S.sec.end - dive)
    const zoom = Math.pow(28, inCubic(dk))
    const [ox, oy] = BURST_ORIGIN
    const m = M3.standard(dk)
    ctx.save()
    ctx.translate(960, 540)
    ctx.scale(push, push)
    ctx.translate(-960, -540)
    ctx.translate(ox + (960 - ox) * m, oy + (540 - oy) * m)
    ctx.scale(zoom, zoom)
    ctx.translate(-ox, -oy)
    const exit = t >= dive ? t - dive : null

    logoBurst(ctx, S, { ...LOGO_BURST, at: drop, sheenAt: drop + 1.1 })

    const tx = 882
    const wm = ctx.createLinearGradient(0, 470, 0, 600)
    wm.addColorStop(0, '#FFFFFF')
    wm.addColorStop(1, '#E4D7FA')
    reveal(ctx, 'Rayburst', tx, 592, { size: 172, weight: 800, tracking: -0.04, color: wm }, t - T.ev('wordmark'), {
      mode: 'mask',
      split: 'chars',
      stagger: 0.035,
      dur: 0.75,
      exit,
      exitDur: 0.3,
    })
    // Two lines at most, like the approved banner.
    const sloganOpts = { size: 46, weight: 500, color: '#CDBDF0' }
    const lines = wrap(ctx, s('slogan'), 700, sloganOpts)
    lines.forEach((line, i) => {
      reveal(ctx, line, tx + 6, 672 + i * 58, sloganOpts, t - T.ev('slogan') - i * 0.12, {
        stagger: 0.05,
        dur: 0.7,
        exit,
        exitDur: 0.3,
      })
    })
    const bar = tw(t, T.ev('slogan') + 0.3, 0.8) * (1 - prog(t, dive, 0.25))
    if (bar > 0) fillRR(ctx, tx + 8, 672 + (lines.length - 1) * 58 + 46, 96 * bar, 5, 2.5, C.violet400)
    ctx.restore()

    const settle = clamp((lt - 0.6) / 1.4)
    return {
      flash: 1.25 * Math.exp(-Math.max(0, lt) * 6) + 1.1 * dk * dk * dk,
      flashColor: [1, 0.9, 1],
      bloom: lerp(0.55, 1.5, Math.exp(-Math.max(0, lt) * 1.8)) + 0.6 * dk,
      threshold: lerp(0.55, 0.72, settle) - 0.2 * dk,
      aberration: 0.6 + 16 * Math.exp(-Math.max(0, lt) * 7) + 14 * dk * dk,
      exposure: 1 + 0.4 * dk * dk,
      vignette: 0.34,
      saturation: 1.05,
      grain: 0.03,
    }
  },
}
