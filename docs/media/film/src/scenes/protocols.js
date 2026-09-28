/**
 * 12–20 s · Every protocol, one box.
 *
 * 12–15 s  Six protocol slams, one per beat: each name hits from depth, holds
 *          for a beat with its real link typing out underneath, then blows
 *          past the camera as the next one lands. Colours are the app's own
 *          colour-scheme seeds.
 * 15–18 s  The camera swoops out of the dark onto Rayburst's New Task dialog;
 *          the links fly in and land one per line in the URL box (one task
 *          URL per line, as the real placeholder says). Create is clicked.
 * 18–20 s  The dialog closes and five tasks drop into the list on sixteenths.
 */
import { C } from '../brand/palette.js'
import { shake, toScreen } from '../core/camera.js'
import { glow } from '../core/draw.js'
import { M3, inCubic, outExpo, prog } from '../core/ease.js'
import { clamp, hash2, lerp, mix, mixHex, rgba, TAU } from '../core/math.js'
import { fit, measure, text } from '../core/text.js'
import { createPoint, drawAddTask, lineBaseline, TEXTAREA } from '../ui/addtask.js'
import { clickRipple, cursorAt, drawCursor, press } from '../ui/cursor.js'
import { caption, sideScrim } from './caption.js'
import { backdrop, deskCamera, drawDesk } from './desk.js'
import { LINKS, taskModel } from './tasks.js'

const SLAMS = [
  { key: 'proto.http', kicker: 'proto.k.files', sample: LINKS[0], color: '#9E74D5', line: 0, rot: -0.018 },
  { key: 'proto.sftp', kicker: 'proto.k.files', sample: LINKS[1], color: '#4A6CF7', line: 1, rot: 0.014 },
  {
    key: 'proto.bt',
    kicker: 'proto.k.p2p',
    sample: 'bbb_sunflower_2160p_60fps.torrent',
    color: '#10B981',
    line: null,
    rot: -0.01,
  },
  { key: 'proto.magnet', kicker: 'proto.k.p2p', sample: LINKS[2], color: '#F43F5E', line: 2, rot: 0.018 },
  { key: 'proto.ed2k', kicker: 'proto.k.p2p', sample: LINKS[3], color: '#E0A422', line: 3, rot: -0.014 },
  { key: 'proto.media', kicker: 'proto.k.streams', sample: LINKS[4], color: '#06B6D4', line: 4, rot: 0 },
]
const HOLD = 0.5
const ENTER = 0.13
const PAST = 0.11
const LEAD = 0.035

/** Background colour crossfades from one slam to the next (no hard switch). */
function slamColor(T, t) {
  let col = SLAMS[0].color
  for (let i = 1; i < SLAMS.length; i++) {
    const at = T.ev(`slam${i}`) - 0.12
    if (t >= at) col = mixHex(SLAMS[i - 1].color, SLAMS[i].color, clamp((t - at) / 0.24))
    if (t >= at + 0.24) col = SLAMS[i].color
  }
  return col
}

function energy(T, t) {
  let e = 0
  for (let i = 0; i < SLAMS.length; i++) {
    const d = t - T.ev(`slam${i}`)
    if (d >= 0) e = Math.max(e, Math.exp(-d * 6))
  }
  return e
}

/** Hyperspace streaks radiating from the centre. */
function warp(ctx, t, col, k) {
  if (k <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let i = 0; i < 170; i++) {
    const a = hash2(3, i) * TAU
    const speed = 0.8 + hash2(4, i) * 1.6
    const ph = (t * speed * 0.9 + hash2(5, i)) % 1
    const r0 = 80 + Math.pow(ph, 2.2) * 1500
    const len = (30 + 380 * ph) * k
    const x0 = 960 + Math.cos(a) * r0
    const y0 = 540 + Math.sin(a) * r0 * 0.78
    ctx.strokeStyle = rgba(i % 4 ? col : '#FFFFFF', (0.12 + 0.35 * ph) * k)
    ctx.lineWidth = 1 + 2.4 * ph
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len * 0.78)
    ctx.stroke()
  }
  ctx.restore()
}

/** The part of a link before its payload, tinted with the slam colour. */
function schemeSplit(str) {
  const m = /^([a-z0-9]+:(?:\/\/|\?)?)/i.exec(str)
  return m ? [m[1], str.slice(m[1].length)] : ['', str]
}

