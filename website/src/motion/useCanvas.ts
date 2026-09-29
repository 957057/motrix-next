/**
 * @fileoverview A 2-D canvas sized to its element at the device pixel ratio.
 * `frame()` returns a cleared context in CSS pixels, or null while hidden.
 */
import { useDevicePixelRatio, useElementSize } from '@vueuse/core'
import type { Ref } from 'vue'

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
}

export function useCanvas(canvas: Ref<HTMLCanvasElement | null>, maxDpr = 2) {
  const size = useElementSize(canvas, undefined, { box: 'content-box' })
  const { pixelRatio } = useDevicePixelRatio()

  function frame(): CanvasFrame | null {
    const el = canvas.value
    const w = size.width.value
    const h = size.height.value
    if (!el || !w || !h) return null
    const dpr = Math.min(maxDpr, pixelRatio.value || 1)
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    // Resizing the bitmap clears it, so only do it when the size really changes.
    if (el.width !== bw || el.height !== bh) {
      el.width = bw
      el.height = bh
    }
    const ctx = el.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    return { ctx, w, h }
  }

  return { frame, width: size.width, height: size.height }
}
