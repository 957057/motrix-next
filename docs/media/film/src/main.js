/**
 * Film bootstrap. One page serves two modes:
 *   preview  (default): interactive player with scrubbing, sections and audio
 *   render   (?render=1): exposes window.FILM for scripts/render.mjs
 *
 * URL parameters: lang=en|zh-CN, scale=1 (2 = 4K), t=<seconds>, render=1
 */
import { createDirector } from './core/director.js'
import { setLayerFactory } from './core/plane3d.js'
import { Post } from './core/post.js'
import { setFontStack } from './core/text.js'
import { Timeline } from './core/timeline.js'
import { getLocale, LOCALES } from './i18n/index.js'
import { scenes } from './scenes/index.js'

const params = new URLSearchParams(location.search)
const MODE = params.get('render') ? 'render' : 'preview'

async function loadFonts(L) {
  const probes = [
    ['"Inter Var"', 'Rayburst Aa 0123'],
    ['"JetBrains Mono"', 'magnet:?xt=urn 0123'],
    ['"Noto Sans SC"', '下载器重新定义'],
    ['"Noto Sans JP"', 'ダウンロード'],
    ['"Noto Sans KR"', '다운로드'],
    ['"Noto Sans Arabic"', 'تنزيل'],
    ['"Noto Sans Devanagari"', 'डाउनलोड'],
    ['"Noto Sans Thai"', 'ดาวน์โหลด'],
  ]
  await Promise.all(
    probes.flatMap(([fam, sample]) =>
      [400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px ${fam}`, sample).catch(() => [])),
    ),
  )
  await document.fonts.ready
  const loaded = new Set(
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
  )
  const missing = probes.map(([fam]) => fam.replace(/"/g, '')).filter((fam) => !loaded.has(fam))
  if (missing.length)
    console.warn(`Fonts not found (system fallbacks will be used): ${missing.join(', ')}. Run: npm run fonts`)
  return missing
}

async function boot() {
  const lang = params.get('lang') ?? 'en'
  const scale = Math.max(0.25, Number(params.get('scale') ?? (MODE === 'render' ? 1 : 1)))
  const T = new Timeline(await (await fetch('./timeline.json')).json())
  const L = getLocale(lang)
  setFontStack({ sans: L.fonts.sans, cjk: L.cjk })
  document.documentElement.lang = L.code
  const missingFonts = await loadFonts(L)

  const W = Math.round(T.width * scale)
  const H = Math.round(T.height * scale)
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = H
  const ctx = layer.getContext('2d', { alpha: false })
  const out = document.getElementById('film')
  const post = new Post(out, W, H)
  setLayerFactory((w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  })
  const director = createDirector(scenes, T, L)

  let rgb = null
  const FILM = {
    ready: false,
    mode: MODE,
    lang: L.code,
    width: W,
    height: H,
    fps: T.fps,
    duration: T.duration,
    frames: Math.round(T.duration * T.fps),
    float: post.float,
    missingFonts,
    sections: T.sections.map(({ id, start, end }) => ({ id, start, end })),

    /** Render frame f with `samples` sub-frames over a leading shutter (fraction of a frame). */
    renderFrame(f, samples = 1, shutter = 0.5, fps = T.fps) {
      post.begin()
      const acc = {}
      const n = Math.max(1, samples | 0)
      for (let i = 0; i < n; i++) {
        const t = Math.min(T.duration - 1e-4, (f + (n > 1 ? (i / n) * shutter : 0)) / fps)
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        const p = director(ctx, t)
        for (const [k, v] of Object.entries(p)) {
          if (Array.isArray(v)) acc[k] = (acc[k] ?? v.map(() => 0)).map((a, j) => a + v[j] / n)
          else acc[k] = (acc[k] ?? 0) + v / n
        }
        post.add(layer, 1 / n)
      }
      post.finish(acc, f)
    },

    /** Render and return the frame as base64 RGB24 (bottom row first). */
    async grab(f, samples, shutter, fps) {
      FILM.renderFrame(f, samples, shutter, fps)
      rgb = post.readRGB(rgb)
      const blob = new Blob([rgb])
      const url = await new Promise((res) => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.readAsDataURL(blob)
      })
      return url.slice(url.indexOf(',') + 1)
    },

    /** Render and return a PNG data URL (for stills). */
    still(f, samples, shutter, fps) {
      FILM.renderFrame(f, samples, shutter, fps)
      return out.toDataURL('image/png')
    },
  }
  window.FILM = FILM
  FILM.ready = true

  if (MODE === 'preview') {
    const { startPlayer } = await import('./player.js')
    startPlayer({ FILM, T, L, LOCALES, params, scale })
  } else {
    document.body.classList.add('render')
  }
}

boot().catch((err) => {
  console.error(err)
  window.FILM = { ready: false, error: String(err?.stack ?? err) }
  const el = document.getElementById('error')
  if (el) el.textContent = String(err?.stack ?? err)
})