function drawSlam(ctx, S, i, u, exitAt) {
  const sl = SLAMS[i]
  const s = S.s
  let scale
  let alpha = 1
  if (u < 0) {
    const k = outExpo(clamp((u + ENTER) / ENTER))
    scale = lerp(0.62, 1, k)
    alpha = clamp(k * 1.4)
  } else if (u < exitAt - LEAD) {
    scale = 1 + 0.06 * (u / HOLD)
  } else {
    // Blow past the camera just before the next hit lands.
    const k = inCubic(clamp((u - exitAt + LEAD) / PAST))
    scale = (1 + 0.06 * ((exitAt - LEAD) / HOLD)) * (1 + 0.55 * k)
    alpha = (1 - k) * (1 - k)
  }
  const leaving = u >= exitAt - LEAD
  if (alpha <= 0) return
  const word = s(sl.key)
  const bigO = { size: 300, weight: 800, tracking: -0.045 }
  const size = fit(ctx, word, 1560, bigO)
  const o = { ...bigO, size }

  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(960, 560)
  ctx.rotate(sl.rot)
  ctx.scale(scale, scale)
  ctx.translate(-960, -560)

  // Accent echo behind the word (depth ghost).
  const echo = 1.14 + 0.1 * clamp(u / HOLD)
  ctx.save()
  ctx.globalAlpha *= leaving ? 0 : 1
  ctx.translate(960, 560)
  ctx.scale(echo, echo)
  ctx.translate(-960, -560)
  text(ctx, word, 960, 560 + size * 0.34, {
    ...o,
    align: 'center',
    color: null,
    stroke: { width: 2, color: rgba(sl.color, 0.28) },
  })
  ctx.restore()

  const g = ctx.createLinearGradient(0, 560 - size * 0.4, 0, 560 + size * 0.4)
  g.addColorStop(0, '#FFFFFF')
  g.addColorStop(1, mix('#FFFFFF', sl.color, 0.45))
  text(ctx, word, 960, 560 + size * 0.34, { ...o, align: 'center', color: g })

  // Kicker: index and family.
  const kick = `0${i + 1}  ·  ${s(sl.kicker).toUpperCase()}`
  text(ctx, kick, 960, 560 - size * 0.52 - 18, {
    size: 24,
    weight: 700,
    tracking: 0.18,
    color: mix('#FFFFFF', sl.color, 0.55),
    align: 'center',
  })

  // The real link types out underneath.
  const monoO = { size: 27, weight: 500, fam: 'mono' }
  const typed = clamp((u + 0.04) / 0.3)
  const chars = [...sl.sample]
  const shown = chars.slice(0, Math.ceil(chars.length * typed)).join('')
  const [scheme, rest] = schemeSplit(shown)
  const full = measure(ctx, sl.sample, monoO)
  const scale2 = Math.min(1, 1500 / full)
  const mo = { ...monoO, size: 27 * scale2 }
  const x0 = 960 - (full * scale2) / 2
  const w1 = text(ctx, scheme, x0, 560 + size * 0.34 + 86, { ...mo, color: mix('#FFFFFF', sl.color, 0.7) })
  text(ctx, rest, x0 + w1, 560 + size * 0.34 + 86, { ...mo, color: 'rgba(236,230,244,0.82)' })
  ctx.restore()
}

