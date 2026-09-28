/** Line icons on a 24×24 grid, stroked with round caps. */

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  play: 'M8 5v14l11-7z',
  pause: 'M8.5 5v14M15.5 5v14',
  alert: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5v6M12 16.5v.01',
  checks: 'M2.5 12.5l4 4L16.5 6.5M11.5 16l.5.5L21.5 7',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.01',
  gear: 'M12 2.8l1.9 1.2 2.2-.4 1.2 1.9 2.1.9-.2 2.2 1.3 1.8-1.3 1.8.2 2.2-2.1.9-1.2 1.9-2.2-.4L12 21.2l-1.9-1.2-2.2.4-1.2-1.9-2.1-.9.2-2.2L3.5 12l1.3-1.8-.2-2.2 2.1-.9 1.2-1.9 2.2.4zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  sort: 'M7 4v16M7 4L3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  stop: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  speed: 'M3.5 17a8.5 8.5 0 1 1 17 0M12 17l4.5-5.5M6 17h.01M7.5 11.5v.01M12 9v.01M16.5 11.5v.01',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  globe:
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
  terminal: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM7 10l3 2-3 2M12.5 15h4.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4',
  torrent: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M16 3.8A9 9 0 0 1 20.2 8',
  mesh: 'M12 3.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM5 16.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM19 16.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12 7.5v4.5M12 12l-5.3 5M12 12l5.3 5M7 18.5h10',
  stream: 'M3.5 6h17v12h-17zM10 9.5v5l4.5-2.5zM3.5 21h17',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  shield: 'M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6zM8.5 12l2.5 2.5 4.5-5',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  palette:
    'M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.4-1-2.6 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11v.01M10 7v.01M15 7v.01',
  language: 'M4 5h9M8.5 3v2M6 5c1 3 3.5 5.5 6 6.5M11 5c-1 3.5-3.5 6-7 7.5M13 20l4-9 4 9M14.5 17h5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  chevron: 'M6 9l6 6 6-6',
  filter: 'M4 6h16M7 12h10M10 18h4',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z',
  subtitles: 'M3 6h18v12H3zM6.5 14h4M13 14h4.5M6.5 10.5h7M15.5 10.5h2',
  tray: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1.5 2.5h5L16 13h5',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  record: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
  network:
    'M6 3.3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM18 3.3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM12 16.3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM6 7.7V9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.7M12 12v4.3',
  link: 'M9.5 14.5l5-5M10.6 6.4l1.3-1.3a4 4 0 0 1 5.7 5.7l-1.3 1.3M13.4 17.6l-1.3 1.3a4 4 0 0 1-5.7-5.7l1.3-1.3',
  pulse: 'M3 12h4l2.5-6.5 5 13 2.5-6.5H21',
  document: 'M7 3h7l5 5v13H7zM14 3v5h5',
  people:
    'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7zM2.5 20c.5-3.4 3.1-5.5 6.5-5.5s6 2.1 6.5 5.5M16.5 10.8a3 3 0 1 0 0-6.1M17.8 14.6c2.1.5 3.4 2.3 3.7 5.4',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM7.5 7h.01M7.5 17h.01',
  playCircle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM10 8.5v7l6-3.5z',
  options: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  albums: 'M5 9h14v11H5zM7 6h10M9 3h6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  folderOpen:
    'M3 18V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1.5M3 18l2.7-6.6a1.5 1.5 0 0 1 1.4-.9H21l-3 7.5a1.5 1.5 0 0 1-1.4 1H4.5A1.5 1.5 0 0 1 3 18z',
  stopCircle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5h5v5h-5z',
  cloudUpload: 'M7 18a4.5 4.5 0 0 1-.5-9a6 6 0 0 1 11.5 1.5A4 4 0 0 1 17 18M12 12v8M9 15l3-3 3 3',
  arrowUp: 'M12 20V4M5.5 10.5L12 4l6.5 6.5',
  arrowDown: 'M12 4v16M5.5 13.5L12 20l6.5-6.5',
  checkCircle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l2.8 2.8L16.5 9.5',
  radio:
    'M12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8',
  minimize: 'M5 12h14',
  maximize: 'M6 6h12v12H6z',
}

const cache = new Map()

function path(name) {
  let p = cache.get(name)
  if (!p) {
    const d = PATHS[name]
    if (!d) throw new Error(`Unknown icon: ${name}`)
    p = new Path2D(d)
    cache.set(name, p)
  }
  return p
}

export const ICONS = Object.keys(PATHS)

/**
 * Draw an icon with its top-left corner at (x, y).
 * `width` is the visual stroke width in output pixels.
 */
export function icon(ctx, name, x, y, size, color, width = 1.8, fill = null) {
  if (!(size > 0.5)) return
  ctx.save()
  ctx.translate(x, y)
  const k = size / 24
  ctx.scale(k, k)
  const p = path(name)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill(p)
  }
  if (color) {
    ctx.strokeStyle = color
    ctx.lineWidth = width / k
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(p)
  }
  ctx.restore()
}
