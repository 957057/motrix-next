<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AnimatePresence, motion, Reorder } from 'motion-v'
import { NButton } from 'naive-ui'
import { useTaskStore } from '@/stores/task'
import { useTaskViewStore } from '@/stores/taskView'
import { usePreferenceStore } from '@/stores/preference'
import { getBtLifecycleState } from '@/composables/useBtLifecycle'
import { isPendingMagnetSelectionTask } from '@/composables/useMagnetFlow'
import { logger } from '@shared/logger'
import TaskRow from './TaskRow.vue'
import type { Aria2Task } from '@shared/types'

const emit = defineEmits<{
  pause: [task: Aria2Task]
  resume: [task: Aria2Task]
  retry: [task: Aria2Task]
  redownload: [task: Aria2Task]
  'finish-sharing': [task: Aria2Task]
  'finish-media': [task: Aria2Task]
  delete: [task: Aria2Task]
  'delete-record': [task: Aria2Task]
  'copy-link': [task: Aria2Task]
  'show-info': [task: Aria2Task]
  folder: [task: Aria2Task]
  'open-file': [task: Aria2Task]
  'select-files': [task: Aria2Task]
}>()
const { t, locale } = useI18n()
const tasks = useTaskStore()
const view = useTaskViewStore()
const preference = usePreferenceStore()
const dragging = ref(false)
const order = ref<string[]>([])
const manual = computed(
  () => preference.config.taskSort[tasks.displayedList].field === 'manual' && !view.query && !view.selecting,
)
const page = computed(() => tasks.taskList)
function group(task: Aria2Task) {
  if (
    getBtLifecycleState(task) === 'error' ||
    task.status === 'error' ||
    task.media?.state === 'awaiting-selection' ||
    isPendingMagnetSelectionTask(task)
  )
    return 'attention'
  return task.status === 'complete' ? 'completed' : 'progress'
}
const groupLabels = computed(() => ({
  progress: t('task.scope-progress'),
  attention: t('workspace.needs-action'),
  completed: t('task.scope-completed'),
}))
const rows = computed(() => {
  if (manual.value)
    return order.value
      .map((gid) => page.value.find((task) => task.gid === gid))
      .filter((task): task is Aria2Task => !!task)
  if (tasks.displayedList !== 'all') return page.value
  return ['progress', 'attention', 'completed'].flatMap((key) => page.value.filter((task) => group(task) === key))
})
const hasSearch = computed(() => !!view.query.trim())
const showEmpty = computed(
  () => !tasks.queryError && tasks.taskPagination[tasks.displayedList].loaded && !rows.value.length,
)
const layoutRevision = computed(() =>
  [
    tasks.displayedList,
    preference.config.taskCardMode,
    view.expanded,
    locale.value,
    ...rows.value.map((task) => `${task.gid}:${task.status}:${task.media?.state ?? ''}:${getBtLifecycleState(task)}`),
  ].join('|'),
)
watch(
  page,
  (value) => {
    if (!dragging.value) order.value = value.map((task) => task.gid)
  },
  { immediate: true },
)
watch(
  () => [tasks.displayedList, tasks.taskPagination[tasks.displayedList].page, view.query],
  () => view.clearSelection(),
)
async function saveOrder() {
  try {
    await tasks.saveVisiblePageManualOrder(rows.value)
  } catch (error) {
    logger.error('TaskList.reorder', error)
  } finally {
    dragging.value = false
    order.value = page.value.map((task) => task.gid)
  }
}
function move(gid: string, direction: -1 | 1) {
  const ids = [...order.value]
  const index = ids.indexOf(gid)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  order.value = ids
  void saveOrder()
}
</script>
<template>
  <div class="task-list">
    <div v-if="tasks.queryError" class="list-error" role="alert">
      <span>{{ tasks.queryError }}</span
      ><NButton :loading="tasks.listPending" @click="tasks.fetchList()">{{ t('app.retry') }}</NButton>
    </div>
    <Transition
      name="empty"
      @before-leave="(element) => element.setAttribute('inert', '')"
      @before-enter="(element) => element.removeAttribute('inert')"
      @leave-cancelled="(element) => element.removeAttribute('inert')"
    >
      <div v-if="showEmpty" class="list-empty" role="status">
        <h2 class="empty-title">{{ hasSearch ? t('workspace.no-results') : t('workspace.empty-tasks') }}</h2>
        <p v-if="!hasSearch && tasks.displayedList === 'all'" class="empty-hint">
          {{ t('workspace.empty-tasks-hint', { action: t('task.new-task') }) }}
        </p>
        <NButton v-if="hasSearch" quaternary @click="view.query = ''">{{ t('workspace.clear') }}</NButton>
      </div>
    </Transition>
    <component
      :is="manual ? Reorder.Group : motion.ul"
      v-model:values="order"
      axis="y"
      class="task-rows"
      layout-scroll
      :inert="tasks.currentList !== tasks.displayedList || undefined"
    >
      <AnimatePresence :initial="false" mode="popLayout">
        <TaskRow
          v-for="(task, index) in rows"
          :key="task.gid"
          :task="task"
          :layout-revision="layoutRevision"
          :draggable="manual"
          :pending="
            tasks.pendingGids.includes(task.gid) ||
            tasks.removingGids.includes(task.gid) ||
            tasks.resubmittingGids.includes(task.gid)
          "
          :heading="
            !manual && tasks.displayedList === 'all' && (index === 0 || group(rows[index - 1]) !== group(task))
              ? groupLabels[group(task)]
              : undefined
          "
          @pause="emit('pause', $event)"
          @resume="emit('resume', $event)"
          @retry="emit('retry', $event)"
          @redownload="emit('redownload', $event)"
          @finish-sharing="emit('finish-sharing', $event)"
          @finish-media="emit('finish-media', $event)"
          @delete="emit('delete', $event)"
          @delete-record="emit('delete-record', $event)"
          @copy-link="emit('copy-link', $event)"
          @show-info="emit('show-info', $event)"
          @folder="emit('folder', $event)"
          @open-file="emit('open-file', $event)"
          @select-files="emit('select-files', $event)"
          @drag-start="dragging = true"
          @drag-end="saveOrder"
          @move="move(task.gid, $event)"
        />
      </AnimatePresence>
    </component>
  </div>
</template>
<style scoped>
.list-error {
  padding-block: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow-wrap: anywhere;
}
.task-list {
  padding: 0 24px 24px;
  position: relative;
  flex: 1 0 auto;
  min-height: 180px;
}
.task-rows {
  margin: 0;
  padding: 0;
  list-style: none;
  position: relative;
}
.list-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  padding: 24px;
}
.empty-title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: var(--m3-on-surface);
}
.empty-hint {
  max-inline-size: 360px;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--m3-on-surface-variant);
}
.empty-enter-active {
  transition: opacity 120ms ease;
}
.empty-leave-active {
  transition: opacity 90ms ease;
  pointer-events: none;
}
.empty-enter-from,
.empty-leave-to {
  opacity: 0;
}
@media (max-width: 719px) {
  .task-list {
    padding-inline: 16px;
  }
}
</style>