export default {
  id: 'protocols',
  draw(ctx, S) {
    const { t, T, s } = S
    const collapse = T.ev('collapse')
    const dialog = T.ev('dialog')
    const col = slamColor(T, t)
    const e = energy(T, t)

    // ── Desk (from the collapse on) ──
    const deskIn = M3.enter(prog(t, collapse, dialog - collapse + 0.1))
    const cam = deskCamera(T, s, ctx, t)
    const model = taskModel(T, s, t)
    const createAt = T.ev('create')
    const spawn = T.ev('spawn')

    if (t < collapse + 0.6) {
      // Montage backdrop: ink with a colour bloom that changes on every slam.
      ctx.fillStyle = C.ink0
      ctx.fillRect(0, 0, 1920, 1080)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, 960, 560, 1100, col, 0.26 + 0.12 * e)
      glow(ctx, 960, 560, 420, mixHex(col, '#FFFFFF', 0.3), 0.1 + 0.1 * e)
      ctx.restore()
      warp(ctx, t, col, 0.32 + 0.22 * e)
    }
    if (deskIn > 0) {
      ctx.save()
      ctx.globalAlpha *= deskIn
      backdrop(ctx, t, cam, 0)
      ctx.restore()
    }

    // Slams (screen space, shaken by each hit).
    if (t < collapse + PAST + 0.05) {
      const sh = shake(T, t, 0.35)
      ctx.save()
      ctx.translate(sh.dx, sh.dy)
      for (let i = 0; i < SLAMS.length; i++) {
        const at = T.ev(`slam${i}`)
        const u = t - at
        const next = i < SLAMS.length - 1 ? T.ev(`slam${i + 1}`) : collapse
        const exitAt = next - at
        if (u < -ENTER || u > exitAt - LEAD + PAST) continue
        drawSlam(ctx, S, i, u, exitAt)
      }
      ctx.restore()
    }

    if (deskIn > 0) {
      const lines = SLAMS.filter((sl) => sl.line != null).map((sl) => {
        const land = T.ev(`line${sl.line}`)
        return { text: LINKS[sl.line], k: prog(t, land, 0.12), flash: t >= land ? Math.exp(-(t - land) * 4) : 0 }
      })
      const leave = prog(t, spawn, 0.22)
      const cp = createPoint(ctx, s)
      const hoverAt = createAt - 0.5
      const dialogLayer = (c, th) =>
        drawAddTask(c, th, S, {
          open: 1,
          leave,
          lines,
          caret: t > T.ev('line0') && t < createAt,
          press: prog(t, createAt, 0.3),
          hover: prog(t, hoverAt + 0.25, 0.2) * (1 - leave),
        })
      // Cursor path in window space: in from the lower right, onto Create, away.
      const keys = [
        [createAt - 1.05, [cp[0] + 280, cp[1] + 190]],
        [hoverAt + 0.3, [cp[0] + 6, cp[1] + 4]],
        [createAt + 0.05, [cp[0] + 4, cp[1] + 2]],
        [spawn + 0.7, [cp[0] + 170, cp[1] + 260]],
      ]
      const [kx, ky] = cursorAt(keys, t)
      const cursorAlpha = prog(t, keys[0][0], 0.25) * (1 - prog(t, spawn + 0.35, 0.3))
      ctx.save()
      ctx.globalAlpha *= deskIn
      drawDesk(ctx, S, {
        cam,
        model,
        win: { layers: leave < 1 ? [dialogLayer] : [], glow: 0.16 + 0.1 * T.pulse(t, 'kick', 8) },
        world: (c) => {
          clickRipple(c, kx, ky, t - createAt)
          drawCursor(c, kx, ky, cursorAlpha, press(t, createAt), 1.1)
        },
      })
      ctx.restore()

      // Links in flight: from the middle of the frame to their line in the box.
      SLAMS.forEach((sl) => {
        if (sl.line == null) return
        const land = T.ev(`line${sl.line}`)
        const start = land - 0.42
        const u = prog(t, start, land - start)
        if (u <= 0 || u >= 1) return
        const k = M3.emphasized(u)
        const lcam = deskCamera(T, s, ctx, land)
        const [tx, ty] = toScreen(lcam, [TEXTAREA.x + 12, lineBaseline(sl.line)])
        const fromX = 960 - 520 + sl.line * 40
        const fromY = 700 + sl.line * 30
        const x = lerp(fromX, tx, k)
        const y = lerp(fromY, ty, k)
        const sz = lerp(30, 14 * lcam.zoom, k)
        ctx.save()
        ctx.globalAlpha *= clamp(u * 4) * (1 - 0.3 * k)
        ctx.globalCompositeOperation = 'lighter'
        const w = measure(ctx, LINKS[sl.line], { size: sz })
        glow(ctx, x + w * 0.5, y - sz * 0.35, Math.max(80, w * 0.35), sl.color, 0.25)
        ctx.restore()
        text(ctx, LINKS[sl.line], x, y, { size: sz, color: mix('#FFFFFF', sl.color, 0.25), alpha: clamp(u * 4) })
      })
    }

    // Caption beside the dialog shot.
    const headAt = T.ev('protoHead')
    if (t >= headAt) {
      const vis = prog(t, headAt, 0.4) * (1 - prog(t, createAt - 0.25, 0.3))
      sideScrim(ctx, vis, 820)
      caption(ctx, t, {
        title: s('proto.head'),
        sub: s('proto.sub'),
        at: headAt,
        out: createAt - 0.25,
        y: 450,
        size: 50,
        maxWidth: 590,
      })
    }

    // Hit flashes and aberration pulses ride the slams.
    const last = SLAMS.reduce((acc, _, i) => (t >= T.ev(`slam${i}`) ? T.ev(`slam${i}`) : acc), -1)
    const hit = last >= 0 ? Math.exp(-(t - last) * 11) : 0
    const swoop = prog(t, collapse, dialog - collapse + 0.1)
    // The white-out from the logo dive carries into the first slam.
    const carry = Math.exp(-Math.max(0, t - S.sec.start) * 7)
    return {
      bloom: lerp(0.75, 0.5, deskIn),
      threshold: lerp(0.6, 0.72, deskIn),
      flash:
        1.0 * carry + 0.1 * hit * (1 - deskIn) + 0.12 * Math.exp(-Math.max(0, t - spawn) * 7) * (t >= spawn ? 1 : 0),
      flashColor: [1, 0.95, 1],
      exposure: 1 + 0.35 * carry,
      aberration: 0.6 + 1.5 * hit * (1 - deskIn) + 3 * Math.sin(Math.PI * swoop),
      vignette: lerp(0.42, 0.3, deskIn),
      grain: 0.03,
      saturation: 1.05,
    }
  },
}
