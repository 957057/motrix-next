/**
 * 32–44 s · Rayburst Connect, the real flow:
 *   extension icon → popup (Sniffer finds three sources, badge counts them)
 *   → the stream row's Download → Media options view: "Inspecting media…",
 *   then Video quality / Audio / Subtitles / Output format → MKV → Download
 *   → "Download created in Rayburst." The camera rides the hand-off across the
 *   desk; the task lands at the top of Rayburst as "Downloading media", named
 *   after the page title. Finally the camera dives into its progress bar,
 *   which turns gold for the engine.
 */
import { C } from '../brand/palette.js'
import { comet, flare, ribbon, shockwave } from '../fx/light.js'
import { glow } from '../core/draw.js'
import { M3, inOutCubic, prog } from '../core/ease.js'
import { clamp, mix } from '../core/math.js'
import { LIST } from '../ui/appwindow.js'
import { alertPoint, browserPoint, popupTargets } from '../ui/browser.js'
import { clickRipple, cursorAt, drawCursor, press } from '../ui/cursor.js'
import { toasts } from './app.js'
import { caption, sideScrim } from './caption.js'
import { backdrop, blueMix, BROWSER_RECT, deskCamera, drawDesk } from './desk.js'
import { taskModel } from './tasks.js'

function cursorKeys(T) {
  const tg = popupTargets()
  const P = (p) => browserPoint(BROWSER_RECT, p)
  const off = (p, dx, dy) => [p[0] + dx, p[1] + dy]
  const ext = P(tg.ext)
  const row = P(tg.rowDownload)
  const fmt = P(tg.format)
  const mkv = P(tg.mkv)
  const dl = P(tg.download)
  const ev = (id) => T.ev(id)
  return [
    [ev('headA') + 0.55, off(ext, -210, 300)],
    [ev('extClick') - 0.03, ext],
    [ev('extClick') + 0.3, off(ext, -30, 60)],
    [ev('select') - 0.5, off(row, -90, 60)],
    [ev('select') - 0.03, row],
    [ev('select') + 0.35, row],
    [ev('formatOpen') - 0.45, off(fmt, 60, 50)],
    [ev('formatOpen') - 0.03, fmt],
    [ev('formatOpen') + 0.2, fmt],
    [ev('pick') - 0.03, mkv],
    [ev('pick') + 0.3, mkv],
    [ev('click') - 0.03, dl],
    [ev('click') + 0.35, dl],
    [ev('beam') + 0.7, off(dl, 150, 140)],
  ]
}

