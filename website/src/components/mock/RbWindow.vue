<script setup lang="ts">
/**
 * @fileoverview A live HTML rebuild of the Rayburst main window: AppSidebar,
 * the task toolbar, TaskItem cards, the pager, the Speedometer capsule and the
 * completion toasts (useNotificationToast).
 *
 * The window is laid out at real CSS pixel sizes and scaled as a whole to its
 * container, so it stays crisp and keeps the app's proportions. Narrow
 * containers switch to a list-only layout instead of shrinking the text away:
 *   wide   1100 px  sidebar + list + pager + speedometer
 *   mid     760 px  list + speedometer
 *   narrow  440 px  list only, no action pill
 */
import { useElementSize } from '@vueuse/core'
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import type { Translate } from '@/i18n'
import { bytes } from '@/sim/format'
import type { SceneFrame, TaskId, Toast } from '@/sim/tasks'
import type { IconName } from '@/ui/icons'
import TaskCard from './TaskCard.vue'
import type { WindowSpot } from './types'

const props = withDefaults(
  defineProps<{
    frame: SceneFrame
    toasts?: Toast[]
    tr?: Translate
    /** Window height in the wide layout. */
    height?: number
    /** Rows to reserve in the list-only layouts. */
    rows?: number
    /** Container width from which the sidebar layout is used. */
    wideFrom?: number
    /** Never taller than this element (scaled down and centred). */
    match?: HTMLElement | null
    spot?: WindowSpot
    focus?: TaskId[]
  }>(),
  { toasts: () => [], tr: undefined, height: 680, rows: 4, wideFrom: 900, match: null, spot: null, focus: () => [] },
)

const TIERS = [
  { name: 'wide', w: 1100 },
  { name: 'mid', min: 560, w: 760 },
  { name: 'narrow', min: 0, w: 440 },
] as const

const SIDEBAR: [IconName, string, keyof SceneFrame['counts']][] = [
  ['list-outline', 'ui.all', 'all'],
  ['play-outline', 'ui.progress', 'progress'],
  ['alert-circle-outline', 'ui.failed', 'failed'],
  ['checkmark-done-outline', 'ui.completed', 'completed'],
]
const TOOLS: IconName[] = [
  'swap-vertical-outline',
  'refresh-outline',
  'play-outline',
  'pause-outline',
  'stop-circle-outline',
  'close-outline',
  'trash-outline',
]

const { t } = useI18n()
const tr = computed<Translate>(() => props.tr ?? ((key, named) => t(key, named ?? {})))

const host = ref<HTMLElement | null>(null)
const win = ref<HTMLElement | null>(null)
const group = ref<ComponentPublicInstance | null>(null)
const { width: hostWidth } = useElementSize(host)
const { height: winHeight } = useElementSize(win, undefined, { box: 'border-box' })
const { height: matchHeight } = useElementSize(() => props.match, undefined, { box: 'border-box' })

const tier = computed(() => {
  const cw = hostWidth.value
  if (cw >= props.wideFrom) return TIERS[0]
  return cw >= TIERS[1].min ? TIERS[1] : TIERS[2]
})
const scale = computed(() => {
  const cw = hostWidth.value
  if (!cw) return 1
  let k = cw / tier.value.w
  if (props.match && matchHeight.value && winHeight.value) k = Math.min(k, matchHeight.value / winHeight.value)
  return k
})
const offset = computed(() => (hostWidth.value - tier.value.w * scale.value) / 2)
const wide = computed(() => tier.value.name === 'wide')

const winStyle = computed(() => ({
  width: `${tier.value.w}px`,
  height: wide.value ? `${props.height}px` : 'auto',
  transform: `translateX(${offset.value.toFixed(1)}px) scale(${scale.value})`,
}))
const hostStyle = computed(() => ({ height: `${Math.ceil(winHeight.value * scale.value)}px` }))
const listStyle = computed(() => (wide.value ? {} : { minHeight: `${props.rows * 136 - 16}px` }))

/** The task list element (ribbons and beams land at its top). */
const listEl = (): HTMLElement | null => (group.value?.$el as HTMLElement | undefined) ?? null
const cardEl = (id: TaskId): HTMLElement | null => listEl()?.querySelector<HTMLElement>(`[data-task="${id}"]`) ?? null

defineExpose({ listEl, cardEl, scale })
</script>

<template>
  <div ref="host" class="rbw" :data-tier="tier.name" :style="hostStyle">
    <div
      ref="win"
      class="rbw-win"
      :class="{ 'is-active': frame.speed.active }"
      role="img"
      aria-label="Rayburst"
      :style="winStyle"
    >
      <aside class="rbw-side" :class="{ 'is-spot': spot === 'side' }">
        <div class="rbw-side-title">{{ tr('ui.tasks') }}</div>
        <ul class="rbw-nav">
          <li v-for="([icon, key, id], i) in SIDEBAR" :key="id" :class="{ 'is-on': i === 0 }">
            <AppIcon :name="icon" /><span>{{ tr(key) }}</span
            ><b>{{ frame.counts[id] }}</b>
          </li>
        </ul>
        <ul class="rbw-nav rbw-nav-end">
          <li>
            <AppIcon name="information-circle-outline" /><span>{{ tr('ui.about') }}</span>
          </li>
          <li>
            <AppIcon name="settings-outline" /><span>{{ tr('ui.settings') }}</span>
          </li>
        </ul>
      </aside>
      <section class="rbw-main">
        <div class="rbw-controls">
          <AppIcon name="remove-outline" /><AppIcon name="square-outline" /><AppIcon name="close-outline" />
        </div>
        <header class="rbw-toolbar" :class="{ 'is-spot': spot === 'tools' }">
          <span class="rbw-heading">{{ tr('ui.all') }}</span>
          <span class="rbw-tools">
            <i class="rbw-add"><AppIcon name="add-outline" /></i>
            <AppIcon v-for="(n, i) in TOOLS" :key="n" :name="n" :class="{ on: i < 2 }" />
          </span>
        </header>
        <TransitionGroup ref="group" tag="div" name="rbw-slot" class="rbw-list" :style="listStyle">
          <TaskCard v-for="task in frame.tasks" :key="task.id" :task="task" :focus="focus.includes(task.id)" />
        </TransitionGroup>
        <footer class="rbw-foot">
          <span class="rbw-pager"
            ><AppIcon name="chevron-back-outline" /><b>1</b><AppIcon name="chevron-forward-outline"
          /></span>
          <span class="rbw-speed" :class="{ 'is-spot': spot === 'speed' }">
            <AppIcon name="speedometer-outline" class="rbw-speed-ic" />
            <span class="rbw-speed-rows">
              <span
                ><AppIcon name="arrow-up-outline" /><em>{{ bytes(frame.speed.up) }}/s</em></span
              >
              <span
                ><AppIcon name="arrow-down-outline" /><em>{{ bytes(frame.speed.down) }}/s</em></span
              >
            </span>
            <span class="rbw-speed-lim"><i /><span>∞</span><span>∞</span></span>
          </span>
        </footer>
        <TransitionGroup tag="div" name="rbw-toast" class="rbw-toasts">
          <div v-for="toast in toasts" :key="toast.id" class="rbw-toast">
            <i class="rbw-toast-ok"><AppIcon name="checkmark-outline" /></i>
            <span class="rbw-toast-t">{{ toast.text }}</span>
            <b>{{ tr('ui.openFile') }}</b
            ><b>{{ tr('ui.showInFolder') }}</b>
          </div>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>
