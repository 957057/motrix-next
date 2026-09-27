/**
 * GitHub release data and platform detection for the download buttons.
 * Requests go to the public GitHub API only and are shared between callers.
 */
const API = 'https://api.github.com/repos'
const requests = new Map()

export function getJSON(url) {
  if (!requests.has(url)) {
    requests.set(
      url,
      fetch(url, { signal: AbortSignal.timeout(8000) }).then((res) => {
        if (!res.ok) throw new Error(`${url}: ${res.status}`)
        return res.json()
      }),
    )
  }
  return requests.get(url)
}

export const repo = (name) => getJSON(`${API}/${name}`)
export const releases = (name) => getJSON(`${API}/${name}/releases?per_page=100`)

/** The latest stable release, or a rejection when there is none. */
export const latest = (name) =>
  getJSON(`${API}/${name}/releases/latest`).then((data) => {
    if (data.draft || data.prerelease || !Array.isArray(data.assets)) throw new Error('not a stable release')
    return data
  })

/** Desktop system: 'macOS' | 'Windows' | 'Linux', or null on phones, tablets and ChromeOS. */
export function detectOS() {
  const ua = navigator.userAgent
  if (/Android|CrOS|iPhone|iPad/.test(ua)) return null
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return null
}

/** 'arm' | 'x86', or null when the browser does not say (Safari and Firefox on a Mac). */
export async function detectArch() {
  try {
    const data = await navigator.userAgentData?.getHighEntropyValues(['architecture'])
    if (data?.architecture) return data.architecture === 'arm' ? 'arm' : 'x86'
  } catch {
    // Not available; fall back to the user agent string.
  }
  if (/aarch64|arm64/i.test(navigator.userAgent)) return 'arm'
  return null
}

/** Browser whose store carries Rayburst Connect: 'chrome' | 'edge' | 'firefox', or null. */
export function detectBrowser() {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad/.test(ua)) return null
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Edg\//.test(ua)) return 'edge'
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome'
  return null
}

export function fileSize(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1048576
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}
