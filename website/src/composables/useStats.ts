/**
 * @fileoverview Repository statistics for the hero: stars and total downloads
 * count up once GitHub answers; the latest stable tag is shown beside them.
 */
import { onMounted, shallowRef } from 'vue'
import { REPO } from '@/links'
import { EASE, gsap, reducedMotion } from '@/motion/gsap'
import { compact } from '@/sim/format'
import { latest, releases, repo } from './github'

const PENDING = '···'
const FAILED = '—'

function countUp(target: number, out: { value: string }) {
  if (reducedMotion()) {
    out.value = compact(target)
    return
  }
  const counter = { n: 0 }
  gsap.to(counter, {
    n: target,
    duration: 1.1,
    ease: EASE.enter,
    onUpdate: () => (out.value = compact(Math.round(counter.n))),
  })
}

export function useStats() {
  const stars = shallowRef(PENDING)
  const downloads = shallowRef(PENDING)
  const version = shallowRef(PENDING)

  onMounted(() => {
    repo(REPO).then(
      (data) => countUp(data.stargazers_count || 0, stars),
      () => (stars.value = FAILED),
    )
    releases(REPO).then(
      (list) =>
        countUp(
          list.reduce((n, r) => n + r.assets.reduce((m, a) => m + (a.download_count || 0), 0), 0),
          downloads,
        ),
      () => (downloads.value = FAILED),
    )
    latest(REPO).then(
      (data) => (version.value = data.tag_name),
      () => (version.value = FAILED),
    )
  })

  return { stars, downloads, version }
}
