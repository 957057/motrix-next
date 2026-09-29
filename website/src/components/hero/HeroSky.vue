<script setup lang="ts">
/**
 * @fileoverview The hero backdrop: slow star dust drifting up and to the
 * right, one burst of light from the logo when it fills in, then a breathing
 * glow. Drawn on a canvas from the scene clock.
 */
import { useElementBounding } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useCanvas } from '@/motion/useCanvas'
import { EASE, hash, prog } from '@/motion/gsap'

const props = defineProps<{ time: number; logo: HTMLElement | null }>()

const STARS = 110
const canvas = ref<HTMLCanvasElement | null>(null)
const { frame } = useCanvas(canvas, 1.75)
const theme = useTheme()
const logoBox = useElementBounding(() => props.logo, { windowScroll: false })
const canvasBox = useElementBounding(canvas, { windowScroll: false })

function draw(time: number) {
  const f = frame()
  if (!f) return
  const { ctx, w, h } = f
  const lite = theme.state.value === 'light'
  for (let i = 0; i < STARS; i++) {
    const depth = 0.3 + hash(i, 1) * 0.7
    const x = ((hash(i, 2) * (w + 80) + time * 6 * depth) % (w + 80)) - 40
    const y = ((hash(i, 3) * (h + 80) - time * 10 * depth + (h + 80) * 4) % (h + 80)) - 40
    const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + hash(i, 4) * 1.6) + i)
    const a = (0.1 + 0.45 * tw) * depth * (lite ? 0.55 : 1)
    ctx.fillStyle = lite ? `rgba(123,62,209,${a})` : `rgba(230,218,255,${a})`
    ctx.beginPath()
    ctx.arc(x, y, 0.6 + depth * 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  // The rays converge near the lower-left of the mark; the glow sits at its centre.
  const size = logoBox.width.value || 100
  const ox = logoBox.left.value - canvasBox.left.value + size * 0.5
  const oy = logoBox.top.value - canvasBox.top.value + logoBox.height.value * 0.52
  const burst = prog(time, 0.7, 1.6)
  if (burst > 0 && burst < 1) {
    ctx.globalCompositeOperation = lite ? 'source-over' : 'lighter'
    ctx.strokeStyle = `rgba(214,186,255,${0.55 * (1 - burst)})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ox, oy, size * (0.4 + 3.2 * EASE.enter(burst)), 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }
  const breathe = 0.75 + 0.25 * Math.sin(time * 0.9)
  const g0 = prog(time, 0.7, 0.5) * (1 - 0.6 * prog(time, 1.2, 1.4))
  const r = size * (2.2 + 0.4 * breathe)
  const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
  const glow = lite ? '158,116,213' : '150,95,230'
  grad.addColorStop(0, `rgba(${glow},${(0.22 + 0.35 * g0) * (lite ? 0.6 : 1)})`)
  grad.addColorStop(1, `rgba(${glow},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(ox - r, oy - r, r * 2, r * 2)
}

watch(
  () => [props.time, theme.state.value, logoBox.top.value, canvasBox.width.value] as const,
  ([time]) => draw(time),
  { flush: 'post' },
)
</script>

<template>
  <canvas ref="canvas" class="hero-fx" aria-hidden="true" />
</template>

<style scoped>
.hero-fx {
  position: absolute;
  inset: 0 0 auto;
  width: 100%;
  height: 100svh;
  min-height: 720px;
  z-index: -1;
  pointer-events: none;
}
</style>
