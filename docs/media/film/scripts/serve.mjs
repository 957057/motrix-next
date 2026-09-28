#!/usr/bin/env node
/**
 * Minimal static server for the film page (ES modules need http://).
 *   node scripts/serve.mjs [--port 5173]
 * Then open http://localhost:5173/?lang=en
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
}

export function startServer(port = 0, root = ROOT) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let path = decodeURIComponent(url.pathname)
    if (path.endsWith('/')) path += 'index.html'
    const file = normalize(join(root, path))
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    let st
    try {
      st = statSync(file)
    } catch {
      res.writeHead(404).end('Not found')
      return
    }
    if (st.isDirectory()) {
      res.writeHead(302, { Location: `${path}/` }).end()
      return
    }
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
    const range = req.headers.range
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [a, b] = range.slice(6).split('-')
      const start = a ? Number(a) : 0
      const end = b ? Number(b) : st.size - 1
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': 'no-store',
      })
      createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    })
    createReadStream(file).pipe(res)
  })
  return new Promise((ok) => {
    server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port, close: () => server.close() }))
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port')
  const port = i > 0 ? Number(process.argv[i + 1]) : 5173
  const { port: p } = await startServer(port)
  console.log(`Preview:  http://localhost:${p}/?lang=en`)
  console.log(`          http://localhost:${p}/?lang=zh-CN`)
  console.log('Keys: Space play · ←/→ frame · Shift+←/→ 1 s · 1–9 sections · M motion blur · L loop')
}
