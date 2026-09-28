#!/usr/bin/env node
/**
 * Smoke test without a browser: runs the director for every scene over the
 * whole film against a recording mock of CanvasRenderingContext2D, in every
 * locale. Fails on exceptions, unknown canvas APIs, and NaN/Infinity reaching
 * any drawing call or post parameter.
 *
 *   node scripts/smoke.mjs [--fps 12]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './serve.mjs'

globalThis.Path2D = class Path2D {
  constructor(d) {
    this.d = d
  }
}

const METHODS = new Set([
  'save',
  'restore',
  'translate',
  'scale',
  'rotate',
  'setTransform',
  'resetTransform',
  'transform',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'arcTo',
  'ellipse',
  'rect',
  'roundRect',
  'quadraticCurveTo',
  'bezierCurveTo',
  'fill',
  'stroke',
  'clip',
  'fillRect',
  'strokeRect',
  'clearRect',
  'fillText',
  'strokeText',
  'measureText',
  'createLinearGradient',
  'createRadialGradient',
  'setLineDash',
  'drawImage',
  'getTransform',
])
const PROPS = new Set([
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'lineCap',
  'lineJoin',
  'font',
  'letterSpacing',
  'textAlign',
  'textBaseline',
  'globalAlpha',
  'globalCompositeOperation',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'lineDashOffset',
  'direction',
  'filter',
  'imageSmoothingEnabled',
])
const NUMERIC_PROPS = new Set([
  'lineWidth',
  'globalAlpha',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'lineDashOffset',
])

function mockContext(report) {
  const DEFAULTS = {
    font: '10px sans-serif',
    globalAlpha: 1,
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
    letterSpacing: '0px',
  }
  let state = { ...DEFAULTS, stack: 0 }
  const saved = []
  const gradient = () => ({
    addColorStop(o, c) {
      if (!Number.isFinite(o) || o < 0 || o > 1) report(`addColorStop offset ${o}`)
      if (typeof c !== 'string' || /NaN|undefined/.test(c)) report(`addColorStop colour ${c}`)
    },
  })
  const impl = {
    measureText(str) {
      const m = /(\d+(?:\.\d+)?)px/.exec(state.font)
      const size = m ? Number(m[1]) : 32
      return { width: [...String(str)].length * size * 0.56 }
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    getTransform() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    },
    save() {
      saved.push({ ...state })
      state.stack++
    },
    restore() {
      const depth = state.stack - 1
      if (depth < 0) report('restore() without save()')
      state = saved.pop() ?? { ...DEFAULTS }
      state.stack = Math.max(0, depth)
    },
  }
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === '__stack') return state.stack
        if (METHODS.has(prop)) {
          return (...args) => {
            for (const a of args)
              if (typeof a === 'number' && !Number.isFinite(a)) report(`${String(prop)}(${args.join(', ')})`)
            if (
              (prop === 'fillText' || prop === 'strokeText') &&
              (args[0] == null || String(args[0]).includes('undefined'))
            )
              report(`${prop} text "${args[0]}"`)
            return impl[prop] ? impl[prop](...args) : undefined
          }
        }
        if (PROPS.has(prop)) return state[prop]
        report(`unknown canvas member: ${String(prop)}`)
        return undefined
      },
      set(_, prop, value) {
        if (!PROPS.has(prop)) report(`unknown canvas property set: ${String(prop)}`)
        if (NUMERIC_PROPS.has(prop) && !Number.isFinite(value)) report(`${String(prop)} = ${value}`)
        if (
          (prop === 'fillStyle' || prop === 'strokeStyle') &&
          typeof value === 'string' &&
          /NaN|undefined/.test(value)
        )
          report(`${String(prop)} = ${value}`)
        if (prop === 'font' && /NaN|undefined/.test(value)) report(`font = ${value}`)
        state[prop] = value
        return true
      },
    },
  )
}

const fpsArg = process.argv.indexOf('--fps')
const FPS = fpsArg > 0 ? Number(process.argv[fpsArg + 1]) : 12

const { Timeline } = await import('../src/core/timeline.js')
const { createDirector } = await import('../src/core/director.js')
const { setFontStack } = await import('../src/core/text.js')
const { getLocale, LOCALES } = await import('../src/i18n/index.js')
const { scenes } = await import('../src/scenes/index.js')
const { setLayerFactory } = await import('../src/core/plane3d.js')

// Offscreen layers for 2.5D panels report into the frame being checked.
let activeReport = () => {}
setLayerFactory((w, h) => {
  const layer = { width: w, height: h }
  const lctx = mockContext((m) => activeReport(`layer: ${m}`))
  layer.getContext = () => lctx
  return layer
})

const T = new Timeline(JSON.parse(readFileSync(join(ROOT, 'timeline.json'), 'utf8')))
const problems = new Map()
let frames = 0
const started = process.hrtime.bigint()

for (const code of Object.keys(LOCALES)) {
  const L = getLocale(code)
  setFontStack({ sans: L.fonts.sans, cjk: L.cjk })
  const director = createDirector(scenes, T, L)
  // Uniform sampling plus dense sampling around every section boundary and event.
  const times = new Set()
  for (let f = 0; f < T.duration * FPS; f++) times.add(f / FPS)
  for (const s of T.sections) for (const d of [-0.02, 0, 0.01, 0.1, 0.25, 0.5]) times.add(s.start + d)
  for (const id of Object.keys(T.data.events)) for (const d of [-0.01, 0, 0.02, 0.2]) times.add(T.ev(id) + d)
  for (const t of [...times].filter((x) => x >= 0 && x < T.duration).sort((a, b) => a - b)) {
    let where = ''
    const report = (msg) => {
      const key = `${code} · ${where} · ${msg}`
      if (!problems.has(key)) problems.set(key, t)
    }
    const ctx = mockContext(report)
    activeReport = report
    where = T.sections[T.sectionIndexAt(t)].id
    try {
      const post = director(ctx, t)
      for (const [k, v] of Object.entries(post)) {
        const vals = Array.isArray(v) ? v : [v]
        if (vals.some((x) => !Number.isFinite(x))) report(`post.${k} = ${v}`)
      }
      if (ctx.__stack !== 0) report(`unbalanced save/restore (${ctx.__stack})`)
    } catch (e) {
      report(`exception: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`)
    }
    frames++
  }
}

const ms = Number(process.hrtime.bigint() - started) / 1e6
if (problems.size) {
  for (const [k, t] of problems) console.log(`✗ t=${t.toFixed(3)}  ${k}`)
  console.log(`\n${problems.size} problem(s) in ${frames} frames`)
  process.exit(1)
}
console.log(
  `✓ ${frames} frames across ${Object.keys(LOCALES).length} locales, no exceptions or NaN (${(ms / 1000).toFixed(1)}s)`,
)
