/**
 * The desk: one continuous world shared by the protocols, app and Connect
 * scenes. The Rayburst window sits at world (0, 0) at 1:1 CSS pixels and the
 * browser to its left, so every move between them is a real camera move, not
 * a cut. The camera track is one list of keys built from timeline events.
 *
 * Framing: the app sits on the right with callouts on the left (the first
 * cut's layout); the camera keeps drifting gently so the frame never goes
 * dead, and every move is eased long enough to follow. The Connect hand-off
 * is a two-shot with both apps in view while the beam crosses.
 */
import { C, THEMES } from '../brand/palette.js'
import { applyCamera, cameraAt, frame, toScreen } from '../core/camera.js'
import { glow } from '../core/draw.js'
import { M3, inCubic, inOutCubic, prog } from '../core/ease.js'
import { drawPlane } from '../core/plane3d.js'
import { clamp, hash2, mixHex, rgba, smoothstep, TAU } from '../core/math.js'
import { createPoint, DIALOG, TEXTAREA } from '../ui/addtask.js'
import { actionPoint, cardLayout, drawAppWindow, WIN } from '../ui/appwindow.js'
import { BROWSER, drawBrowser, POPUP, popupHeight } from '../ui/browser.js'
import { GRAPHIC, graphicHeight } from '../ui/detail.js'
import { BT, taskModel } from './tasks.js'

export const WIN_RECT = { x: 0, y: 0, w: WIN.w, h: WIN.h, r: 12 }
export const BROWSER_RECT = { x: -1500, y: -5, w: BROWSER.w, h: BROWSER.h }

const cache = new Map()
/** Card boxes at a reference time (camera targets stay fixed while badges animate). */
function boxesAt(T, s, t) {
  const key = `${t}`
  if (!cache.has(key)) {
    const m = taskModel(T, s, t)
    cache.set(key, { boxes: cardLayout(m.tasks), tasks: m.tasks })
  }
  return cache.get(key)
}

function mid(b) {
  return b.top + b.h / 2
}

/** World anchors the scenes point at (cards, info rows, the piece map…). */
export function deskAnchors(T, s) {
  const app = boxesAt(T, s, T.ev('window'))
  const late = boxesAt(T, s, T.ev('arrive') + 1)
  const [, http, , bt, , live] = app.boxes
  const bx = http.x + 39
  return {
    http,
    bt,
    live,
    btTask: app.tasks[3],
    // right end of the HTTP card's info row: time left · speed · connections
    httpInfo: [http.x + http.w - 13 - 96, http.top + 17 + 32 + 10 + 6 + 8 + 5],
    // the live card's badge and "duration / Live" line
    liveInfo: [bx + 90, live.top + 17 + 32 + 22],
    graphic: [GRAPHIC.x + GRAPHIC.w / 2, GRAPHIC.y + graphicHeight(BT.atoms) / 2],
    graphicEdge: [GRAPHIC.x - 6, GRAPHIC.y + graphicHeight(BT.atoms) / 2],
    newCard: late.boxes[0],
  }
}

