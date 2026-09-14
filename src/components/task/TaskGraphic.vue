<script setup lang="ts">
/** @fileoverview Visual bitfield progress graphic for download pieces. */
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppColorTokens } from '@/composables/useColorScheme'

const props = withDefaults(
  defineProps<{
    bitfield?: string
    atomWidth?: number
    atomHeight?: number
    atomGutter?: number
    atomRadius?: number
  }>(),
  {
    bitfield: '',
    atomWidth: 8,
    atomHeight: 8,
    atomGutter: 2,
    atomRadius: 1.5,
  },
)

const { t } = useI18n()
const container = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const containerWidth = ref(300)
const colorTokens = useAppColorTokens()

function updateWidth() {
  if (container.value) containerWidth.value = container.value.clientWidth
}

let ro: ResizeObserver | null = null
onMounted(() => {
  updateWidth()
  if (container.value) {
    ro = new ResizeObserver(() => {
      updateWidth()
      nextTick(draw)
    })
    ro.observe(container.value)
  }
})
onBeforeUnmount(() => {
  ro?.disconnect()
})

const len = computed(() => props.bitfield.length)
const atomWG = computed(() => props.atomWidth + props.atomGutter)
const atomHG = computed(() => props.atomHeight + props.atomGutter)

const columnCount = computed(() => {
  const cols = Math.floor((containerWidth.value - props.atomWidth) / atomWG.value) + 1
  return Math.max(cols, 1)
})

const rowCount = computed(() => Math.ceil(len.value / columnCount.value))

const canvasWidth = computed(() => atomWG.value * (columnCount.value - 1) + props.atomWidth)
const canvasHeight = computed(() => atomHG.value * (rowCount.value - 1) + props.atomHeight)

function draw() {
  const cvs = canvas.value
  if (!cvs || !props.bitfield) return

  const dpr = window.devicePixelRatio || 1
  const w = canvasWidth.value
  const h = canvasHeight.value

  cvs.width = w * dpr
  cvs.height = h * dpr
  cvs.style.width = w + 'px'
  cvs.style.height = h + 'px'

  const ctx = cvs.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const cols = columnCount.value
  const aw = props.atomWidth
  const ah = props.atomHeight
  const awg = atomWG.value
  const ahg = atomHG.value
  const r = props.atomRadius
  const bf = props.bitfield
  const n = bf.length

  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * awg
    const y = row * ahg
    const status = Math.floor(parseInt(bf[i], 16) / 4)

    ctx.fillStyle = status > 0 ? colorTokens.value.primary.color : colorTokens.value.surfaceContainerHighest
    ctx.globalAlpha = status > 0 ? status / 3 : 1
    ctx.beginPath()
    ctx.roundRect(x, y, aw, ah, r)
    ctx.fill()
  }

  ctx.globalAlpha = 1.0
}

watch(
  () => props.bitfield,
  () => nextTick(draw),
)
watch([canvasWidth, canvasHeight], () => nextTick(draw))
watch(colorTokens, () => nextTick(draw))
onMounted(() => nextTick(draw))
</script>

<template>
  <div ref="container" class="task-graphic-container">
    <canvas v-if="bitfield" ref="canvas" class="task-graphic" />
    <div v-else class="no-bitfield">{{ t('about.unavailable') }}</div>
  </div>
</template>

<style scoped>
.task-graphic-container {
  width: 100%;
  padding: 8px 0;
  overflow: hidden;
}
.task-graphic {
  display: block;
}
.no-bitfield {
  color: var(--m3-on-surface-variant);
  font-size: 12px;
  padding: 8px 0;
}
</style>
