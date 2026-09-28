/**
 * The Rayburst mark, rebuilt from rayburst/public/logo.svg.
 *
 * The SVG draws five polygons inside a group transform; the points below are
 * the originals, mapped into the 512×512 viewBox at load time. At rest every
 * renderer here reproduces the master artwork (colours and proportions); 3D and
 * tracing are transitional states only.
 */
import { clamp, hexToRgb } from '../core/math.js'
import { tracePath } from '../core/draw.js'

const K = 0.73247291
const TX = -168.41092
const TY = -20.55943
const map = ([x, y]) => [x * K + TX, y * K + TY]

const RAW = [
  {
    id: 'lower',
    pts: [
      [378.886, 656.64],
      [765.52, 474.844],
      [846.844, 586.742],
    ],
    grad: { bbox: [1, 0.1, 0, 0.85] },
    stops: ['#AE7AE7', '#945AD7', '#7C40C4'],
  },
  {
    id: 'upright-short',
    pts: [
      [312.0, 667.0],
      [380.288, 453.717],
      [469.099, 433.56],
    ],
    grad: { user: [382.808, 102.686, 312.0, 667.0] },
    stops: ['#A76FE7', '#8B4FD7', '#7538C4'],
  },
  {
    id: 'upright-tall',
    pts: [
      [312.0, 667.0],
      [382.778, 102.923],
      [457.794, 231.149],
    ],
    grad: { user: [382.808, 102.686, 312.0, 667.0] },
    stops: ['#A76FE7', '#8B4FD7', '#7538C4'],
  },
  {
    id: 'lightning',
    pts: [
      [313.152, 666.266],
      [574.884, 401.725],
      [424.606, 424.957],
      [522.0, 240.0],
      [826.262, 88.139],
      [687.772, 331.537],
      [846.827, 326.564],
    ],
    grad: { bbox: [0.8, 0, 0.2, 1] },
    stops: ['#8F52DF', '#7B3ED1', '#682BBC'],
  },
  {
    id: 'highlight',
    pts: [
      [826.262, 88.139],
      [522.0, 240.0],
      [424.606, 424.957],
      [492.982, 414.387],
    ],
    grad: { bbox: [0.8, 0, 0.2, 1] },
    stops: ['#B17CEC', '#9B62DF', '#864AD1'],
  },
]

function build(p) {
  const pts = p.pts.map(map)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const bx = Math.min(...xs)
  const by = Math.min(...ys)
  const bw = Math.max(...xs) - bx
  const bh = Math.max(...ys) - by
  let g
  if (p.grad.bbox) {
    const [x1, y1, x2, y2] = p.grad.bbox
    g = [bx + x1 * bw, by + y1 * bh, bx + x2 * bw, by + y2 * bh]
  } else {
    const [a, b] = [map(p.grad.user.slice(0, 2)), map(p.grad.user.slice(2))]
    g = [...a, ...b]
  }
  const cx = xs.reduce((s, v) => s + v, 0) / xs.length
  const cy = ys.reduce((s, v) => s + v, 0) / ys.length
  return { ...p, pts, g, centroid: [cx, cy], bbox: [bx, by, bw, bh] }
}

/** Pieces in SVG paint order. Polygon point order starts at the convergence point where possible. */
export const PIECES = RAW.map(build)

/** Where the three rays converge (bottom-left), in 512 space. */
export const ORIGIN = map([312.0, 667.0])
/** The lightning bolt's top-right tip, in 512 space. */
export const TIP = map([826.262, 88.139])
export const CENTER = [256, 256]

/** Map a 512-space point to screen for a logo placed with drawLogo options. */
export function logoPoint(o, p) {
  const k = (o.size ?? 512) / 512
  const [ax, ay] = o.anchor === 'origin' ? ORIGIN : CENTER
  return [o.x + (p[0] - ax) * k, o.y + (p[1] - ay) * k]
}

function gradient(ctx, piece, mono) {
  if (mono) return mono
  const [x1, y1, x2, y2] = piece.g
  const g = ctx.createLinearGradient(x1, y1, x2, y2)
  g.addColorStop(0, piece.stops[0])
  g.addColorStop(0.5, piece.stops[1])
  g.addColorStop(1, piece.stops[2])
  return g
}

