/** Helpers shared by the scenes. */
import { fmt } from '../ui/dom.js'

const TOAST_TIME = 4.5

/** Completion toasts for tasks that finished within the last few seconds. */
export function toastsFor(model, time, tr) {
  const out = []
  for (const task of model.tasks) {
    if (task.doneAt == null) continue
    const age = time - task.doneAt
    if (age < 0 || age > TOAST_TIME) continue
    out.push({
      id: `${task.id}:${task.sharing ? 'seed' : 'done'}`,
      text: fmt(tr(task.sharing ? 'ui.seedingToast' : 'ui.saved'), { name: task.name }),
    })
  }
  return out
}

/** Keyframed cursor: [{ t, at: () => [x, y] }] → position at time t, eased between keys. */
export function cursorPath(keys, time, easeFn) {
  if (time <= keys[0].t) return keys[0].at()
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]
    if (time <= b.t) {
      const a = keys[i - 1]
      const u = easeFn((time - a.t) / (b.t - a.t))
      const pa = a.at()
      const pb = b.at()
      return [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u]
    }
  }
  return keys[keys.length - 1].at()
}

/** The pointer glyph used by the demos. */
export const CURSOR_SVG =
  '<svg class="cursor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8.2-6.2 1.3 3.6 7-2.7 1.4-3.6-7.1L5 18.6z" fill="#fff" stroke="#1b1520" stroke-width="1.3" stroke-linejoin="round"/></svg>'

/** Light ribbon between two points in an SVG overlay; returns an updater. */
export function ribbon(svg, color) {
  const ns = 'http://www.w3.org/2000/svg'
  const g = document.createElementNS(ns, 'g')
  const halo = document.createElementNS(ns, 'path')
  const core = document.createElementNS(ns, 'path')
  const head = document.createElementNS(ns, 'circle')
  for (const p of [halo, core]) {
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke-linecap', 'round')
    p.setAttribute('pathLength', '1')
    p.setAttribute('stroke-dasharray', '1 1')
  }
  halo.setAttribute('stroke', color)
  halo.setAttribute('stroke-width', '10')
  halo.setAttribute('opacity', '0.25')
  halo.style.filter = 'blur(4px)'
  core.setAttribute('stroke', color)
  core.setAttribute('stroke-width', '2.5')
  head.setAttribute('r', '5')
  head.setAttribute('fill', '#fff')
  head.style.filter = `drop-shadow(0 0 8px ${color})`
  g.append(halo, core, head)
  g.style.opacity = '0'
  svg.append(g)
  let d = ''
  return {
    /** from/to in overlay pixels; u: draw progress 0..1; alpha: overall opacity. */
    update(from, to, u, alpha) {
      g.style.opacity = String(alpha)
      if (alpha <= 0) return
      const [x0, y0] = from
      const [x1, y1] = to
      const dx = x1 - x0
      const dy = y1 - y0
      const lift = Math.min(160, Math.hypot(dx, dy) * 0.35)
      const next = `M${x0},${y0} C${x0 + dx * 0.35},${y0 - lift} ${x1 - dx * 0.25},${y1 - lift * 0.6} ${x1},${y1}`
      if (next !== d) {
        d = next
        halo.setAttribute('d', d)
        core.setAttribute('d', d)
      }
      const off = String(1 - u)
      halo.setAttribute('stroke-dashoffset', off)
      core.setAttribute('stroke-dashoffset', off)
      const len = core.getTotalLength?.() ?? 0
      if (len) {
        const p = core.getPointAtLength(len * u)
        head.setAttribute('cx', p.x)
        head.setAttribute('cy', p.y)
      }
      head.setAttribute('opacity', u > 0 && u < 1 ? '1' : '0')
    },
    remove() {
      g.remove()
    },
  }
}
