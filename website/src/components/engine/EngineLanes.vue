<script setup lang="ts">
/**
 * @fileoverview Gold data lanes streaming in from the left and converging on
 * the terminal, with packets travelling each lane at its own pace.
 */
import { useElementBounding } from '@vueuse/core'
import { ref, watch } from 'vue'
import { clamp, hash } from '@/motion/gsap'
import { useCanvas } from '@/motion/useCanvas'
import type { Point } from '@/ui/geometry'

const props = defineProps<{ time: number; section: HTMLElement | null; target: HTMLElement | null }>()

const LANES = 18
const canvas = ref<HTMLCanvasElement | null>(null)
const { frame } = useCanvas(canvas, 1.5)
const sectionBox = useElementBounding(() => props.section, { windowScroll: false })
const termBox = useElementBounding(() => props.target, { windowScroll: false })

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const v = 1 - u
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ]
}

function draw(time: number) {
  const f = frame()
  if (!f) return
  const { ctx, w, h } = f
  const x = termBox.left.value - sectionBox.left.value
  const y = termBox.top.value - sectionBox.top.value
  const stacked = x < w * 0.3
  const [tx, ty]: Point = stacked ? [x + termBox.width.value / 2, y] : [x, y + termBox.height.value / 2]
  // Warm core where the lanes arrive.
  const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(w, h) * 0.45)
  glow.addColorStop(0, `rgba(227,192,122,${0.2 + 0.04 * Math.sin(time * 1.2)})`)
  glow.addColorStop(1, 'rgba(227,192,122,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  const intro = clamp(time / 1.2)
  ctx.lineWidth = 1
  for (let i = 0; i < LANES; i++) {
    const y0 = (h * (i + 0.5)) / LANES + (hash(i, 1) - 0.5) * 30
    const p0: Point = [-40, y0]
    const p1: Point = [tx * 0.45, y0]
    const p2: Point = [tx * 0.7, ty + (y0 - ty) * 0.2]
    const p3: Point = [tx, ty + (y0 - ty) * 0.04]
    ctx.strokeStyle = `rgba(227,192,122,${(0.05 + 0.1 * hash(i, 2)) * intro})`
    ctx.beginPath()
    ctx.moveTo(p0[0], p0[1])
    ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
    ctx.stroke()
    const speed = 0.12 + 0.12 * hash(i, 3)
    for (let k = 0; k < 3; k++) {
      const u = (time * speed + hash(i, 4 + k)) % 1
      const [px, py] = bezier(p0, p1, p2, p3, u)
      ctx.fillStyle = `rgba(255,228,170,${0.75 * Math.sin(Math.PI * u) * intro})`
      ctx.fillRect(px - 3, py - 1, 6 + 6 * u, 2)
    }
  }
}

watch(
  () => [props.time, termBox.width.value, sectionBox.width.value] as const,
  ([time]) => draw(time),
  { flush: 'post' },
)
</script>

<template>
  <canvas ref="canvas" class="engine-fx" aria-hidden="true" />
</template>

<style scoped>
.engine-fx {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
}
</style>
