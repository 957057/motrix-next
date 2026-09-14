<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCheckbox, NIcon, NButton, NCollapseTransition } from 'naive-ui'
import { DocumentOutline, ChevronForwardOutline, ReorderTwoOutline } from '@vicons/ionicons5'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion-v'
import { useTaskCardModel } from '@/composables/useTaskCardModel'
import { useTaskFileMissing } from '@/composables/useTaskFileMissing'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useTaskViewStore } from '@/stores/taskView'
import { usePreferenceStore } from '@/stores/preference'
import TaskItemActions from './TaskItemActions.vue'
import TransitionText from '@/components/common/TransitionText.vue'
import type { Aria2Task } from '@shared/types'

const props = defineProps<{
  task: Aria2Task
  pending?: boolean
  draggable?: boolean
  heading?: string
  layoutRevision?: string
}>()
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
  'drag-start': []
  'drag-end': []
  move: [direction: -1 | 1]
}>()
const { t } = useI18n()
const view = useTaskViewStore()
const preference = usePreferenceStore()
const reduceMotion = useReducedMotion()
const controls = useDragControls()
const groupTitle = ref(props.heading ?? '')
watch(
  () => props.heading,
  (heading) => {
    if (heading) groupTitle.value = heading
  },
)
const taskRef = computed(() => props.task)
const sourceUrl = computed(() => props.task.files?.[0]?.uris?.[0]?.uri ?? '')
const {
  taskFullName,
  statusBadge,
  isActive,
  indeterminate,
  percent,
  completedSize,
  totalSize,
  hasSizeInfo,
  downloadSpeed,
  uploadSpeed,
  remainingText,
  isSharing,
  sharingKind,
} = useTaskCardModel(taskRef)
const { fileMissing } = useTaskFileMissing(taskRef)
const expanded = computed(() => view.expanded === props.task.gid)
const compact = computed(() => preference.config.taskCardMode === 'compact')
const transferring = computed(() => isActive.value || isSharing.value)
const showProgress = computed(() => ['active', 'waiting', 'paused'].includes(props.task.status) && !sharingKind.value)
const transition = computed(() => ({
  duration: reduceMotion.value ? 0 : 0.2,
  ease: [0.2, 0, 0, 1] as [number, number, number, number],
}))
function toggleExpanded() {
  view.expanded = expanded.value ? null : props.task.gid
}
</script>

<template>
  <component
    :is="draggable ? Reorder.Item : motion.li"
    :value="task.gid"
    :drag-controls="controls"
    :drag-listener="false"
    :drag-elastic="0"
    :drag-momentum="false"
    layout="position"
    :layout-dependency="layoutRevision"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :exit="{ opacity: 0 }"
    :transition="transition"
    class="task-entry"
    @drag-start="emit('drag-start')"
    @drag-end="emit('drag-end')"
  >
    <NCollapseTransition :show="Boolean(heading)">
      <h2 class="group-heading"><TransitionText :text="groupTitle" /></h2>
    </NCollapseTransition>
    <article
      class="task-row"
      :class="{ compact, expanded, selected: view.selected.includes(task.gid) }"
      :aria-busy="pending || undefined"
    >
      <div class="row-summary">
        <NCheckbox
          v-if="view.selecting"
          :checked="view.selected.includes(task.gid)"
          :aria-label="taskFullName"
          @update:checked="view.toggleSelection(task.gid, $event)"
        />
        <button
          v-else-if="draggable"
          class="icon-button drag-handle"
          :aria-label="t('task.sort-manual')"
          @pointerdown="controls.start($event)"
          @keydown.up.prevent="emit('move', -1)"
          @keydown.down.prevent="emit('move', 1)"
        >
          <NIcon :size="20"><ReorderTwoOutline /></NIcon>
        </button>
        <NIcon v-else class="file-icon" :size="24"><DocumentOutline /></NIcon>
        <div class="row-content">
          <button
            class="task-name"
            :title="taskFullName"
            :aria-expanded="expanded"
            :aria-controls="`details-${task.gid}`"
            @click="toggleExpanded"
          >
            {{ taskFullName }}
          </button>
          <div class="row-meta" :class="{ error: task.status === 'error' || fileMissing }">
            <TransitionText :text="fileMissing ? t('task.file-not-exist') : (statusBadge?.label ?? '')" />
            <span v-if="!fileMissing && transferring">
              · {{ isSharing ? '↑ ' : '↓ ' }}{{ isSharing ? uploadSpeed : downloadSpeed }}/s</span
            >
            <span v-if="!fileMissing && remainingText && !isSharing && isActive" class="remaining">
              · {{ remainingText }}</span
            >
            <span v-else-if="!transferring && hasSizeInfo"> · {{ totalSize }}</span>
          </div>
          <div v-if="showProgress" class="progress-line">
            <progress :value="indeterminate ? undefined : percent" max="100" :aria-label="taskFullName" /><span>{{
              indeterminate ? '—' : `${Math.round(percent)}%`
            }}</span>
          </div>
        </div>
        <TaskItemActions
          :task="task"
          :pending="pending || view.selecting"
          :file-missing="fileMissing"
          @pause="emit('pause', task)"
          @resume="emit('resume', task)"
          @retry="emit('retry', task)"
          @redownload="emit('redownload', task)"
          @finish-sharing="emit('finish-sharing', task)"
          @finish-media="emit('finish-media', task)"
          @delete="emit('delete', task)"
          @delete-record="emit('delete-record', task)"
          @copy-link="emit('copy-link', task)"
          @show-info="emit('show-info', task)"
          @folder="emit('folder', task)"
          @open-file="emit('open-file', task)"
          @select-files="emit('select-files', task)"
        />
      </div>
      <AnimatePresence :initial="false">
        <motion.div
          v-if="expanded"
          :id="`details-${task.gid}`"
          key="details"
          :initial="{ height: 0, opacity: 0 }"
          :animate="{ height: 'auto', opacity: 1 }"
          :exit="{ height: 0, opacity: 0 }"
          :transition="transition"
          class="quick-details"
        >
          <div class="quick-details-inner">
            <p v-if="task.errorMessage" class="error">{{ task.errorMessage }}</p>
            <dl class="quick-metrics">
              <div v-if="hasSizeInfo">
                <dt>{{ t('task.task-file-size') }}</dt>
                <dd>{{ completedSize }} / {{ totalSize }}</dd>
              </div>
              <div v-if="task.connections">
                <dt>{{ t('task.task-connections') }}</dt>
                <dd>{{ task.connections }}</dd>
              </div>
              <div v-if="remainingText">
                <dt>{{ t('task.remaining-prefix') }}</dt>
                <dd>{{ remainingText }}</dd>
              </div>
              <div v-if="task.dir">
                <dt>{{ t('task.task-dir') }}</dt>
                <dd>
                  <button class="path-link" @click="emit('folder', task)">{{ task.dir }}</button>
                </dd>
              </div>
              <div v-if="sourceUrl">
                <dt>{{ t('task.task-tab-sources') }}</dt>
                <dd>
                  <button class="path-link" @click="emit('copy-link', task)">{{ sourceUrl }}</button>
                </dd>
              </div>
            </dl>
            <NButton text type="primary" @click="emit('show-info', task)"
              >{{ t('task.task-detail-title')
              }}<template #icon
                ><NIcon><ChevronForwardOutline /></NIcon></template
            ></NButton>
          </div>
        </motion.div>
      </AnimatePresence>
    </article>
  </component>