function polygon(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

function enter(ctx, o) {
  const k = (o.size ?? 512) / 512
  const [ax, ay] = o.anchor === 'origin' ? ORIGIN : CENTER
  ctx.translate(o.x ?? 0, o.y ?? 0)
  if (o.rotate) ctx.rotate(o.rotate)
  ctx.scale(k, k)
  ctx.translate(-ax, -ay)
  return k
}

/**
 * Flat logo.
 *  o.piece(i, piece) → { p: 0..1 visibility, dx, dy } for assembly animations
 *  o.mono  → single fill colour (the app's empty-state mask look)
 *  o.sheen → 0..1 position of a specular band sweeping across the mark
 */
export function drawLogo(ctx, o = {}) {
  const alpha = clamp(o.alpha ?? 1)
  if (alpha <= 0) return
  ctx.save()
  enter(ctx, o)
  PIECES.forEach((piece, i) => {
    const st = o.piece ? o.piece(i, piece) : null
    const p = st ? clamp(st.p ?? 1) : 1
    if (p <= 0) return
    ctx.save()
    ctx.globalAlpha *= alpha * p
    if (st?.dx || st?.dy) ctx.translate(st.dx ?? 0, st.dy ?? 0)
    polygon(ctx, piece.pts)
    ctx.fillStyle = gradient(ctx, piece, o.mono)
    ctx.fill()
    ctx.restore()
  })
  if (o.sheen != null && o.sheen > -0.5 && o.sheen < 1.5) sheenPass(ctx, o.sheen, o.sheenAlpha ?? 0.55)
  ctx.restore()
}

function sheenPass(ctx, pos, alpha) {
  ctx.save()
  ctx.beginPath()
  for (const piece of PIECES) {
    const pts = piece.pts
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath()
  }
  ctx.clip()
  // Band travels from the convergence point towards the tip.
  const x = ORIGIN[0] + (TIP[0] - ORIGIN[0]) * pos
  const y = ORIGIN[1] + (TIP[1] - ORIGIN[1]) * pos
  const g = ctx.createLinearGradient(x - 90, y - 90 * 1.1, x + 90, y + 90 * 1.1)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)
  ctx.restore()
}

/**
 * Outline tracing from the convergence point outward.
 *  o.progress(i) → 0..1 per piece
 *  o.width: stroke width in output pixels
 */
export function traceLogo(ctx, o = {}) {
  ctx.save()
  const k = enter(ctx, o)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const passes = [
    { w: (o.width ?? 2) * 7, a: 0.12 },
    { w: (o.width ?? 2) * 2.5, a: 0.35 },
    { w: o.width ?? 2, a: 1 },
  ]
  PIECES.forEach((piece, i) => {
    const pr = clamp(o.progress ? o.progress(i) : 1)
    if (pr <= 0) return
    for (const pass of passes) {
      ctx.globalAlpha = (o.alpha ?? 1) * pass.a
      ctx.strokeStyle = o.color ?? '#E9DDFF'
      ctx.lineWidth = pass.w / k
      tracePath(ctx, piece.pts, pr, true)
    }
  })
  ctx.restore()
}

// ── 3D crystal ────────────────────────────────────────────────────────────

const LIGHT = (() => {
  const v = [-0.45, -0.65, -0.62]
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
})()

function rotate([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x1 = x * cy + z * sy
  const z1 = -x * sy + z * cy
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp]
}

/**
 * Extruded logo. With yaw = pitch = 0 the side faces are edge-on and the result
 * is the flat master artwork.
 *  o.depth (512 units), o.yaw, o.pitch (radians), o.persp (512 units)
 *  o.explode 0..1 pushes pieces along their direction from the convergence point
 */
