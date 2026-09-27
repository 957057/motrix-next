/**
 * Downloads: the hero statistics, the hero button, and the closing section:
 * one button for the visitor's system with an architecture switch, a card per
 * platform with every package, and a slow burst of light behind the logo.
 * Every link falls back to the releases page until the GitHub API answers.
 */
import { onChange, t } from '../i18n.js'
import { ease, hash, prog, reducedMotion } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { esc, ic } from '../ui/dom.js'
import { detectArch, detectOS, fileSize, latest, releases, repo } from '../ui/releases.js'

const REPO = 'AnInsomniacy/rayburst'
const RELEASES = `https://github.com/${REPO}/releases`

const PACKAGES = [
  { key: 'dmg-arm', os: 'macOS', arch: 'arm', kind: 'dmg', match: (n) => n.includes('aarch64') && n.endsWith('.dmg') },
  { key: 'dmg-x64', os: 'macOS', arch: 'x86', kind: 'dmg', match: (n) => n.includes('x64') && n.endsWith('.dmg') },
  { key: 'exe-x64', os: 'Windows', arch: 'x86', kind: 'exe', match: (n) => n.includes('x64') && n.endsWith('-setup.exe') },
  { key: 'exe-arm', os: 'Windows', arch: 'arm', kind: 'exe', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('-setup.exe') },
  { key: 'appimage-x64', os: 'Linux', arch: 'x86', kind: 'appimage', match: (n) => n.includes('amd64') && n.endsWith('.AppImage') },
  { key: 'deb-x64', os: 'Linux', arch: 'x86', kind: 'deb', match: (n) => n.includes('amd64') && n.endsWith('.deb') },
  { key: 'rpm-x64', os: 'Linux', arch: 'x86', kind: 'rpm', match: (n) => n.includes('x86_64') && n.endsWith('.rpm') },
  { key: 'appimage-arm', os: 'Linux', arch: 'arm', kind: 'appimage', match: (n) => n.includes('aarch64') && n.endsWith('.AppImage') },
  { key: 'deb-arm', os: 'Linux', arch: 'arm', kind: 'deb', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('.deb') },
  { key: 'rpm-arm', os: 'Linux', arch: 'arm', kind: 'rpm', match: (n) => n.includes('aarch64') && n.endsWith('.rpm') },
]

/** Per system: icon, architecture names, package rows (the first is the main download) and help. */
const SYSTEMS = {
  macOS: {
    icon: 'logo-apple',
    arch: { arm: 'Apple Silicon', x86: 'Intel' },
    rows: [{ kind: 'dmg', name: '.dmg' }],
    help: 'dl.help.macOS',
  },
  Windows: {
    icon: 'logo-windows',
    arch: { x86: 'x64', arm: 'ARM64' },
    rows: [{ kind: 'exe', name: '.exe', sub: 'dl.installer' }],
    help: 'dl.help.windows',
  },
  Linux: {
    icon: 'logo-tux',
    arch: { x86: 'x64', arm: 'ARM64' },
    rows: [
      { kind: 'appimage', name: 'AppImage', sub: 'dl.appimage' },
      { kind: 'deb', name: '.deb', sub: 'dl.deb' },
      { kind: 'rpm', name: '.rpm', sub: 'dl.rpm' },
    ],
    help: 'dl.help.linux',
  },
}

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))

