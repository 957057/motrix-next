/**
 * Downloads: OS detection, the latest stable release's assets, the
 * architecture picker, the all-platforms list and the hero statistics
 * (GitHub API, count-up). Every link falls back to the releases page.
 */
import { onChange, t } from '../i18n.js'
import { reducedMotion } from '../core/motion.js'
import { esc, ic } from '../ui/dom.js'

const REPO = 'AnInsomniacy/rayburst'
const API = `https://api.github.com/repos/${REPO}`
const RELEASES = `https://github.com/${REPO}/releases`

const PLATFORMS = [
  { key: 'dmg-arm', os: 'macOS', arch: 'Apple Silicon', fmt: '.dmg', match: (n) => n.includes('aarch64') && n.endsWith('.dmg') },
  { key: 'dmg-x64', os: 'macOS', arch: 'Intel', fmt: '.dmg', match: (n) => n.includes('x64') && n.endsWith('.dmg') },
  { key: 'exe-x64', os: 'Windows', arch: 'x64', fmt: '.exe', match: (n) => n.includes('x64') && n.endsWith('-setup.exe') },
  { key: 'exe-arm', os: 'Windows', arch: 'ARM64', fmt: '.exe', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('-setup.exe') },
  { key: 'appimage-x64', os: 'Linux', arch: 'x64', fmt: '.AppImage', match: (n) => n.includes('amd64') && n.endsWith('.AppImage') },
  { key: 'deb-x64', os: 'Linux', arch: 'x64', fmt: '.deb', match: (n) => n.includes('amd64') && n.endsWith('.deb') },
  { key: 'rpm-x64', os: 'Linux', arch: 'x64', fmt: '.rpm', match: (n) => n.includes('x86_64') && n.endsWith('.rpm') },
  { key: 'appimage-arm', os: 'Linux', arch: 'ARM64', fmt: '.AppImage', match: (n) => n.includes('aarch64') && n.endsWith('.AppImage') },
  { key: 'deb-arm', os: 'Linux', arch: 'ARM64', fmt: '.deb', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('.deb') },
  { key: 'rpm-arm', os: 'Linux', arch: 'ARM64', fmt: '.rpm', match: (n) => n.includes('aarch64') && n.endsWith('.rpm') },
]

const ARCH = {
  macOS: [
    { label: 'Apple Silicon', sub: 'arm64', key: 'dmg-arm' },
    { label: 'Intel', sub: 'x86_64', key: 'dmg-x64' },
  ],
  Windows: [
    { label: 'x64', sub: 'Intel / AMD', key: 'exe-x64' },
    { label: 'ARM64', sub: 'arm64', key: 'exe-arm' },
  ],
  Linux: [
    { label: 'x64', sub: 'amd64', key: 'appimage-x64' },
    { label: 'ARM64', sub: 'aarch64', key: 'appimage-arm' },
  ],
}
const HELP = { macOS: 'dl.modal.help.macOS', Windows: 'dl.modal.help.windows', Linux: 'dl.modal.help.linux' }

function detectOS() {
  const ua = navigator.userAgent
  if (/Android|CrOS|iPhone|iPad/.test(ua)) return null
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return null
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

async function getJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}

function loadStats() {
  const stars = document.getElementById('stat-stars')
  const downloads = document.getElementById('stat-downloads')
  getJSON(API)
    .then((repo) => countUp(stars, repo.stargazers_count || 0))
    .catch(() => (stars.textContent = '—'))
  getJSON(`${API}/releases?per_page=100`)
    .then((list) => {
      let total = 0
      for (const r of list) for (const a of r.assets || []) total += a.download_count || 0
      countUp(downloads, total)
    })
    .catch(() => (downloads.textContent = '—'))
}

export function initDownload() {
  const os = detectOS()
  const detected = document.getElementById('dl-detected')
  const primary = document.getElementById('dl-primary')
  const primaryText = document.getElementById('dl-primary-text')
  const heroBtn = document.getElementById('hero-download')
  const heroText = document.getElementById('hero-download-text')
  const version = document.getElementById('stat-version')
  const grid = document.getElementById('dl-grid')
  const toggle = document.getElementById('dl-toggle')
  const all = document.getElementById('dl-all')
  const modal = document.getElementById('dl-modal')
  let urls = {}
  let release = RELEASES
  let ready = false

  const labels = () => {
    detected.textContent = os ? t('dl.detected', { os }) : ''
    primaryText.textContent = ready && os ? t('dl.primary', { os }) : t('dl.primary.fallback')
    heroText.textContent = os ? t('dl.primary', { os }) : t('hero.download')
  }
  labels()
  onChange(labels)

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true'
    toggle.setAttribute('aria-expanded', String(open))
    all.classList.toggle('is-open', open)
  })

  const renderGrid = () => {
    const groups = new Map()
    for (const p of PLATFORMS) {
      const key = p.os === 'Linux' ? `Linux · ${p.arch}` : p.os
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(p)
    }
    grid.innerHTML = [...groups]
      .map(
        ([key, items]) => `
        <div class="dl-plat"><span>${esc(key)}</span>${items
          .map(
            (p) =>
              `<a class="dl-pill" href="${esc(urls[p.key] || release)}" target="_blank" rel="noopener">${ic('download-outline')}${
                p.os === 'Linux' ? esc(p.fmt) : `${esc(p.arch)} <small>${esc(p.fmt)}</small>`
              }</a>`,
          )
          .join('')}</div>`,
      )
      .join('')
  }
  renderGrid()

  const openModal = () => {
    const opts = ARCH[os]
    document.getElementById('dl-modal-title').textContent = t('dl.modal.title', { os })
    document.getElementById('dl-modal-opts').innerHTML = opts
      .map((o) => {
        const url = urls[o.key]
        return `<a class="modal-opt" href="${esc(url || release)}" ${url ? '' : 'target="_blank" rel="noopener"'}>
          <b>${esc(o.label)}</b><small>${esc(o.sub)}</small>
          <span>${url ? `${ic('download-outline')}${esc(t('dl.modal.download'))}` : `${ic('open-outline')}${esc(t('dl.modal.viewRelease'))}`}</span>
        </a>`
      })
      .join('')
    document.getElementById('dl-modal-help').innerHTML = `${esc(t('dl.modal.notSure'))} ${t(HELP[os])}`
    modal.showModal()
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) modal.close()
    if (e.target.closest('.modal-opt[href]') && !e.target.closest('[target]')) setTimeout(() => modal.close(), 300)
  })

  const onDownload = (e) => {
    if (!ready || !os || !ARCH[os]) return
    e.preventDefault()
    openModal()
  }
  primary.addEventListener('click', onDownload)
  heroBtn.addEventListener('click', (e) => {
    if (ready && os && ARCH[os]) onDownload(e)
  })

  loadStats()
  getJSON(`${API}/releases/latest`)
    .then((data) => {
      if (data.draft || data.prerelease || !Array.isArray(data.assets)) throw new Error('not a stable release')
      version.textContent = data.tag_name
      release = data.html_url || RELEASES
      for (const p of PLATFORMS) {
        const asset = data.assets.find((a) => p.match(a.name))
        if (asset) urls[p.key] = asset.browser_download_url
      }
      ready = true
      labels()
      renderGrid()
    })
    .catch(() => {
      version.textContent = '—'
      primary.href = RELEASES
    })
}
