/**
 * @fileoverview GitHub release data and platform detection for the download
 * buttons. Requests go to the public GitHub API only and are shared between
 * callers; every link falls back to the releases page until the API answers.
 */
const API = 'https://api.github.com/repos'
const requests = new Map<string, Promise<unknown>>()

export interface ReleaseAsset {
  name: string
  size: number
  download_count: number
  browser_download_url: string
}

export interface Release {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
  assets: ReleaseAsset[]
}

interface Repo {
  stargazers_count: number
}

function getJSON<T>(url: string): Promise<T> {
  let job = requests.get(url)
  if (!job) {
    job = fetch(url, { signal: AbortSignal.timeout(8000) }).then((res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`)
      return res.json()
    })
    requests.set(url, job)
  }
  return job as Promise<T>
}

export const repo = (name: string) => getJSON<Repo>(`${API}/${name}`)
export const releases = (name: string) => getJSON<Release[]>(`${API}/${name}/releases?per_page=100`)

/** The latest stable release; rejects when there is none. */
export const latest = (name: string) =>
  getJSON<Release>(`${API}/${name}/releases/latest`).then((data) => {
    if (data.draft || data.prerelease || !Array.isArray(data.assets)) throw new Error('not a stable release')
    return data
  })

export type DesktopOS = 'macOS' | 'Windows' | 'Linux'
export type Arch = 'arm' | 'x86'
export type Browser = 'chrome' | 'edge' | 'firefox'

/** Desktop system, or null on phones, tablets and ChromeOS. */
export function detectOS(): DesktopOS | null {
  const ua = navigator.userAgent
  if (/Android|CrOS|iPhone|iPad/.test(ua)) return null
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return null
}

interface UADataHighEntropy {
  getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }>
}

/** CPU architecture, or null when the browser does not say (Safari and Firefox on a Mac). */
export async function detectArch(): Promise<Arch | null> {
  try {
    const ua = (navigator as Navigator & { userAgentData?: UADataHighEntropy }).userAgentData
    const data = await ua?.getHighEntropyValues(['architecture'])
    if (data?.architecture) return data.architecture === 'arm' ? 'arm' : 'x86'
  } catch {
    // Not available; fall back to the user agent string.
  }
  return /aarch64|arm64/i.test(navigator.userAgent) ? 'arm' : null
}

/** Browser whose store carries Rayburst Connect, or null. */
export function detectBrowser(): Browser | null {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad/.test(ua)) return null
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Edg\//.test(ua)) return 'edge'
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome'
  return null
}
