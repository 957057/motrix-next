<script setup lang="ts">
/**
 * @fileoverview 01 · Parallel connections: the connection count climbs to 48
 * and the file's 48 ranges fill side by side above the real card. Their
 * average is exactly the card's progress, and the file completes before the
 * tab ends.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskCard from '@/components/mock/TaskCard.vue'
import DetailCopy from './DetailCopy.vue'
import { clamp, hash } from '@/motion/gsap'
import { useCanvas } from '@/motion/useCanvas'
import { MB } from '@/sim/format'
import { KINDS } from '@/sim/tasks'
import { cssVar, themeColors } from './themeColors'

const props = defineProps<{ time: number; active: boolean }>()
const { t } = useI18n()
const tr = (key: string, named?: Record<string, unknown>) => t(key, named ?? {})

const RANGES = 48
const ACCENT = '#b98cf0'
/** Per-connection lead or lag, centred so the ranges always average to the file's progress. */
const LEAD = (() => {
  const raw = Array.from({ length: RANGES }, (_, k) => hash(k, 9) - 0.5)
  const mean = raw.reduce((a, b) => a + b, 0) / RANGES
  return raw.map((x) => x - mean)
})()

// 372 MB over 48 connections: done at about 5.4 s, so the tab ends on "Completed".
const task = KINDS.http(0, 0.04, 70 * MB)
const view = computed(() => task(props.time, tr))

const canvas = ref<HTMLCanvasElement | null>(null)
const { frame } = useCanvas(canvas)

function draw() {
  const v = view.value
  const f = frame()
  const el = canvas.value
  if (!f || !v || v.progress == null || !el) return
  const { ctx, w, h } = f
  const cols = w > 520 ? 12 : 8
  const rows = RANGES / cols
  const gap = 6
  const cw = (w - gap * (cols - 1)) / cols
  const ch = (h - gap * (rows - 1)) / rows
  const [rail] = themeColors('rail', () => [cssVar(el, '--line')])
  const p = v.progress
  // Each connection owns 1/48 of the file. Ranges run a little ahead or behind
  // (never at 0 % or 100 %), so together they add up to the card's progress.
  const spread = 1.2 * Math.min(p, 1 - p)
  for (let k = 0; k < RANGES; k++) {
    const x = (k % cols) * (cw + gap)
    const y = Math.floor(k / cols) * (ch + gap)
    const fill = clamp(p + spread * LEAD[k])
    ctx.fillStyle = rail
    ctx.beginPath()
    ctx.roundRect(x, y, cw, ch, 4)
    ctx.fill()
    if (fill <= 0) continue
    const fw = Math.max(4, cw * fill)
    const grad = ctx.createLinearGradient(x, 0, x + fw, 0)
    grad.addColorStop(0, `${ACCENT}55`)
    grad.addColorStop(1, fill < 1 ? '#ffffff' : ACCENT)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x, y, fw, ch, 4)
    ctx.fill()
  }
}

watch(
  () => [props.time, props.active],
  () => props.active && draw(),
  { flush: 'post' },
)
</script>

<template>
  <DetailCopy :n="1" :title="t('d1.title')" :sub="t('d1.sub')">
    <div class="metric">
      <b>{{ view?.right?.conns ?? 48 }}</b
      ><span>{{ t('ui.conns') }}</span>
    </div>
    <div class="metric">
      <b>{{ view?.right?.down ?? '0 KB/s' }}</b
      ><span>{{ t('ui.d.down') }}</span>
    </div>
  </DetailCopy>
  <div class="dp-viz">
    <div class="lanes"><canvas ref="canvas" /></div>
    <div class="dcard rbw rbw-solo"><TaskCard v-if="view" :task="view" /></div>
  </div>
</template>

<style scoped>
.lanes {
  height: 132px;
}
.lanes canvas {
  width: 100%;
  height: 100%;
}
</style>