export default {
  id: 'connect',
  draw(ctx, S) {
    const { t, T, s } = S
    const ev = (id) => T.ev(id)
    const cam = deskCamera(T, s, ctx, t)
    const model = taskModel(T, s, t)
    backdrop(ctx, t, cam, blueMix(T, t))

    // Popup state, straight from the timeline.
    const found = ['found1', 'found2', 'found3'].filter((id) => t >= ev(id)).length
    const lastFound = found ? ev(`found${found}`) : 0
    const popup = {
      open: prog(t, ev('popup'), 0.3),
      openAge: t - ev('popup'),
      found,
      rows: [1, 2, 3].map((i) => prog(t, ev(`found${i}`), 0.3)),
      rowHot: prog(t, ev('select') - 0.3, 0.2) * (1 - prog(t, ev('select') + 0.2, 0.1)),
      view: prog(t, ev('select') + 0.05, 0.38),
      ready: prog(t, ev('ready'), 0.3),
      menu: prog(t, ev('formatOpen'), 0.15) * (1 - prog(t, ev('pick') + 0.05, 0.12)),
      mkvHot: prog(t, ev('pick') - 0.25, 0.15),
      format: t >= ev('pick') + 0.05 ? 1 : 0,
      press: prog(t, ev('click'), 0.3),
      formOut: prog(t, ev('click') + 0.08, 0.14),
      confirming: prog(t, ev('click') + 0.08, 0.1) * (1 - prog(t, ev('submitted'), 0.12)),
      submitted: prog(t, ev('submitted'), 0.3),
    }
    const browser = {
      popup,
      badge: found,
      badgeAge: t - lastFound,
      extGlow: Math.exp(-Math.max(0, t - ev('popup')) * 3) * (t >= ev('popup') ? 1 : 0),
      extPress: press(t, ev('extClick')),
    }

    // The incoming task: focus on arrival, gold on the dive.
    const arrive = ev('arrive')
    const inc = model.byId.connect
    inc.focus = Math.exp(-Math.max(0, t - arrive - 0.3) * 0.9) * (t >= arrive ? 1 : 0)
    const gold = M3.standard(prog(t, ev('toEngine'), 0.9))
    if (gold > 0) inc.color = mix('#d9b9ff', C.gold, gold)

    // Cursor
    const keys = cursorKeys(T)
    const [kx, ky] = cursorAt(keys, t)
    const clicks = ['extClick', 'select', 'formatOpen', 'pick', 'click'].map(ev)
    const pr = Math.max(...clicks.map((c) => press(t, c)))
    const cursorAlpha = prog(t, keys[0][0], 0.25) * (1 - prog(t, ev('beam') + 0.4, 0.3))

    // Beam from Download to the top of the task list (world space).
    const from = browserPoint(BROWSER_RECT, alertPoint())
    const to = [LIST.x + 70, LIST.y + 26]
    const path = [from, [from[0] + 260, from[1] - 520], [to[0] - 420, to[1] - 300], to]
    const beamAt = ev('beam')
    const u = inOutCubic(prog(t, beamAt, arrive - beamAt))
    const hit = t >= arrive ? Math.exp(-(t - arrive) * 2.5) : 0

    drawDesk(ctx, S, {
      cam,
      model,
      win: { toasts: toasts(T, s, t, model), glow: 0.2 + 0.35 * hit + 0.5 * gold },
      browser,
      world: (c) => {
        clicks.forEach((at) => clickRipple(c, kx, ky, t - at))
        drawCursor(c, kx, ky, cursorAlpha, pr, 1.1)
        if (t >= beamAt && t < arrive + 0.35) {
          ribbon(c, path, t, {
            reveal: u,
            alpha: 0.55 * (1 - prog(t, arrive, 0.35)),
            width: 34,
            strands: 6,
            seed: 12,
            pulses: false,
            color: '#B9A4FF',
          })
          if (u < 1) comet(c, path, u, { trail: 0.3, size: 1.1 })
        }
        if (t >= arrive) {
          flare(c, to[0], to[1], { intensity: 1.0 * Math.exp(-(t - arrive) * 3), size: 0.6 })
          shockwave(c, to[0], to[1], t - arrive, { speed: 1300, life: 0.7 })
        }
        if (gold > 0) {
          c.save()
          c.globalCompositeOperation = 'lighter'
          const bx = LIST.x + 39 + 1004 * (inc.progress ?? 0)
          const by = LIST.y + 17 + 32 + 18 + 10 + 3
          glow(c, bx, by, 60 + 240 * gold, C.gold, 0.5 * gold)
          c.restore()
        }
      },
    })

    // Captions (left column, as in the app scene)
    const outA = ev('ready') - 0.15
    const outB = ev('toEngine') - 0.1
    const sa = prog(t, ev('headA'), 0.4) * (1 - prog(t, outA, 0.35))
    const sb = prog(t, ev('headB') + 0.5, 0.5) * (1 - prog(t, outB, 0.35))
    sideScrim(ctx, Math.max(sa, sb), 900)
    caption(ctx, t, {
      title: s('connect.headA'),
      sub: s('connect.subA'),
      at: ev('headA'),
      out: outA,
      y: 440,
      accent: '#9CB6FF',
    })
    caption(ctx, t, {
      title: s('connect.headB'),
      sub: s('connect.subB'),
      at: ev('headB') + 0.5,
      out: outB,
      y: 440,
      color: '#EFE6FF',
    })

    const whipIn = Math.sin(Math.PI * clamp((t - ev('toConnect')) / (ev('headA') - 0.1 - ev('toConnect'))))
    const follow = Math.sin(Math.PI * clamp((t - beamAt) / (arrive - beamAt)))
    const dive = prog(t, ev('toEngine') + 0.2, 1.0)
    return {
      bloom: 0.5 + 0.4 * gold,
      threshold: 0.74 - 0.15 * gold,
      tint: [1 + 0.05 * gold, 1, 1.03 - 0.1 * gold],
      flash: 0.16 * hit + 0.5 * dive * dive,
      flashColor: [1, 0.88, 0.62],
      exposure: 1 + 0.25 * dive,
      vignette: 0.32,
      grain: 0.028,
      aberration: 0.6 + 2.5 * whipIn + 1.5 * follow + 3 * hit + 10 * dive,
    }
  },
}
