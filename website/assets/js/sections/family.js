/**
 * The rest of the family: Rayburst Connect's three store buttons (the
 * visitor's browser is filled in), Aria2 Next's builds for the visitor's
 * system with every other build one menu away, and the Docker command that
 * copies itself.
 */
import { onChange, t } from '../i18n.js'
import { esc, ic } from '../ui/dom.js'
import { picker } from '../ui/picker.js'
import { detectArch, detectBrowser, fileSize, latest } from '../ui/releases.js'

const ENGINE = 'AnInsomniacy/aria2-next'
const ENGINE_RELEASE = `https://github.com/${ENGINE}/releases/latest`

/** aria2-next release artifacts (README, Downloads). */
const BUILDS = [
  { os: 'macOS', arch: 'arm', label: 'Apple Silicon', icon: 'logo-apple', match: /-macos-arm64$/ },
  { os: 'macOS', arch: 'x86', label: 'Intel', icon: 'logo-apple', match: /-macos-x86_64$/ },
  { os: 'Windows', arch: 'x86', label: 'x86_64', icon: 'logo-windows', match: /-windows-x86_64\.exe$/ },
  { os: 'Windows', arch: 'arm', label: 'ARM64', icon: 'logo-windows', match: /-windows-arm64\.exe$/ },
  { os: 'Linux', arch: 'x86', label: 'x86_64', icon: 'logo-tux', match: /-linux-x86_64$/ },
  { os: 'Linux', arch: 'arm', label: 'ARM64', icon: 'logo-tux', match: /-linux-aarch64$/ },
  { os: 'Android', arch: 'arm', label: 'ARM64', icon: 'logo-android', match: /-android-arm64$/ },
]
const CHECKSUMS = /-checksums\.sha256$/

function engineOS() {
  const ua = navigator.userAgent
  if (/Android/.test(ua)) return 'Android'
  if (/CrOS|iPhone|iPad/.test(ua)) return null
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return null
}

function initStores() {
  const browser = detectBrowser()
  if (browser) document.querySelectorAll(`[data-store="${browser}"]`).forEach((el) => el.classList.add('is-yours'))
  const labels = [...document.querySelectorAll('.store [data-add]')]
  const translate = () => labels.forEach((el) => (el.textContent = t('connect.add', { browser: el.dataset.add })))
  translate()
  onChange(translate)
}

function initEngine() {
  const os = engineOS()
  let arch = os === 'macOS' ? 'arm' : os === 'Android' ? 'arm' : 'x86'
  const links = document.querySelectorAll('#engine-primary, [data-engine-link]')
  const labels = document.querySelectorAll('[data-engine-label]')
  const sub = document.querySelector('[data-engine-sub]')
  const menu = document.getElementById('engine-builds')
  const assets = new Map()
  let checksums = null

  picker(document.getElementById('engine-picker'))

  const chosen = () => BUILDS.find((b) => b.os === os && b.arch === arch) ?? BUILDS.find((b) => b.os === os)
  const paint = () => {
    const build = os && chosen()
    const url = (build && assets.get(build)?.browser_download_url) || ENGINE_RELEASE
    labels.forEach((el) => (el.textContent = build ? t('hero.download') : t('engine.getAny')))
    sub.textContent = build ? `${build.os} · ${build.label}` : ''
    links.forEach((a) => (a.href = url))
    menu.innerHTML =
      BUILDS.map((b) => {
        const asset = assets.get(b)
        return `<a class="picker-option build${b === build ? ' is-active' : ''}" role="menuitem" href="${esc(asset?.browser_download_url || ENGINE_RELEASE)}" ${
          asset ? '' : 'target="_blank" rel="noopener"'
        }>${ic(b.icon)}<span>${b.os}</span><small>${esc(b.label)}</small><em class="mono">${esc(fileSize(asset?.size))}</em></a>`
      }).join('') +
      `<div class="picker-sep"></div><a class="picker-option build" role="menuitem" href="${esc(checksums || ENGINE_RELEASE)}" ${
        checksums ? '' : 'target="_blank" rel="noopener"'
      }>${ic('shield-checkmark-outline')}<span>${esc(t('engine.checksums'))}</span><small>SHA-256</small></a>`
  }
  paint()
  onChange(paint)

  if (os === 'macOS' || os === 'Windows' || os === 'Linux') {
    detectArch().then((found) => {
      if (found && found !== arch) {
        arch = found
        paint()
      }
    })
  }
  latest(ENGINE)
    .then((data) => {
      for (const b of BUILDS) {
        const asset = data.assets.find((a) => b.match.test(a.name))
        if (asset) assets.set(b, asset)
      }
      checksums = data.assets.find((a) => CHECKSUMS.test(a.name))?.browser_download_url ?? null
      paint()
    })
    .catch(() => {})
}

/** The Docker command copies itself; the copy icon turns into a check. */
function initCopy() {
  const button = document.getElementById('engine-docker')
  let timer = 0
  const done = () => {
    button.classList.add('is-copied')
    clearTimeout(timer)
    timer = setTimeout(() => button.classList.remove('is-copied'), 1800)
  }
  const fallback = (text) => {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.append(area)
    area.select()
    const ok = document.execCommand?.('copy')
    area.remove()
    return ok
  }
  button.addEventListener('click', () => {
    const text = button.dataset.cmd
    const write = navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'))
    write.then(done, () => fallback(text) && done())
  })
}

export function initFamily() {
  initStores()
  initEngine()
  initCopy()
}
