/**
 * 20–32 s · The app. The live list sits on the right; three callouts on the
 * left, each with a leader line into the interface (first cut) and a loupe
 * that magnifies the real detail so it can be read (second cut):
 *   01  HTTP: time left, speed and connection count in the info row
 *   02  BitTorrent: the cursor opens Task Details; the Activity tab's piece
 *       map fills on the sixteenth notes
 *   03  Live HLS: "Recording", no progress bar, duration / Live; the leader
 *       carries the stream's segments in while the duration keeps counting
 * Then the whole window: the completion toasts, the torrent turns to seeding,
 * the toasts clear, and the camera pans to the browser.
 */
import { C } from '../brand/palette.js'
import { M3, presence, prog } from '../core/ease.js'
import { fmt } from '../core/text.js'
import { actionPoint, cardLayout } from '../ui/appwindow.js'
import { clickRipple, cursorAt, drawCursor, press } from '../ui/cursor.js'
import { drawDetailDrawer } from '../ui/detail.js'
import { caption, leader, loupe, sideScrim } from './caption.js'
import { backdrop, blueMix, deskAnchors, deskCamera, drawDesk, drawWorld } from './desk.js'
import { taskModel } from './tasks.js'

const CALLS = [
  {
    id: 'call1',
    index: '01',
    title: 'app.c1.title',
    sub: 'app.c1.sub',
    out: (T) => T.ev('info') - 0.35,
    color: C.lilac,
  },
  {
    id: 'call2',
    index: '02',
    title: 'app.c2.title',
    sub: 'app.c2.sub',
    out: (T) => T.ev('drawerOut') - 0.1,
    color: '#82d996',
  },
  {
    id: 'call3',
    index: '03',
    title: 'app.c3.title',
    sub: 'app.c3.sub',
    out: (T) => T.ev('done0') - 0.3,
    color: '#b1c5ff',
  },
]

/** Completion toasts; both clear before the camera leaves for the browser. */
export function toasts(T, s, t, model) {
  const out = prog(t, T.ev('toConnect') - 0.35, 0.25)
  if (out >= 1) return []
  const list = []
  if (t >= T.ev('done0'))
    list.push({ p: prog(t, T.ev('done0'), 0.35), out, text: fmt(s('ui.saved'), { name: model.byId.http.name }) })
  if (t >= T.ev('done1'))
    list.push({ p: prog(t, T.ev('done1'), 0.35), out, text: fmt(s('ui.seedingToast'), { name: model.byId.bt.name }) })
  return list
}

export default {
  id: 'app',
  draw(ctx, S) {
    const { t, T, s } = S
    const cam = deskCamera(T, s, ctx, t)
    const model = taskModel(T, s, t)
    const A = deskAnchors(T, s)
    backdrop(ctx, t, cam, blueMix(T, t))

    const vis = CALLS.map((c) => presence(t, T.ev(c.id), c.out(T), 0.5, 0.35))
    model.byId.http.focus = vis[0].v * 0.8
    model.byId.live.focus = vis[2].v * 0.8

    // Cursor opens Task Details from the torrent's info action.
    const infoAt = T.ev('info')
    const boxes = cardLayout(model.tasks)
    const btIndex = model.tasks.indexOf(model.byId.bt)
    const target = actionPoint(model.byId.bt, boxes[btIndex], 'info')
    const keys = [
      [infoAt - 0.8, [target[0] - 260, target[1] + 200]],
      [infoAt - 0.04, target],
      [infoAt + 0.28, target],
      [infoAt + 0.95, [target[0] + 120, target[1] + 260]],
    ]
    const [kx, ky] = cursorAt(keys, t)
    const cursorAlpha = prog(t, keys[0][0], 0.2) * (1 - prog(t, infoAt + 0.6, 0.3))
    if (t > infoAt - 0.3 && t < T.ev('drawer') + 0.1) model.byId.bt.hot = 'info'

    const drawerLayer = (c, th) =>
      drawDetailDrawer(c, th, S, {
        ...model.bt,
        p: prog(t, T.ev('drawer'), 0.34),
        out: prog(t, T.ev('drawerOut'), 0.26),
      })
    const desk = {
      cam,
      model,
      win: {
        toasts: toasts(T, s, t, model),
        layers: t >= T.ev('drawer') && t < T.ev('drawerOut') + 0.3 ? [drawerLayer] : [],
        glow: 0.18 + 0.05 * T.pulse(t, 'kick', 8),
      },
      browser: t > T.ev('toConnect') - 0.2 ? { popup: { open: 0 }, badge: 0 } : null,
      world: (c) => {
        clickRipple(c, kx, ky, t - infoAt)
        drawCursor(c, kx, ky, cursorAlpha, press(t, infoAt), 1.1)
      },
    }
    drawDesk(ctx, S, desk)
    const view = (c) => drawWorld(c, S, { ...desk, world: null })

    // Callouts
    const scrimK = Math.max(...vis.map((v) => v.v))
    sideScrim(ctx, scrimK, 900)
    const targets = [A.httpInfo, A.graphicEdge, A.liveInfo]
    CALLS.forEach((c, i) => {
      if (vis[i].v <= 0) return
      const bottom = caption(ctx, t, {
        index: c.index,
        title: s(c.title),
        sub: s(c.sub),
        at: T.ev(c.id),
        out: c.out(T),
        y: 330,
        accent: c.color,
      })
      if (bottom == null) return
      const draw = M3.enter(prog(t, T.ev(c.id) + 0.25, 0.6)) * (1 - vis[i].out)
      if (i === 1) {
        leader(ctx, t, cam, [620, bottom - 20], targets[i], { draw, alpha: vis[i].v, color: c.color })
        return
      }
      const rect = { x: 104, y: bottom + 48, w: 440, h: 124 }
      loupe(ctx, view, {
        rect,
        target: targets[i],
        zoom: 2.3,
        k: vis[i].v * M3.enter(prog(t, T.ev(c.id) + 0.2, 0.5)),
        color: c.color,
      })
      // For the live recording, the light on the line carries the stream's segments in.
      leader(ctx, t, cam, [rect.x + rect.w, rect.y + rect.h / 2], targets[i], {
        draw,
        alpha: vis[i].v,
        color: c.color,
        speed: i === 2 ? 0.55 : 0.9,
        label: i === 2 ? (n) => `seg-${1400 + n}.m4s` : null,
        bulge: i === 2 ? 190 : 0,
      })
    })

    const move = Math.sin(Math.PI * prog(t, T.ev('toConnect') - 0.05, T.ev('headA') - 0.1 - T.ev('toConnect') + 0.05))
    return {
      bloom: 0.5,
      threshold: 0.74,
      vignette: 0.32,
      grain: 0.028,
      aberration: 0.6 + 2.5 * move,
      flash: 0.08 * Math.exp(-Math.max(0, t - T.ev('done0')) * 6) * (t >= T.ev('done0') ? 1 : 0),
    }
  },
}
