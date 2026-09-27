/**
 * Aria2 Next. A black-and-gold band: data lanes stream in from the left and
 * converge on the terminal, which types the engine's own quick-start commands
 * (aria2-next README) and a standard aria2 JSON-RPC call.
 */
import { clamp, hash } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { esc, rectIn } from '../ui/dom.js'

const SCRIPT = [
  [['c', '# Download a file']],
  [['p', '$ '], ['k', 'aria2-next'], ['', ' https://example.com/file.iso']],
  [],
  [['c', '# Run the JSON-RPC server']],
  [['p', '$ '], ['k', 'aria2-next'], ['', ' --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800']],
  [],
  [['c', '# Add a download over JSON-RPC']],
  [['p', '$ '], ['k', 'curl'], ['', ' -s http://localhost:6800/jsonrpc \\']],
  [['', '    -d '], ['s', `'{"jsonrpc":"2.0","id":"1","method":"aria2.addUri","params":[["https://example.com/file.iso"]]}'`]],
]
const CPS = 42
const LINE_PAUSE = 0.35
const LANES = 18

/** Time at which each line starts typing, with a pause between lines. */
const STARTS = (() => {
  let at = 0.6
  return SCRIPT.map((line) => {
    const s = at
    const len = line.reduce((n, [, text]) => n + text.length, 0)
    at += (line[0]?.[0] === 'c' ? len / (CPS * 2) : len / CPS) + (len ? LINE_PAUSE : 0.1)
    return s
  })
})()
const TYPED_BY = STARTS[STARTS.length - 1] + 3.5

function typed(time) {
  let html = ''
  let caretPlaced = false
  SCRIPT.forEach((line, i) => {
    if (time < STARTS[i]) return
    const cps = line[0]?.[0] === 'c' ? CPS * 2 : CPS
    let budget = Math.floor((time - STARTS[i]) * cps)
    for (const [cls, text] of line) {
      if (budget <= 0) break
      const part = text.slice(0, budget)
      budget -= part.length
      html += cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part)
    }
    const next = STARTS[i + 1] ?? Infinity
    if (time < next && !caretPlaced) {
      html += '<span class="caret"></span>'
      caretPlaced = true
    }
    html += '\n'
  })
  if (!caretPlaced) html += '<span class="p">$ </span><span class="caret"></span>'
  return html
}

function bezier(p0, p1, p2, p3, u) {
  const v = 1 - u
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ]
}

export function initEngine() {
  const section = document.getElementById('engine')
  const canvas = document.getElementById('engine-fx')
  const term = document.getElementById('term')
  const body = document.getElementById('term-body')
  const ctx = canvas.getContext('2d')
  let w = 0
  let hgt = 0
  let dpr = 1
  let target = [0, 0]
  const measure = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1)
    w = canvas.clientWidth
    hgt = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(hgt * dpr)
    const r = rectIn(term, section)
    const stacked = r.x < w * 0.3
    target = stacked ? [r.x + r.w / 2, r.y] : [r.x, r.y + r.h / 2]
  }
  new ResizeObserver(measure).observe(section)
  measure()

  let lastHtml = ''
  const render = (time) => {
    const html = typed(time)
    if (html !== lastHtml) {
      lastHtml = html
      body.innerHTML = html
    }
    if (!w) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, hgt)
    const [tx, ty] = target
    // Warm core where the lanes arrive.
    const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(w, hgt) * 0.45)
    glow.addColorStop(0, `rgba(227,192,122,${0.2 + 0.04 * Math.sin(time * 1.2)})`)
    glow.addColorStop(1, 'rgba(227,192,122,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, hgt)
    const intro = clamp(time / 1.2)
    ctx.lineWidth = 1
    for (let i = 0; i < LANES; i++) {
      const y0 = (hgt * (i + 0.5)) / LANES + (hash(i, 1) - 0.5) * 30
      const p0 = [-40, y0]
      const p1 = [tx * 0.45, y0]
      const p2 = [tx * 0.7, ty + (y0 - ty) * 0.2]
      const p3 = [tx, ty + (y0 - ty) * 0.04]
      ctx.strokeStyle = `rgba(227,192,122,${(0.05 + 0.1 * hash(i, 2)) * intro})`
      ctx.beginPath()
      ctx.moveTo(...p0)
      ctx.bezierCurveTo(...p1, ...p2, ...p3)
      ctx.stroke()
      // Packets travel along each lane at their own pace.
      const speed = 0.12 + 0.12 * hash(i, 3)
      for (let k = 0; k < 3; k++) {
        const u = (time * speed + hash(i, 4 + k)) % 1
        const [x, y] = bezier(p0, p1, p2, p3, u)
        const a = Math.sin(Math.PI * u) * intro
        ctx.fillStyle = `rgba(255,228,170,${0.75 * a})`
        ctx.fillRect(x - 3, y - 1, 6 + 6 * u, 2)
      }
    }
  }
  new Stage(section, { render, still: TYPED_BY })
}