/** Every camera key of the desk, in seconds. */
export function deskKeys(T, s, ctx) {
  const ev = (id) => T.ev(id)
  const A = deskAnchors(T, s)
  const ta = [TEXTAREA.x + TEXTAREA.w / 2, TEXTAREA.y + TEXTAREA.h / 2]
  const dlg = [DIALOG.x + DIALOG.w / 2, DIALOG.y + DIALOG.h / 2]
  const whole = [WIN.w / 2, WIN.h / 2]
  const pop = [BROWSER_RECT.x + POPUP.x + POPUP.w / 2, BROWSER_RECT.y + POPUP.y]
  const create = createPoint(ctx, s)
  const nc = A.newCard
  const bar = [nc.x + 39 + 1004 * 0.16, nc.top + 17 + 32 + 18 + 10 + 3]
  const info = actionPoint(A.btTask, A.bt, 'info')
  return [
    // protocols: swoop in from the dark onto the URL box (dialog on the right)
    { t: ev('collapse'), cam: frame(dlg, 0.3, [1160, 560], -0.14) },
    { t: ev('dialog') + 0.06, cam: frame(ta, 1.62, [1290, 430]), ease: M3.emphasized },
    { t: ev('line4') + 0.45, cam: frame([ta[0] + 10, ta[1] + 4], 1.68, [1290, 430]) },
    { t: ev('create') - 0.55, cam: frame([dlg[0] + (create[0] - dlg[0]) * 0.25, dlg[1]], 1.2, [1140, 520]) },
    { t: ev('spawn') + 0.1, cam: frame([dlg[0] + (create[0] - dlg[0]) * 0.25, dlg[1] + 6], 1.22, [1140, 520]) },
    // the list fills, then settles to the right: room for callouts on the left
    { t: ev('card4') + 0.9, cam: frame(whole, 1.08, [1060, 545]), ease: M3.emphasized },
    { t: ev('window') + 0.3, cam: frame([728, mid(A.http)], 1.16, [1180, 430]), ease: inOutCubic },
    { t: ev('info') - 0.55, cam: frame([744, mid(A.http) + 4], 1.2, [1180, 430]) },
    { t: ev('info') - 0.1, cam: frame([info[0] - 275, mid(A.bt)], 1.16, [1260, 470]), ease: inOutCubic },
    // Task Details: the whole drawer on the right, the dimmed list behind the callout
    { t: ev('drawer') + 0.85, cam: frame([WIN.w, WIN.h / 2], 1.28, [1872, 545]), ease: M3.emphasized },
    { t: ev('drawerOut') - 0.1, cam: frame([WIN.w - 6, WIN.h / 2 - 4], 1.32, [1872, 545]) },
    { t: ev('call3') - 0.05, cam: frame([728, mid(A.live)], 1.16, [1180, 560]), ease: inOutCubic },
    { t: ev('done0') - 0.35, cam: frame([744, mid(A.live)], 1.21, [1180, 560]) },
    { t: ev('done0') + 0.45, cam: frame(whole, 1.06, [960, 545]), ease: M3.emphasized },
    { t: ev('toConnect') - 0.05, cam: frame([whole[0] - 8, whole[1]], 1.09, [960, 545]) },
    // Connect: a smooth pan across the desk to the browser, then into the popup
    {
      t: ev('headA') - 0.1,
      cam: frame([BROWSER_RECT.x + BROWSER.w / 2, BROWSER_RECT.y + BROWSER.h / 2], 0.98, [1260, 585]),
      ease: inOutCubic,
    },
    {
      t: ev('extClick') - 0.1,
      cam: frame([BROWSER_RECT.x + BROWSER.w / 2 + 20, BROWSER_RECT.y + BROWSER.h / 2], 1.02, [1260, 585]),
    },
    { t: ev('found1') - 0.1, cam: frame([pop[0], pop[1] + 205], 1.6, [1150, 460]), ease: M3.emphasized },
    { t: ev('select') - 0.05, cam: frame([pop[0], pop[1] + 215], 1.62, [1150, 460]) },
    { t: ev('ready') + 0.1, cam: frame([pop[0], pop[1] + popupHeight(1) / 2], 1.5, [1150, 540]), ease: M3.emphasized },
    { t: ev('submitted') + 0.12, cam: frame([pop[0], pop[1] + 220], 1.56, [1150, 470]), ease: M3.emphasized },
    // two-shot: both apps in view while the hand-off crosses the desk
    { t: ev('beam') + 0.55, cam: frame([190, 330], 0.8, [960, 520]), ease: inOutCubic },
    { t: ev('arrive') + 0.15, cam: frame([230, 320], 0.84, [960, 520]) },
    { t: ev('headB') + 0.9, cam: frame([728, 250], 1.2, [1180, 470]), ease: M3.emphasized },
    { t: ev('toEngine') - 0.3, cam: frame([740, 250], 1.27, [1180, 470]) },
    // dive into the new task's progress bar; the gold iris opens from there
    { t: ev('gold') + 0.06, cam: frame(bar, 9, [1330, 540]), ease: inCubic },
  ]
}

/** Backdrop hue: violet over the app, blue-violet once the camera reaches the browser. */
export function blueMix(T, t) {
  return smoothstep(T.ev('toConnect'), T.ev('headA') - 0.1, t)
}

/** Camera at time t (with an almost imperceptible handheld drift). */
export function deskCamera(T, s, ctx, t) {
  const cam = cameraAt(deskKeys(T, s, ctx), t)
  cam.dx = Math.sin(t * 0.7) * 1.4
  cam.dy = Math.cos(t * 0.53) * 1.1
  return cam
}

