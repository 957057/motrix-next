/**
 * 56–66 s · End card. The logo bursts once more, then wordmark, slogan,
 * platforms, website and the browser extension line settle and hold. The film
 * ends on this card.
 */
import { C } from '../brand/palette.js'
import { night } from '../fx/background.js'
import { ribbon } from '../fx/light.js'
import { prog } from '../core/ease.js'
import { clamp, lerp } from '../core/math.js'
import { reveal } from '../core/text.js'
import { logoBurst } from './burst.js'
import { LOGO_OUTRO } from './layout.js'

export default {
  id: 'outro',
  draw(ctx, S) {
    const { t, T, s } = S
    const drop = T.ev('drop2')
    const lt = t - drop
    night(ctx, t, { intensity: 1.05, dust: 1 })
    ribbon(
      ctx,
      [
        [-200, 1000],
        [600, 820],
        [1300, 1040],
        [2100, 860],
      ],
      t,
      { alpha: 0.28, width: 130, strands: 12, seed: 21, color: C.violet400 },
    )

    const push = 1 + 0.04 * clamp(lt / 10)
    ctx.save()
    ctx.translate(960, 560)
    ctx.scale(push, push)
    ctx.translate(-960, -560)

    logoBurst(ctx, S, { ...LOGO_OUTRO, at: drop, freq: 1.3, yaw: 0.85, seed: 29, sheenAt: T.ev('final') })

    const wm = ctx.createLinearGradient(0, 600, 0, 720)
    wm.addColorStop(0, '#FFFFFF')
    wm.addColorStop(1, '#E4D7FA')
    reveal(
      ctx,
      'Rayburst',
      960,
      708,
      { size: 150, weight: 800, tracking: -0.04, color: wm, align: 'center' },
      t - T.ev('outroWord'),
      {
        mode: 'mask',
        split: 'chars',
        stagger: 0.035,
        dur: 0.75,
      },
    )
    reveal(
      ctx,
      s('slogan'),
      960,
      784,
      { size: 40, weight: 500, color: '#CDBDF0', align: 'center' },
      t - T.ev('outroSlogan'),
      {
        stagger: 0.05,
        dur: 0.7,
      },
    )
    reveal(
      ctx,
      s('outro.platforms'),
      960,
      872,
      { size: 28, weight: 600, tracking: 0.04, color: C.dim, align: 'center' },
      t - T.ev('outroPlatforms'),
      {
        dur: 0.7,
        stagger: 0.06,
      },
    )
    reveal(
      ctx,
      s('outro.url'),
      960,
      930,
      { size: 34, weight: 700, color: C.lilac200, align: 'center' },
      t - T.ev('outroUrl'),
      {
        mode: 'mask',
        dur: 0.6,
      },
    )
    reveal(
      ctx,
      s('outro.connect'),
      960,
      1008,
      { size: 22, weight: 500, color: C.faint, align: 'center' },
      t - T.ev('outroUrl') - 0.5,
      {
        dur: 0.7,
      },
    )
    ctx.restore()

    const fl = Math.exp(-Math.max(0, lt) * 6)
    return {
      flash: 1.1 * fl,
      flashColor: [1, 0.9, 1],
      bloom: lerp(0.55, 1.4, Math.exp(-Math.max(0, lt) * 1.6)),
      threshold: lerp(0.56, 0.72, clamp((lt - 0.6) / 1.4)),
      aberration: 0.6 + 16 * Math.exp(-Math.max(0, lt) * 7),
      vignette: 0.36 + 0.08 * prog(t, S.sec.end - 2, 2),
      grain: 0.03,
    }
  },
}
