/** @fileoverview Applies the persisted reduced-motion preference to the document root. */
import { computed, onUnmounted, watch, type ComputedRef } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { usePreferenceStore } from '@/stores/preference'

export const REDUCED_MOTION_CLASS = 'reduce-motion'

export function useReducedMotion(): ComputedRef<boolean> {
  const preferenceStore = usePreferenceStore()
  const system = usePreferredReducedMotion()
  return computed(() => preferenceStore.config.reduceMotion || system.value === 'reduce')
}

export function useReducedMotionClass(): void {
  const reduceMotion = useReducedMotion()
  const stop = watch(
    reduceMotion,
    (enabled) => {
      document.documentElement.classList.toggle(REDUCED_MOTION_CLASS, enabled)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stop()
    document.documentElement.classList.remove(REDUCED_MOTION_CLASS)
  })
}
