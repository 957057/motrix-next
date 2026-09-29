/**
 * @fileoverview Time-based playback for the animated scenes.
 *
 * A scene is a paused GSAP timeline whose playhead is the scene clock. It
 * starts the first time the element is well inside the viewport, runs only
 * while the element is on screen, and pauses otherwise; GSAP's ticker stops
 * with the tab and smooths lag, so a stalled frame never makes a scene jump.
 * Scroll speed never affects what is drawn: every scene renders from `time`.
 * With reduced motion the timeline sits on a representative still frame.
 */
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core'
import { computed, onScopeDispose, readonly, ref, shallowRef, watch, type MaybeRefOrGetter } from 'vue'
import { gsap } from './gsap'

export interface SceneOptions {
  /** Scene length in seconds; the clock stops there. Omit for an endless scene. */
  duration?: number
  /** Restart the clock after this many seconds. */
  loop?: number
  /** Time shown with reduced motion (defaults to the duration, or 0). */
  still?: number
  /** Start on first view (false: call play()). */
  autostart?: boolean
}

/** Endless scenes wrap after an hour; nothing they draw depends on absolute time. */
const ENDLESS = 3600

export function useScene(target: MaybeRefOrGetter<HTMLElement | null | undefined>, o: SceneOptions = {}) {
  const period = o.loop ?? o.duration ?? ENDLESS
  const repeats = o.duration != null && o.loop == null ? 0 : -1
  const still = o.still ?? (o.duration != null ? o.duration : 0)
  const time = shallowRef(0)
  const ended = ref(false)
  const started = ref(false)
  const visible = ref(false)
  const preference = usePreferredReducedMotion()
  const reduced = computed(() => preference.value === 'reduce')

  const tl = gsap.timeline({
    paused: true,
    repeat: repeats,
    onUpdate: () => (time.value = tl.time()),
    onComplete: () => (ended.value = true),
  })
  tl.to({}, { duration: period })

  useIntersectionObserver(target, ([entry]) => (visible.value = entry?.isIntersecting ?? false))
  useIntersectionObserver(
    target,
    ([entry]) => {
      if (entry?.isIntersecting && (o.autostart ?? true)) started.value = true
    },
    { rootMargin: '-18% 0px -18% 0px' },
  )

  watch(
    [started, visible, ended, reduced],
    () => {
      if (reduced.value) {
        tl.pause(still)
        time.value = still
        return
      }
      if (started.value && visible.value && !ended.value) tl.resume()
      else tl.pause()
    },
    { immediate: true },
  )

  onScopeDispose(() => tl.kill())

  return {
    time: readonly(time),
    timeline: tl,
    reduced,
    play() {
      started.value = true
    },
    replay() {
      ended.value = false
      tl.time(0)
      time.value = 0
      started.value = true
    },
    /** Jump to a time and keep playing from there. */
    seek(t: number) {
      ended.value = false
      tl.time(t)
      time.value = t
    },
  }
}
