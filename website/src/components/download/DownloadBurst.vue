<script setup lang="ts">
/**
 * @fileoverview Rays of light turning slowly behind the logo, with one ring
 * when the section arrives.
 */
import { useElementBounding } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { EASE, hash, prog } from '@/motion/gsap'
import { useCanvas } from '@/motion/useCanvas'

const props = defineProps<{ time: number; logo: HTMLElement | null }>()

const RAYS = 30
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
  const size = logoBox.width.value || 96
  const ox = logoBox.left.value - canvasBox.left.value + size / 2
  const oy = logoBox.top.value - canvasBox.top.value + logoBox.height.value / 2
  const intro = EASE.enter(prog(time, 0.1, 1.6))
  const reach = Math.hypot(w, h) * 0.55 * intro
  ctx.globalCompositeOperation = lite ? 'source-over' : 'lighter'
  for (let i = 0; i < RAYS; i++) {
    const angle = (i / RAYS) * Math.PI * 2 + hash(i, 7) * 0.2 + time * 0.035
    const pulse = 0.55 + 0.45 * Math.sin(time * (0.35 + hash(i, 8) * 0.5) + i * 1.7)
    const len = reach * (0.45 + 0.55 * hash(i, 9)) * (0.75 + 0.25 * pulse)
    if (len <= size * 0.3) continue
    const spread = 0.012 + 0.02 * hash(i, 10)
    const alpha = (0.05 + 0.1 * pulse) * (lite ? 0.55 : 1)
    const grad = ctx.createRadialGradient(ox, oy, size * 0.3, ox, oy, len)
    const rgb = lite ? '123,62,209' : '200,168,255'
    grad.addColorStop(0, `rgba(${rgb},${alpha})`)
    grad.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.arc(ox, oy, len, angle - spread, angle + spread)
    ctx.closePath()
    ctx.fill()
  }
  const ring = prog(time, 0.35, 1.5)
  if (ring > 0 && ring < 1) {
    ctx.strokeStyle = lite ? `rgba(123,62,209,${0.35 * (1 - ring)})` : `rgba(226,206,255,${0.5 * (1 - ring)})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ox, oy, size * (0.6 + 3.6 * EASE.enter(ring)), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
  const r = size * (2.6 + 0.3 * Math.sin(time * 0.8))
  const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
  glow.addColorStop(0, lite ? `rgba(158,116,213,${0.28 * intro})` : `rgba(150,95,230,${0.45 * intro})`)
  glow.addColorStop(1, 'rgba(150,95,230,0)')
  ctx.fillStyle = glow
  ctx.fillRect(ox - r, oy - r, r * 2, r * 2)
}

watch(
  () => [props.time, theme.state.value, canvasBox.width.value] as const,
  ([time]) => draw(time),
  { flush: 'post' },
)
</script>

<template>
  <canvas ref="canvas" class="get-fx" aria-hidden="true" />
</template>

<style scoped>
.get-fx {
  position: absolute;
  inset: -20% -30vw -10%;
  width: calc(100% + 60vw);
  height: 130%;
  z-index: -1;
  pointer-events: none;
  -webkit-mask-image: radial-gradient(closest-side, #000 55%, transparent);
  mask-image: radial-gradient(closest-side, #000 55%, transparent);
}
</style>