export function drawLogo3D(ctx, o = {}) {
  const alpha = clamp(o.alpha ?? 1)
  if (alpha <= 0) return
  const depth = o.depth ?? 40
  const yaw = o.yaw ?? 0
  const pitch = o.pitch ?? 0
  const persp = o.persp ?? 1400
  const explode = o.explode ?? 0
  ctx.save()
  const k = (o.size ?? 512) / 512
  ctx.translate(o.x ?? 0, o.y ?? 0)
  ctx.scale(k, k)
  ctx.globalAlpha *= alpha

  const project = (p) => {
    const f = persp / (persp + p[2])
    return [p[0] * f, p[1] * f]
  }

  const pieces = PIECES.map((piece, i) => {
    const ex = explode * (60 + i * 18)
    const dir = [piece.centroid[0] - ORIGIN[0], piece.centroid[1] - ORIGIN[1]]
    const dl = Math.hypot(...dir) || 1
    const off = [(dir[0] / dl) * ex, (dir[1] / dl) * ex, -explode * 40 * (i % 2 ? 1 : -1)]
    const zf = piece.id === 'highlight' ? -depth / 2 - 0.6 : -depth / 2
    const zb = depth / 2
    const front = piece.pts.map(([x, y]) => rotate([x - 256 + off[0], y - 256 + off[1], zf + off[2]], yaw, pitch))
    const back = piece.pts.map(([x, y]) => rotate([x - 256 + off[0], y - 256 + off[1], zb + off[2]], yaw, pitch))
    const zAvg = front.reduce((s, p) => s + p[2], 0) / front.length
    return { piece, front, back, zAvg }
  })
  pieces.sort((a, b) => b.zAvg - a.zAvg)

  for (const { piece, front, back } of pieces) {
    if (piece.id !== 'highlight' && (Math.abs(yaw) > 0.002 || Math.abs(pitch) > 0.002)) {
      const sides = []
      for (let i = 0; i < front.length; i++) {
        const j = (i + 1) % front.length
        const quad = [front[i], front[j], back[j], back[i]]
        const e = [front[j][0] - front[i][0], front[j][1] - front[i][1], front[j][2] - front[i][2]]
        const d = [back[i][0] - front[i][0], back[i][1] - front[i][1], back[i][2] - front[i][2]]
        const n = [e[1] * d[2] - e[2] * d[1], e[2] * d[0] - e[0] * d[2], e[0] * d[1] - e[1] * d[0]]
        const nl = Math.hypot(...n) || 1
        const lit = Math.abs((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nl)
        const z = quad.reduce((s, p) => s + p[2], 0) / 4
        sides.push({ quad, lit, z })
      }
      sides.sort((a, b) => b.z - a.z)
      const [r, g, b] = hexToRgb(piece.stops[2])
      for (const s of sides) {
        const pts = s.quad.map(project)
        const kk = 0.35 + 0.9 * s.lit
        ctx.fillStyle = `rgb(${Math.min(255, r * kk) | 0},${Math.min(255, g * kk) | 0},${Math.min(255, b * kk) | 0})`
        polygon(ctx, pts)
        ctx.fill()
      }
    }
    const pts = front.map(project)
    const [gx1, gy1, gx2, gy2] = piece.g
    const ga = project(rotate([gx1 - 256, gy1 - 256, -depth / 2], yaw, pitch))
    const gb = project(rotate([gx2 - 256, gy2 - 256, -depth / 2], yaw, pitch))
    const grad = ctx.createLinearGradient(ga[0], ga[1], gb[0], gb[1])
    grad.addColorStop(0, piece.stops[0])
    grad.addColorStop(0.5, piece.stops[1])
    grad.addColorStop(1, piece.stops[2])
    polygon(ctx, pts)
    ctx.fillStyle = grad
    ctx.fill()
    if (o.rim) {
      ctx.save()
      ctx.globalAlpha *= clamp(o.rim)
      ctx.strokeStyle = '#F1E6FF'
      ctx.lineWidth = 1.4 / k
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.restore()
    }
  }
  if (o.sheen != null && o.sheen > -0.5 && o.sheen < 1.5 && Math.abs(yaw) < 0.05 && Math.abs(pitch) < 0.05) {
    ctx.translate(-256, -256)
    sheenPass(ctx, o.sheen, o.sheenAlpha ?? 0.5)
  }
  ctx.restore()
}

/** Screen position of the convergence point for a 3D logo centred at (x, y). */
export function originOnScreen(x, y, size) {
  const k = size / 512
  return [x + (ORIGIN[0] - 256) * k, y + (ORIGIN[1] - 256) * k]
}
