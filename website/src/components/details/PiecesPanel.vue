<script setup lang="ts">
/**
 * @fileoverview 02 · Every piece: Task Details › Activity, with TaskGraphic's
 * piece map (8 px atoms, 2 px gutters, success ramp) and the description table.
 * Fresh pieces flash as they land.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { hash } from '@/motion/gsap'
import { useCanvas } from '@/motion/useCanvas'
import { bytes } from '@/sim/format'
import { BT, KINDS } from '@/sim/tasks'
import DetailCopy from './DetailCopy.vue'
import { cssVar, resolveColors, themeColors } from './themeColors'

const props = defineProps<{ time: number; active: boolean }>()
const { t } = useI18n()
const tr = (key: string, named?: Record<string, unknown>) => t(key, named ?? {})

const ROWS = ['ui.d.size', 'ui.d.down', 'ui.d.up', 'ui.d.uploaded', 'ui.d.ratio', 'ui.conns']

/** Deterministic permutation rank for the piece order. */
const RANK = (() => {
  const idx = [...Array(BT.atoms).keys()]
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(hash(i, 42) * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const rank = new Array<number>(BT.atoms)
  idx.forEach((atom, k) => (rank[atom] = k))
  return rank
})()

const task = KINDS.bt(-0.001, 0.02, 5.4, 0)
const detail = computed(() => task(props.time, tr)?.detail)
const progress = computed(() => `${Math.floor((detail.value?.progress ?? 0) * 100)}%`)
const values = computed(() => {
  const d = detail.value
  if (!d) return ROWS.map(() => '')
  const p = d.progress
  return [
    `${bytes(BT.size * p, 2)} / ${bytes(BT.size, 2)}`,
    `${bytes(d.v)}/s`,
    `${bytes(d.up)}/s`,
    bytes(d.uploaded, 2),
    (d.uploaded / Math.max(1, BT.size * p)).toFixed(2),
    String(d.conns),
  ]
})

const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { frame, width } = useCanvas(canvas)
const cols = computed(() => Math.max(1, Math.floor((width.value + 2) / 10)))
const height = computed(() => Math.ceil(BT.atoms / cols.value) * 10 - 2)

const lastLevel = new Int8Array(BT.atoms)
const changed = new Float32Array(BT.atoms).fill(-9)
let lastT = -1

function draw(lt: number) {
  const d = detail.value
  const f = frame()
  const el = box.value
  if (!d || !f || !el) return
  if (lt < lastT) {
    lastLevel.fill(0)
    changed.fill(-9)
  }
  lastT = lt
  const p = d.progress
  // TaskGraphic's ramp: surface container → success in quarter steps.
  const solid = themeColors('pieces', () => {
    const empty = cssVar(el, '--w-highest')
    const success = cssVar(el, '--w-success')
    return resolveColors(
      el,
      [0, 0.25, 0.5, 0.75].map((k) => `color-mix(in srgb, ${success} ${Math.round(k * 100)}%, ${empty})`),
    )
  })
  const { ctx } = f
  const c = cols.value
  for (let i = 0; i < BT.atoms; i++) {
    const a = (RANK[i] / BT.atoms) * 0.96
    const count = p >= 1 ? 4 : p < a ? 0 : Math.min(4, Math.floor((p - a) / 0.01) + 1)
    const level = [0, 1, 2, 3, 3][count]
    if (level !== lastLevel[i]) {
      lastLevel[i] = level
      changed[i] = lt
    }
    const x = (i % c) * 10
    const y = Math.floor(i / c) * 10
    ctx.fillStyle = solid[level]
    ctx.beginPath()
    ctx.roundRect(x, y, 8, 8, 2)
    ctx.fill()
    const fresh = Math.exp(-(lt - changed[i]) * 6)
    if (level > 0 && fresh > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * fresh})`
      ctx.fill()
    }
  }
}

watch(
  () => [props.time, props.active, width.value] as const,
  ([time, active]) => active && draw(time),
  { flush: 'post' },
)
</script>

<template>
  <DetailCopy :n="2" :title="t('d2.title')" :sub="t('d2.sub')">
    <div class="metric">
      <b>{{ progress }}</b
      ><span>{{ t('ui.d.progress') }}</span>
    </div>
    <div class="metric">
      <b>{{ detail?.seeders ?? 0 }}</b
      ><span>{{ t('ui.d.seeders') }}</span>
    </div>
  </DetailCopy>
  <div class="dp-viz">
    <div ref="box" class="rbw tdetail">
      <div class="tdetail-head">
        <span>{{ t('ui.detail') }}</span
        ><AppIcon name="close-outline" />
      </div>
      <div class="tdetail-graphic"><canvas ref="canvas" :style="{ height: `${height}px` }" /></div>
      <dl class="tdetail-rows">
        <div v-for="(key, i) in ROWS" :key="key">
          <dt>{{ t(key) }}</dt>
          <dd>{{ values[i] }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.tdetail {
  border-radius: 14px;
  background: var(--w-item);
  border: 1px solid color-mix(in srgb, var(--w-ov) 70%, transparent);
  box-shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.45);
  color: var(--w-text);
  overflow: hidden;
  font-size: 13px;
}
.tdetail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--w-ov);
  font-weight: 600;
  font-size: 15px;
}
.tdetail-head .ic {
  color: var(--w-outline);
  font-size: 16px;
}
.tdetail-graphic {
  padding: 16px 18px 12px;
}
.tdetail-graphic canvas {
  width: 100%;
}
.tdetail-rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0 18px 18px;
  border: 1px solid var(--w-ov);
  border-radius: 6px;
  overflow: hidden;
}
.tdetail-rows div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--w-ov);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tdetail-rows div:nth-child(odd) {
  border-right: 1px solid var(--w-ov);
}
.tdetail-rows div:nth-last-child(-n + 2) {
  border-bottom: 0;
}
.tdetail-rows dt {
  color: var(--w-dim);
}
.tdetail-rows dd {
  margin: 0;
}
</style>
