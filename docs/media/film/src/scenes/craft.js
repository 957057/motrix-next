/**
 * 50–56 s · Craft. Six one-second cuts on the beat, each with its own layout:
 * light/dark, ten colour schemes, 27 languages, native and lightweight,
 * no telemetry, open source.
 */
import { C, SCHEMES, THEMES } from '../brand/palette.js'
import { drawLogo } from '../brand/logo.js'
import { night, tinted } from '../fx/background.js'
import { circle, glow, ring } from '../core/draw.js'
import { M3, outBack, prog, spring, tw } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, lerp, mix, rgba } from '../core/math.js'
import { measure, reveal, text } from '../core/text.js'
import { DOWNLOAD_WORDS } from '../i18n/words.js'
import { drawAppWindow, remaining } from '../ui/appwindow.js'

const CUTS = ['cut0', 'cut1', 'cut2', 'cut3', 'cut4', 'cut5']

function title(ctx, S, key, lt, x = 120, y = 930, align = 'left', size = 80) {
  reveal(ctx, S.s(key), x, y, { size, weight: 800, tracking: -0.03, color: C.white, align }, lt - 0.05, {
    mode: 'mask',
    dur: 0.42,
    stagger: 0.03,
  })
}

function sub(ctx, S, str, lt, x, y, align = 'left') {
  reveal(ctx, str, x, y, { size: 30, weight: 500, color: C.dim, align }, lt - 0.18, { dur: 0.45, stagger: 0.03 })
}

/** Three cards in their real end states: completed, seeding, downloading. */
const miniTasks = (s) => [
  {
    name: 'blender-4.5.3-linux-x64.tar.xz',
    actions: ['external', 'folderOpen', 'refresh', 'link', 'info', 'trash'],
    badge: { label: s('ui.complete'), tone: 'success', icon: 'checkCircle' },
    progress: 1,
    color: 'success',
    left: '100% · 372.00 MB / 372.00 MB',
  },
  {
    name: 'bbb_sunflower_2160p_60fps_normal.mp4',
    actions: ['pause', 'stopCircle', 'folderOpen', 'link', 'info', 'close'],
    badge: { label: s('ui.seeding'), tone: 'success', icon: 'cloudUpload' },
    sharing: 1,
    progress: 1,
    color: 'success',
    active: true,
    left: '100% · 642.00 MB / 642.00 MB',
    right: { up: '2.4 MB/s', down: '0 KB/s', seeders: 41, conns: 38 },
  },
  {
    name: 'debian-13.iso',
    actions: ['pause', 'folderOpen', 'link', 'info', 'close'],
    progress: 0.64,
    color: 'primary',
    active: true,
    left: '64% · 2.39 GB / 3.74 GB',
    right: { remaining: remaining(s, 262), down: '5.3 MB/s', conns: 23 },
  },
]

function cutTheme(ctx, S, lt) {
  night(ctx, S.t, { intensity: 0.8 })
  const rect = { x: 700, y: 170, w: 1120, h: 700, r: 18 }
  const state = (theme) => ({
    theme,
    tasks: miniTasks(S.s),
    counts: { all: 3, progress: 1, failed: 0, completed: 2 },
    speed: { up: '2.6 MB', down: '5.3 MB' },
    shadow: 1,
  })
  drawAppWindow(ctx, rect, state(THEMES.dark), S)
  const wipe = M3.standard(prog(lt, 0.12, 0.7))
  const slope = 0.32
  const lineX = lerp(rect.x - 300, rect.x + rect.w + 300, wipe)
  if (wipe > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(lineX + 540 * slope, 0)
    ctx.lineTo(lineX - 540 * slope, 1080)
    ctx.lineTo(0, 1080)
    ctx.closePath()
    ctx.clip()
    drawAppWindow(ctx, rect, { ...state(THEMES.light), shadow: 0 }, S)
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = rgba('#F1E6FF', 0.8 * Math.sin(Math.PI * wipe))
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(lineX + 540 * slope, 0)
    ctx.lineTo(lineX - 540 * slope, 1080)
    ctx.stroke()
    ctx.restore()
  }
  const sw = spring(lt, { freq: 2.2, damping: 0.6 })
  icon(ctx, 'moon', 120, 350, 64 * clamp(sw, 0, 1.2), C.lilac, 3)
  icon(ctx, 'sun', 210, 350, 64 * clamp(spring(lt - 0.1, { freq: 2.2, damping: 0.6 }), 0, 1.2), '#FFD68A', 3)
  title(ctx, S, 'craft.theme', lt, 120, 520, 'left', 84)
}

function cutSchemes(ctx, S, lt) {
  const idx = Math.min(SCHEMES.length - 1, Math.floor(clamp(lt / 0.92) * SCHEMES.length))
  const seed = SCHEMES[idx].seed
  tinted(ctx, S.t, seed, { intensity: 1.4, y: 420 })
  const pop = spring(lt - idx * 0.092, { freq: 3, damping: 0.5 })
  drawLogo(ctx, { x: 960, y: 400, size: 440 * (0.94 + 0.06 * clamp(pop, 0, 1.2)), mono: mix(seed, '#FFFFFF', 0.25) })
  title(ctx, S, 'craft.schemes', lt, 960, 760, 'center', 76)
  const n = SCHEMES.length
  const gap = 78
  const x0 = 960 - ((n - 1) * gap) / 2
  SCHEMES.forEach((sc, i) => {
    const on = i === idx
    const k = tw(lt, 0.02 * i, 0.3, outBack)
    const r = 22 * k * (on ? 1.3 : 1)
    circle(ctx, x0 + i * gap, 880, r, sc.seed)
    if (on) ring(ctx, x0 + i * gap, 880, r + 8, 'rgba(255,255,255,0.9)', 2.5)
  })
}

