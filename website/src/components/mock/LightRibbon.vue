<script setup lang="ts">
/**
 * @fileoverview A ribbon of light between two points in an SVG overlay: the
 * stroke draws along an arcing curve and a bright head rides its tip.
 */
import { computed } from 'vue'
import { MotionPathPlugin } from '@/motion/gsap'
import type { Point } from '@/ui/geometry'

const props = defineProps<{
  from: Point
  to: Point
  /** Draw progress 0..1 (already eased). */
  progress: number
  /** Overall opacity 0..1. */
  alpha: number
  color: string
}>()

const d = computed(() => {
  const [x0, y0] = props.from
  const [x1, y1] = props.to
  const dx = x1 - x0
  const dy = y1 - y0
  const lift = Math.min(160, Math.hypot(dx, dy) * 0.35)
  return `M${x0},${y0} C${x0 + dx * 0.35},${y0 - lift} ${x1 - dx * 0.25},${y1 - lift * 0.6} ${x1},${y1}`
})

const head = computed(() => {
  const raw = MotionPathPlugin.cacheRawPathMeasurements(MotionPathPlugin.stringToRawPath(d.value))
  return MotionPathPlugin.getPositionOnPath(raw, props.progress) as { x: number; y: number }
})
const offset = computed(() => String(1 - props.progress))
const showHead = computed(() => props.progress > 0 && props.progress < 1)
</script>

<template>
  <g v-if="alpha > 0" :style="{ opacity: alpha }">
    <path
      :d="d"
      fill="none"
      :stroke="color"
      stroke-width="10"
      stroke-linecap="round"
      pathLength="1"
      stroke-dasharray="1 1"
      :stroke-dashoffset="offset"
      opacity="0.25"
      style="filter: blur(4px)"
    />
    <path
      :d="d"
      fill="none"
      :stroke="color"
      stroke-width="2.5"
      stroke-linecap="round"
      pathLength="1"
      stroke-dasharray="1 1"
      :stroke-dashoffset="offset"
    />
    <circle
      v-if="showHead"
      :cx="head.x"
      :cy="head.y"
      r="5"
      fill="#fff"
      :style="{ filter: `drop-shadow(0 0 8px ${color})` }"
    />
  </g>
</template>
