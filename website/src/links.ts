/** @fileoverview External links used across the page. */
export const REPO = 'AnInsomniacy/rayburst'
export const ENGINE_REPO = 'AnInsomniacy/aria2-next'

export const LINKS = {
  github: `https://github.com/${REPO}`,
  releases: `https://github.com/${REPO}/releases`,
  latest: `https://github.com/${REPO}/releases/latest`,
  stars: `https://github.com/${REPO}/stargazers`,
  sponsor: 'https://github.com/AnInsomniacy/AnInsomniacy/blob/main/SPONSOR.md',
  contributing: `https://github.com/${REPO}/blob/main/docs/CONTRIBUTING.md`,
  conduct: `https://github.com/${REPO}/blob/main/docs/CODE_OF_CONDUCT.md`,
  privacy: `https://github.com/${REPO}/blob/main/docs/PRIVACY.md`,
  signing: `https://github.com/${REPO}/blob/main/docs/CODE_SIGNING.md`,
  engine: `https://github.com/${ENGINE_REPO}`,
  engineLatest: `https://github.com/${ENGINE_REPO}/releases/latest`,
  connectReleases: 'https://github.com/AnInsomniacy/rayburst-connect/releases',
  film: 'https://www.youtube.com/watch?v=Qz4BaKhfT-M',
  tauri: 'https://tauri.app',
  vite: 'https://vite.dev',
} as const

/** Rayburst Connect in each browser's store. */
export const STORES = [
  {
    id: 'edge',
    name: 'Edge',
    icon: 'logo-edge',
    label: 'connect.store.edge',
    href: 'https://microsoftedge.microsoft.com/addons/detail/loojjolhejmakcdlbidigoniobfanjlb',
  },
  {
    id: 'chrome',
    name: 'Chrome',
    icon: 'logo-chrome',
    label: 'connect.store.chrome',
    href: 'https://chromewebstore.google.com/detail/ofeajdebdjajhkmcmamagokecnbephhl',
  },
  {
    id: 'firefox',
    name: 'Firefox',
    icon: 'logo-firefox',
    label: 'connect.store.firefox',
    href: 'https://addons.mozilla.org/firefox/addon/rayburst-connect/',
  },
] as const

export const DOCKER_PULL = 'docker pull ghcr.io/aninsomniacy/aria2-next:latest'