function cutLanguages(ctx, S, lt) {
  night(ctx, S.t, { intensity: 0.7 })
  const rows = [DOWNLOAD_WORDS.slice(0, 9), DOWNLOAD_WORDS.slice(9, 18), DOWNLOAD_WORDS.slice(18, 27)]
  const own = S.L.code === 'zh-CN' ? 'zh-CN' : 'en-US'
  rows.forEach((row, r) => {
    const y = 300 + r * 170
    const dir = r % 2 ? 1 : -1
    const shift = dir * (lt * 260 + 140)
    const opts = { size: 86, weight: 700 }
    const words = [...row, ...row]
    const widths = words.map(([, w]) => measure(ctx, w, opts) + 90)
    const total = widths.slice(0, row.length).reduce((a, b) => a + b, 0)
    let x = -(((shift % total) + total) % total) - 200
    const hi = Math.floor(lt * 9 + r * 3) % row.length
    words.forEach(([code, w], i) => {
      const on = code === own || i % row.length === hi
      text(ctx, w, x, y, { ...opts, color: on ? (code === own ? C.lilac200 : C.white) : rgba('#8A7FA6', 0.55) })
      x += widths[i]
    })
  })
  title(ctx, S, 'craft.langs', lt, 120, 930, 'left', 80)
  icon(ctx, 'language', 120, 780, 56, C.lilac, 3)
}

function cutNative(ctx, S, lt) {
  tinted(ctx, S.t, C.violet700, { intensity: 1.1 })
  const e = M3.enter(prog(lt, 0, 0.5))
  reveal(ctx, S.s('craft.native'), 960, 360, { size: 40, weight: 600, color: C.lilac200, align: 'center' }, lt, {
    dur: 0.45,
  })
  const big = 'Tauri 2 · Rust'
  const opts = { size: 164, weight: 800, tracking: -0.035, align: 'center' }
  text(ctx, big, 960, 560, {
    ...opts,
    color: null,
    stroke: { width: 2.5, color: rgba('#E9DDFF', 0.8 * (1 - e * 0.6)) },
  })
  text(ctx, big, 960, 560 + (1 - e) * 20, { ...opts, color: C.white, alpha: e })
  icon(ctx, 'tray', 960 - 260, 640, 44, C.dim, 2)
  sub(ctx, S, S.s('craft.nativeSub'), lt, 960 - 200, 676, 'left')
}

function cutPrivacy(ctx, S, lt) {
  tinted(ctx, S.t, '#3E2A7A', { intensity: 1.2, x: 560 })
  const sp = clamp(spring(lt, { freq: 2, damping: 0.55 }), 0, 1.3)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, 560, 540, 360, C.violet, 0.35)
  ctx.restore()
  icon(ctx, 'shield', 560 - 150 * sp, 540 - 150 * sp, 300 * sp, C.lilac200, 7)
  reveal(ctx, S.s('craft.privacy'), 800, 560, { size: 116, weight: 800, tracking: -0.03, color: C.white }, lt - 0.05, {
    mode: 'mask',
    dur: 0.42,
    stagger: 0.03,
  })
  sub(ctx, S, S.s('craft.privacySub'), lt, 806, 630)
}

function cutOpen(ctx, S, lt, T) {
  night(ctx, S.t, { intensity: 1 })
  const e = M3.enter(prog(lt, 0, 0.6))
  ctx.save()
  ctx.globalAlpha *= 0.9
  icon(ctx, 'code', 960 - 260, 360 - 260 + (1 - e) * 30, 520, rgba(C.lilac, 0.55), 4)
  ctx.restore()
  title(ctx, S, 'craft.open', lt, 960, 700, 'center', 100)
  sub(ctx, S, S.s('craft.openSub'), lt, 960, 770, 'center')
  sub(ctx, S, 'github.com/AnInsomniacy/rayburst', lt - 0.15, 960, 820, 'center')
  return tw(S.t, T.ev('drop2') - 0.3, 0.3, M3.exit)
}

export default {
  id: 'craft',
  draw(ctx, S) {
    const { t, T } = S
    let k = 0
    for (let i = 0; i < CUTS.length; i++) if (t >= T.ev(CUTS[i])) k = i
    const lt = t - T.ev(CUTS[k])
    const settle = 1 + 0.07 * (1 - M3.enter(prog(lt, 0, 0.4)))
    ctx.save()
    ctx.translate(960, 540)
    ctx.scale(settle, settle)
    ctx.translate(-960, -540)
    let pre = 0
    switch (k) {
      case 0:
        cutTheme(ctx, S, lt)
        break
      case 1:
        cutSchemes(ctx, S, lt)
        break
      case 2:
        cutLanguages(ctx, S, lt)
        break
      case 3:
        cutNative(ctx, S, lt)
        break
      case 4:
        cutPrivacy(ctx, S, lt)
        break
      default:
        pre = cutOpen(ctx, S, lt, T)
    }
    ctx.restore()
    return {
      flash: 0.3 * Math.exp(-lt * 10) + 0.6 * pre,
      bloom: 0.6,
      threshold: k === 0 ? 0.92 : 0.72,
      vignette: 0.34,
      grain: 0.03,
      aberration: 0.6 + 6 * Math.exp(-lt * 10),
      exposure: 1 + 0.15 * pre,
    }
  },
}