function countUp(el, target) {
  if (reducedMotion()) {
    el.textContent = compact(target)
    return
  }
  const start = performance.now()
  const frame = (now) => {
    const k = Math.min(1, (now - start) / 1100)
    el.textContent = compact(Math.round(target * (1 - Math.pow(1 - k, 3))))
    if (k < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function loadStats() {
  const stars = document.getElementById('stat-stars')
  const downloads = document.getElementById('stat-downloads')
  repo(REPO)
    .then((data) => countUp(stars, data.stargazers_count || 0))
    .catch(() => (stars.textContent = '—'))
  releases(REPO)
    .then((list) => {
      let total = 0
      for (const r of list) for (const a of r.assets || []) total += a.download_count || 0
      countUp(downloads, total)
    })
    .catch(() => (downloads.textContent = '—'))
}

/** Rays of light turning slowly behind the logo, with one ring when the section arrives. */
function initBurst() {
  const hero = document.getElementById('get-hero')
  const canvas = document.getElementById('get-fx')
  const logo = hero.querySelector('.get-logo')
  const ctx = canvas.getContext('2d')
  let w = 0
  let h = 0
  let dpr = 1
  let origin = [0, 0]
  let size = 96
  const measure = () => {
    dpr = Math.min(1.75, window.devicePixelRatio || 1)
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (cw !== w || ch !== h) {
      w = cw
      h = ch
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const a = logo.getBoundingClientRect()
    const b = canvas.getBoundingClientRect()
    origin = [a.left - b.left + a.width / 2, a.top - b.top + a.height / 2]
    size = a.width
  }
  new ResizeObserver(measure).observe(hero)
  measure()

  const RAYS = 30
  new Stage(hero, {
    still: 2.4,
    render: (time) => {
      const lite = document.documentElement.dataset.theme === 'light'
      const [ox, oy] = origin
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const intro = ease.enter(prog(time, 0.1, 1.6))
      const reach = Math.hypot(w, h) * 0.55 * intro
      ctx.globalCompositeOperation = lite ? 'source-over' : 'lighter'
      for (let i = 0; i < RAYS; i++) {
        const angle = (i / RAYS) * Math.PI * 2 + hash(i, 7) * 0.2 + time * 0.035
        const pulse = 0.55 + 0.45 * Math.sin(time * (0.35 + hash(i, 8) * 0.5) + i * 1.7)
        const len = reach * (0.45 + 0.55 * hash(i, 9)) * (0.75 + 0.25 * pulse)
        const spread = 0.012 + 0.02 * hash(i, 10)
        const alpha = (0.05 + 0.1 * pulse) * (lite ? 0.55 : 1)
        const grad = ctx.createRadialGradient(ox, oy, size * 0.3, ox, oy, len)
        const rgb = lite ? '123,62,209' : '200,168,255'
        grad.addColorStop(0, `rgba(${rgb},${alpha})`)
        grad.addColorStop(1, `rgba(${rgb},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.arc(ox, oy, len, angle - spread, angle + spread)
        ctx.closePath()
        ctx.fill()
      }
      // One ring as the section lands.
      const ring = prog(time, 0.35, 1.5)
      if (ring > 0 && ring < 1) {
        ctx.strokeStyle = lite ? `rgba(123,62,209,${0.35 * (1 - ring)})` : `rgba(226,206,255,${0.5 * (1 - ring)})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(ox, oy, size * (0.6 + 3.6 * ease.enter(ring)), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
      const r = size * (2.6 + 0.3 * Math.sin(time * 0.8))
      const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
      glow.addColorStop(0, lite ? `rgba(158,116,213,${0.28 * intro})` : `rgba(150,95,230,${0.45 * intro})`)
      glow.addColorStop(1, 'rgba(150,95,230,0)')
      ctx.fillStyle = glow
      ctx.fillRect(ox - r, oy - r, r * 2, r * 2)
    },
  })
}

export function initDownload() {
  const os = detectOS()
  const heroText = document.getElementById('hero-download-text')
  const primary = document.getElementById('dl-primary')
  const primaryText = document.getElementById('dl-primary-text')
  const primaryMeta = document.getElementById('dl-primary-meta')
  const seg = document.getElementById('dl-arch')
  const version = document.getElementById('dl-version')
  const notes = document.getElementById('dl-notes')
  const heroVersion = document.getElementById('stat-version')
  const plats = document.getElementById('dl-plats')
  const assets = {}
  let arch = os === 'macOS' ? 'arm' : 'x86'

  const main = () => PACKAGES.find((p) => p.os === os && p.arch === arch && p.kind === SYSTEMS[os].rows[0].kind)

  const paintPrimary = () => {
    // The button says "Download"; the system, architecture and size sit on the small line.
    heroText.textContent = t('hero.download')
    primaryText.textContent = os ? t('hero.download') : t('dl.primary.fallback')
    if (!os) return
    const pkg = main()
    const asset = assets[pkg.key]
    primary.href = asset?.browser_download_url || RELEASES
    const ext = SYSTEMS[os].rows[0].name
    primaryMeta.textContent = [os, SYSTEMS[os].arch[arch], ext, fileSize(asset?.size)].filter(Boolean).join(' · ')
  }

  // Architecture switch under the main button (a sliding thumb marks the choice).
  const paintSeg = () => {
    if (!os) return
    const keys = Object.keys(SYSTEMS[os].arch)
    seg.hidden = false
    if (!seg.children.length) {
      seg.innerHTML =
        '<i class="seg-thumb" aria-hidden="true"></i>' +
        keys
          .map((k) => `<button type="button" role="radio" data-arch="${k}">${esc(SYSTEMS[os].arch[k])}</button>`)
          .join('')
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-arch]')
        if (!b || b.dataset.arch === arch) return
        arch = b.dataset.arch
        paintSeg()
        paintPrimary()
      })
    }
    const index = keys.indexOf(arch)
    seg.style.setProperty('--at', index)
    seg.querySelectorAll('[data-arch]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.arch === arch)))
  }

  const paintPlats = () => {
    plats.innerHTML = Object.entries(SYSTEMS)
      .map(([name, sys]) => {
        const rows = sys.rows
          .map((row) => {
            const links = PACKAGES.filter((p) => p.os === name && p.kind === row.kind)
              .map((p) => {
                const asset = assets[p.key]
                const size = fileSize(asset?.size)
                return `<a class="pkg" href="${esc(asset?.browser_download_url || RELEASES)}" ${asset ? '' : 'target="_blank" rel="noopener"'}${
                  size ? ` title="${esc(size)}"` : ''
                }>${ic('download-outline')}<span>${esc(sys.arch[p.arch])}</span></a>`
              })
              .join('')
            return `<div class="pkg-row"><div class="pkg-name"><b>${esc(row.name)}</b>${row.sub ? `<small>${esc(t(row.sub))}</small>` : ''}</div><div class="pkg-links">${links}</div></div>`
          })
          .join('')
        const yours = name === os
        return `<article class="plat${yours ? ' is-yours' : ''}">
          <header>${ic(sys.icon)}<h4>${name}</h4>${yours ? `<span class="plat-badge">${esc(t('dl.yours'))}</span>` : ''}</header>
          <div class="pkg-rows">${rows}</div>
          <p class="plat-help">${esc(t('dl.help'))} <span>${t(sys.help)}</span></p>
        </article>`
      })
      .join('')
  }

  const paint = () => {
    paintPrimary()
    paintSeg()
    paintPlats()
  }
  paint()
  onChange(paint)

  // The hero and navigation buttons glide down to the section, then the main button glows once.
  const pulse = () => {
    primary.classList.remove('is-pulse')
    void primary.offsetWidth
    primary.classList.add('is-pulse')
  }
  primary.addEventListener('animationend', () => primary.classList.remove('is-pulse'))
  document.querySelectorAll('a[href="#download"]').forEach((a) =>
    a.addEventListener('click', () => {
      const r = primary.getBoundingClientRect()
      const inView = r.top >= 0 && r.bottom <= innerHeight
      if (inView || reducedMotion()) return pulse()
      if ('onscrollend' in window) window.addEventListener('scrollend', pulse, { once: true })
      else setTimeout(pulse, 900)
    }),
  )

  detectArch().then((found) => {
    if (!found || !os || found === arch) return
    arch = found
    paintSeg()
    paintPrimary()
  })

  loadStats()
  latest(REPO)
    .then((data) => {
      heroVersion.textContent = data.tag_name
      version.textContent = data.tag_name
      notes.href = data.html_url || notes.href
      for (const p of PACKAGES) {
        const asset = data.assets.find((a) => p.match(a.name))
        if (asset) assets[p.key] = asset
      }
      paint()
    })
    .catch(() => {
      heroVersion.textContent = '—'
    })

  initBurst()
}
