#!/usr/bin/env node
/**
 * Frame-exact renderer: headless Chromium draws each frame (with sub-frame
 * motion blur), Playwright reads the pixels, ffmpeg encodes, then the
 * soundtrack is muxed in.
 *
 *   node scripts/render.mjs [options]
 *
 *   --lang en|zh-CN|all     language(s) to render            (default en)
 *   --scale 1               1 = 1920×1080, 2 = 3840×2160     (default 1)
 *   --fps 60                output frame rate                (default timeline fps)
 *   --samples 8             motion-blur sub-frames per frame (default 8)
 *   --shutter 0.5           shutter as a fraction of a frame (default 0.5 = 180°)
 *   --workers N             parallel browser pages           (default ~half the CPU threads, max 8)
 *   --from S --to S         render a time range in seconds
 *   --crf 12 --preset slow  x264 quality / speed (aq-mode 3 keeps dark gradients clean)
 *   --codec h264|prores     prores writes a ProRes 422 HQ .mov for editing
 *   --gl swiftshader|gpu    WebGL backend                    (default swiftshader: slow but deterministic)
 *   --draft                 quick review: 960×540, 30 fps, 1 sample, fast encode
 *   --stills                write PNG stills per section instead of a video
 *   --at 9.5,21,40          stills at specific times (implies --stills)
 *   --no-audio              skip muxing out/soundtrack.wav
 *   --out FILE              output path
 */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { ROOT, startServer } from './serve.mjs'

function parseArgs(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) o[key] = true
    else {
      o[key] = next
      i++
    }
  }
  return o
}

async function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  try {
    const mod = await import('ffmpeg-static')
    if (mod.default && existsSync(mod.default)) return mod.default
  } catch {
    /* fall back to PATH */
  }
  return 'ffmpeg'
}

function glArgs(mode) {
  if (mode === 'gpu') {
    const angle = process.platform === 'darwin' ? 'metal' : process.platform === 'win32' ? 'd3d11' : 'vulkan'
    return ['--enable-gpu', '--ignore-gpu-blocklist', `--use-angle=${angle}`, '--enable-features=Vulkan']
  }
  return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
}

