/**
 * Director: maps time to the active scene, runs section transitions and returns
 * the post-processing parameters for the frame. Scenes are pure functions of
 * time — no state carries from one frame to the next — so frames can render in
 * any order on any worker.
 */
import { DEFAULT_POST } from './post.js'
import { M3, inOutCubic } from './ease.js'
import { clamp, lerp, rgba, TAU } from './math.js'
import { glow } from './draw.js'

export const W = 1920
export const H = 1080

function blendPost(a = {}, b = {}, k) {
  const out = {}
  for (const key of new Set([...Object.keys(DEFAULT_POST), ...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key] ?? DEFAULT_POST[key]
    const vb = b[key] ?? DEFAULT_POST[key]
    out[key] = Array.isArray(va) ? va.map((v, i) => lerp(v, vb[i], k)) : lerp(va, vb, k)
  }
  return out
}

const TRANSITIONS = {
  /** Lateral push: outgoing leaves left, incoming springs in from the right. */
  push(ctx, p, drawA, drawB) {
    const e = M3.standard(p)
    const x = -W * e
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, Math.max(0, W + x), H)
    ctx.clip()
    ctx.translate(x * 0.6, 0)
    const pa = drawA()
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(W + x, 0, -x, H)
    ctx.clip()
    ctx.translate(W + x, 0)
    const pb = drawB()
    ctx.restore()
    // Light seam on the moving edge.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createLinearGradient(W + x - 60, 0, W + x + 60, 0)
    g.addColorStop(0, rgba('#B98CFF', 0))
    g.addColorStop(0.5, rgba('#E9DDFF', 0.5 * Math.sin(Math.PI * p)))
    g.addColorStop(1, rgba('#B98CFF', 0))
    ctx.fillStyle = g
    ctx.fillRect(W + x - 60, 0, 120, H)
    ctx.restore()
    return blendPost(pa, pb, e)
  },

  /** Iris opening from the engine chip, rimmed in gold. */
  iris(ctx, p, drawA, drawB, o = {}) {
    const [cx, cy] = o.center ?? [1330, 540]
    const pa = drawA()
    const e = inOutCubic(clamp(p))
    const r = e * 2300
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(0.1, r), 0, TAU)
    ctx.clip()
    const pb = drawB()
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const [w, a] of [
      [40, 0.12],
      [10, 0.4],
      [2.5, 0.9],
    ]) {
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(0.1, r), 0, TAU)
      ctx.strokeStyle = rgba('#FFE3A8', a * (1 - e * 0.6))
      ctx.lineWidth = w
      ctx.stroke()
    }
    if (p < 0.3) glow(ctx, cx, cy, 300, '#FFE3A8', (1 - p / 0.3) * 0.6)
    ctx.restore()
    return blendPost(pa, pb, e)
  },
}

export function createDirector(scenes, T, L) {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  for (const sec of T.sections) if (!byId.has(sec.id)) throw new Error(`No scene for section "${sec.id}"`)

  function drawScene(ctx, sec, t) {
    const scene = byId.get(sec.id)
    ctx.save()
    const S = { t, lt: t - sec.start, sec, T, s: L.s, L, W, H }
    const post = scene.draw(ctx, S) ?? {}
    ctx.restore()
    return post
  }

  return function draw(ctx, t) {
    const idx = T.sectionIndexAt(t)
    const sec = T.sections[idx]
    const tr = sec.enter
    if (tr && idx > 0 && tr.type !== 'cut' && t < sec.start + tr.dur) {
      const fn = TRANSITIONS[tr.type]
      if (!fn) throw new Error(`Unknown transition "${tr.type}"`)
      const prev = T.sections[idx - 1]
      const p = (t - sec.start) / tr.dur
      return blendPost(
        fn(
          ctx,
          p,
          () => drawScene(ctx, prev, t),
          () => drawScene(ctx, sec, t),
          tr,
        ),
        {},
        0,
      )
    }
    return blendPost(drawScene(ctx, sec, t), {}, 0)
  }
}