/** Parallax backdrop: violet for the app, blue-violet electric for the browser. */
export function backdrop(ctx, t, cam, blue = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080)
  g.addColorStop(0, mixHex(C.ink1, '#07061A', blue))
  g.addColorStop(1, C.ink0)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1920, 1080)
  const par = (wx, wy, k) => [960 + (wx - cam.x) * cam.zoom * k, 540 + (wy - cam.y) * cam.zoom * k]
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const blobs = [
    [900, 300, 1100, mixHex(C.violet800, '#2B3FB8', blue), 0.42],
    [-200, 900, 900, C.violet800, 0.36],
    [-1400, 200, 1000, mixHex(C.violet700, '#3A2AA0', blue), 0.3 + 0.1 * blue],
    [1600, 900, 800, C.violet700, 0.18],
  ]
  for (const [wx, wy, r, col, a] of blobs) {
    const [x, y] = par(wx, wy, 0.18)
    glow(ctx, x, y, r * Math.max(0.6, Math.min(1.6, cam.zoom)), col, a)
  }
  for (let i = 0; i < 120; i++) {
    const depth = 0.25 + hash2(71, i) * 0.5
    const wx = (hash2(72, i) - 0.5) * 5200 - 500
    const wy = (hash2(73, i) - 0.5) * 2600 + 400 + Math.sin(t * 0.3 + i) * 20
    const [x, y] = par(wx, wy, depth)
    if (x < -20 || x > 1940 || y < -20 || y > 1100) continue
    const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + hash2(74, i) * 2) + i)
    ctx.fillStyle = rgba(blue > 0.5 ? '#CFE0FF' : '#E6DAFF', (0.08 + 0.3 * tw) * depth)
    ctx.beginPath()
    ctx.arc(x, y, 0.8 + depth * 2.2 * Math.min(2, cam.zoom), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Perspective tilt of the whole desk during the swoop and the big pans
 * (radians). Always back to exactly zero before anything has to be read.
 */
export function deskTilt(T, t) {
  const ev = (id) => T.ev(id)
  const bump = (a, b) => Math.sin(Math.PI * prog(t, a, b - a))
  const swoop = prog(t, ev('collapse'), ev('dialog') + 0.06 - ev('collapse'))
  const land = swoop < 1 ? (1 - swoop) * (1 - swoop) : 0
  return {
    rx: 0.24 * land,
    ry:
      0.62 * land -
      0.1 * bump(ev('toConnect') - 0.05, ev('headA') - 0.1) +
      0.08 * bump(ev('submitted') + 0.12, ev('beam') + 0.55),
  }
}

/** The world content (window, browser, extras), without the camera. */
export function drawWorld(ctx, S, o) {
  const winAlpha = clamp(o.win?.alpha ?? 1)
  if (winAlpha > 0) {
    ctx.save()
    ctx.globalAlpha *= winAlpha
    const glowK = o.win?.glow ?? 0.2
    if (glowK > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, WIN.w / 2, WIN.h / 2, 1000, C.violet, glowK)
      ctx.restore()
    }
    drawAppWindow(
      ctx,
      WIN_RECT,
      {
        theme: THEMES.dark,
        tasks: o.model.tasks,
        counts: o.model.counts,
        speed: o.model.speed,
        toasts: o.win?.toasts,
        layers: o.win?.layers,
        shadow: 1,
      },
      S,
    )
    ctx.restore()
  }
  if (o.browser) drawBrowser(ctx, BROWSER_RECT, S, o.browser)
  o.world?.(ctx)
}

/**
 * Draw the desk under the camera; tilted in perspective while moving.
 * o: { cam, model, win: {toasts, layers, alpha, glow}, browser, world: fn(ctx), tilt }
 */
export function drawDesk(ctx, S, o) {
  const tilt = o.tilt ?? deskTilt(S.T, S.t)
  const flat = (c) => {
    c.save()
    applyCamera(c, o.cam)
    drawWorld(c, S, o)
    c.restore()
  }
  if (Math.abs(tilt.rx) > 1e-3 || Math.abs(tilt.ry) > 1e-3) {
    drawPlane(ctx, { x: 960, y: 540, w: 1920, h: 1080, rx: tilt.rx, ry: tilt.ry, persp: 1900 }, flat)
    return
  }
  flat(ctx)
}

export { toScreen }