function run(bin, args, opts = {}) {
  return new Promise((ok, fail) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts })
    p.on('error', fail)
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${bin} exited with ${code}`))))
  })
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function openPages(browser, url, count) {
  const pages = []
  for (let i = 0; i < count; i++) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.log(`  [page ${i}] ${m.text()}`)
    })
    page.on('pageerror', (e) => console.log(`  [page ${i}] ${e.message}`))
    await page.goto(url)
    await page.waitForFunction(() => window.FILM && (window.FILM.ready || window.FILM.error), null, {
      timeout: 180_000,
    })
    const err = await page.evaluate(() => window.FILM.error)
    if (err) throw new Error(`Film failed to start:\n${err}`)
    pages.push(page)
  }
  return pages
}

async function renderStills(pages, info, opts, lang) {
  const dir = join(ROOT, 'out', 'stills', lang)
  mkdirSync(dir, { recursive: true })
  let times
  if (typeof opts.at === 'string') times = opts.at.split(',').map(Number).filter(Number.isFinite)
  else times = info.sections.flatMap((s) => [s.start + (s.end - s.start) * 0.35, s.start + (s.end - s.start) * 0.8])
  let k = 0
  await Promise.all(
    pages.map(async (page) => {
      while (k < times.length) {
        const i = k++
        const t = times[i]
        const f = Math.round(t * opts.fps)
        const url = await page.evaluate(
          ([f, s, sh, fps]) => window.FILM.still(f, s, sh, fps),
          [f, opts.samples, opts.shutter, opts.fps],
        )
        const sec = info.sections.find((x) => t >= x.start && t < x.end)?.id ?? 'end'
        const file = join(dir, `${String(i).padStart(2, '0')}-${sec}-${t.toFixed(2)}s.png`)
        writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
        console.log(`  ${file}`)
      }
    }),
  )
}

async function renderVideo(pages, info, opts, lang, ffmpeg) {
  const { fps, samples, shutter } = opts
  const from = Math.max(0, Number(opts.from ?? 0))
  const to = Math.min(info.duration, Number(opts.to ?? info.duration))
  const f0 = Math.round(from * fps)
  const f1 = Math.round(to * fps)
  const total = f1 - f0
  const suffix = opts.draft ? '-draft' : opts.scale >= 2 ? '-4k' : ''
  const ext = opts.codec === 'prores' ? 'mov' : 'mp4'
  const final = opts.out ? resolve(opts.out) : join(ROOT, 'out', `rayburst-promo-${lang}${suffix}.${ext}`)
  mkdirSync(dirname(final), { recursive: true })
  const silent = final.replace(/\.(mp4|mov)$/, `.silent.$1`)

  const encode =
    opts.codec === 'prores'
      ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0']
      : [
          '-c:v',
          'libx264',
          '-preset',
          String(opts.preset),
          '-crf',
          String(opts.crf),
          '-tune',
          'film',
          '-x264-params',
          'aq-mode=3',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
        ]
  const ff = spawn(
    ffmpeg,
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${info.width}x${info.height}`,
      '-r',
      String(fps),
      '-i',
      '-',
      '-vf',
      'vflip,scale=out_color_matrix=bt709:out_range=tv',
      ...encode,
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-color_range',
      'tv',
      silent,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  const ffDone = new Promise((ok, fail) => {
    ff.on('error', (e) => fail(new Error(`Cannot start ffmpeg (${e.message}). Install ffmpeg or run npm install.`)))
    ff.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited with ${code}`))))
  })

  const pending = new Map()
  let next = f0
  let waiters = []
  const wake = () => {
    const w = waiters
    waiters = []
    w.forEach((r) => r())
  }
  const wait = () => new Promise((r) => waiters.push(r))
  const started = Date.now()
  let lastLog = 0

  const writer = async () => {
    while (next < f1) {
      const buf = pending.get(next)
      if (!buf) {
        await wait()
        continue
      }
      pending.delete(next)
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain')
      next++
      wake()
      const done = next - f0
      if (Date.now() - lastLog > 2000 || done === total) {
        lastLog = Date.now()
        const el = (Date.now() - started) / 1000
        const rate = done / el
        process.stdout.write(
          `\r  ${lang}  ${done}/${total} frames  ${rate.toFixed(2)} fps  ETA ${fmtTime((total - done) / Math.max(rate, 1e-6))}   `,
        )
      }
    }
    ff.stdin.end()
  }
  const worker = async (page, wi) => {
    for (let f = f0 + wi; f < f1; f += pages.length) {
      while (f - next > pages.length * 3) await wait()
      const b64 = await page.evaluate(([f, s, sh, r]) => window.FILM.grab(f, s, sh, r), [f, samples, shutter, fps])
      pending.set(f, Buffer.from(b64, 'base64'))
      wake()
    }
  }
  await Promise.all([writer(), ...pages.map(worker)])
  await ffDone
  process.stdout.write('\n')

  const audio = join(ROOT, 'out', 'soundtrack.wav')
  if (!opts['no-audio'] && existsSync(audio)) {
    await run(ffmpeg, [
      '-y',
      '-loglevel',
      'error',
      '-i',
      silent,
      '-ss',
      String(from),
      '-t',
      String(to - from),
      '-i',
      audio,
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-c:v',
      'copy',
      ...(opts.codec === 'prores' ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'aac', '-b:a', '320k']),
      '-shortest',
      final,
    ])
    rmSync(silent)
  } else {
    if (!opts['no-audio'])
      console.log('  No out/soundtrack.wav found — run `npm run audio` first. Writing silent video.')
    rmSync(final, { force: true })
    await run(ffmpeg, ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', final])
    rmSync(silent)
  }
  console.log(`  ✓ ${final}  (${fmtTime((Date.now() - started) / 1000)})`)
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  const { chromium } = await import('playwright').catch(() => {
    throw new Error('Playwright is not installed. Run: npm install && npx playwright install chromium')
  })
  const timeline = JSON.parse(readFileSync(join(ROOT, 'timeline.json'), 'utf8'))
  const draft = Boolean(a.draft)
  const opts = {
    draft,
    scale: Number(a.scale ?? (draft ? 0.5 : 1)),
    fps: Number(a.fps ?? (draft ? 30 : timeline.fps)),
    samples: Number(a.samples ?? (draft ? 1 : 8)),
    shutter: Number(a.shutter ?? 0.5),
    crf: Number(a.crf ?? (draft ? 23 : 12)),
    preset: a.preset ?? (draft ? 'veryfast' : 'slow'),
    codec: a.codec ?? 'h264',
    from: a.from,
    to: a.to,
    at: a.at,
    out: a.out,
    'no-audio': a['no-audio'],
  }
  const stills = Boolean(a.stills || a.at)
  const langs = a.lang === 'all' ? ['en', 'zh-CN'] : [a.lang ?? 'en']
  const workers = Math.max(1, Number(a.workers ?? Math.min(8, Math.max(1, Math.floor(os.cpus().length / 2)))))
  const ffmpeg = await ffmpegPath()

  const server = await startServer(0)
  const browser = await chromium.launch({
    headless: true,
    args: glArgs(a.gl ?? 'swiftshader'),
    ...(a.channel ? { channel: a.channel } : {}),
  })
  console.log(
    `Rendering ${langs.join(', ')} · ${Math.round(1920 * opts.scale)}×${Math.round(1080 * opts.scale)} · ${opts.fps} fps · ${opts.samples} samples · ${workers} workers · gl=${a.gl ?? 'swiftshader'}`,
  )
  try {
    for (const lang of langs) {
      const url = `http://127.0.0.1:${server.port}/index.html?render=1&lang=${encodeURIComponent(lang)}&scale=${opts.scale}`
      const pages = await openPages(browser, url, stills ? Math.min(workers, 4) : workers)
      const info = await pages[0].evaluate(() => {
        const F = window.FILM
        return {
          width: F.width,
          height: F.height,
          duration: F.duration,
          sections: F.sections,
          float: F.float,
          missingFonts: F.missingFonts,
        }
      })
      if (!info.float) console.log('  ! WebGL float buffers unavailable: motion blur precision reduced.')
      if (info.missingFonts.length)
        console.log(`  ! Missing fonts: ${info.missingFonts.join(', ')} (run npm run fonts)`)
      if (stills) await renderStills(pages, info, opts, lang)
      else await renderVideo(pages, info, opts, lang, ffmpeg)
      await Promise.all(pages.map((p) => p.close()))
    }
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