</template>

<style scoped>
.task-entry {
  position: relative;
  list-style: none;
}
.group-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--m3-on-surface-variant);
  padding-block: 24px 8px;
  margin: 0;
}
.group-heading::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--divider);
}
.task-entry:first-child .group-heading {
  padding-top: 8px;
}
.task-row {
  border-radius: 6px;
  transition: background-color 120ms ease;
}
.task-row:hover {
  background: var(--interaction-hover);
}
.task-row.selected,
.task-row.expanded {
  background: var(--selection-bg);
}
.row-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 80px;
  padding: 12px 8px;
  box-sizing: border-box;
}
.file-icon {
  flex-shrink: 0;
  color: var(--m3-outline);
}
.row-content {
  flex: 1;
  min-width: 0;
}
.task-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  padding: 0;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  background: transparent;
  color: var(--m3-on-surface);
  cursor: pointer;
  text-align: start;
}
.row-meta {
  font-size: 13px;
  line-height: 20px;
  color: var(--m3-on-surface-variant);
  font-variant-numeric: tabular-nums;
}
.progress-line {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 560px;
  margin-top: 5px;
}
.progress-line span {
  width: 34px;
  font-size: 12px;
  color: var(--m3-on-surface-variant);
  font-variant-numeric: tabular-nums;
}
progress {
  appearance: none;
  width: 100%;
  height: 4px;
  display: block;
  border: 0;
  border-radius: 3px;
  background: var(--progress-track);
  color: var(--m3-primary);
}
progress::-webkit-progress-bar {
  border-radius: 3px;
  background: var(--progress-track);
}
progress::-webkit-progress-value {
  border-radius: 3px;
  background: var(--m3-primary);
  transition: width 240ms linear;
}
progress::-moz-progress-bar {
  border-radius: 3px;
  background: var(--m3-primary);
}
progress:indeterminate {
  opacity: 0.5;
}
.compact .row-summary {
  min-height: 48px;
  gap: 12px;
  padding-block: 8px;
}
.compact .row-content {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(80px, 160px) minmax(130px, auto);
  column-gap: 16px;
  align-items: center;
}
.compact .task-name {
  grid-column: 1;
  grid-row: 1;
  font-size: 14px;
}
.compact .row-meta {
  grid-column: 3;
  grid-row: 1;
  font-size: 12px;
  text-align: end;
}
.compact .remaining {
  display: none;
}
.compact .progress-line {
  grid-column: 2;
  grid-row: 1;
  margin: 0;
}
.compact .progress-line span {
  display: block;
}
@media (max-width: 800px) {
  .compact .row-content {
    grid-template-columns: minmax(100px, 1fr) minmax(80px, 120px);
  }
  .compact .row-meta {
    grid-column: 2;
  }
  .compact .progress-line {
    grid-column: 1 / -1;
    grid-row: 2;
    margin-top: 4px;
  }
}
.quick-details {
  overflow: hidden;
}
.quick-details-inner {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px 16px 48px;
  color: var(--m3-on-surface-variant);
  font-size: 13px;
}
.quick-details-inner p {
  margin: 0;
}
.path-link {
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: start;
  padding: 0;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.path-link:hover {
  color: var(--m3-primary);
}
.error {
  color: var(--m3-error);
}
.drag-handle {
  touch-action: none;
  cursor: grab;
}
@media (max-width: 479px) {
  .row-summary {
    gap: 10px;
  }
  .file-icon {
    display: none;
  }
  .compact .row-content {
    display: block;
  }
  .compact .row-meta {
    text-align: start;
  }
  .quick-details-inner {
    padding-inline-start: 8px;
  }
}
.quick-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.quick-metrics > div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 16px;
}
.quick-metrics dt {
  color: var(--m3-on-surface-variant);
}
.quick-metrics dd {
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .quick-metrics > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
