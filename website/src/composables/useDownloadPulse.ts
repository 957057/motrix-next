/**
 * @fileoverview Links to #download glide down to the section; once the page
 * arrives, the main download button glows once.
 */
import { ref } from 'vue'

const pulses = ref(0)

export function useDownloadPulse() {
  return {
    pulses,
    /** Call from a click on a link to #download. */
    request() {
      pulses.value++
    },
  }
}
