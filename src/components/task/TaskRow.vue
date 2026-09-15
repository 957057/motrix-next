<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCheckbox, NIcon, NButton } from 'naive-ui'
import { ChevronRight, GripVertical } from '@lucide/vue'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion-v'
import { useTaskCardModel } from '@/composables/useTaskCardModel'
import { useTaskFileMissing } from '@/composables/useTaskFileMissing'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useTaskViewStore } from '@/stores/taskView'
import { usePreferenceStore } from '@/stores/preference'
import { checkTaskIsBT } from '@shared/utils'
import { fileKindFromName, type FileKind } from '@shared/utils/fileKind'
import TaskItemActions from './TaskItemActions.vue'
import TransitionText from '@/components/common/TransitionText.vue'
import FileTypeIcon from '@/components/common/FileTypeIcon.vue'
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
const kind = computed<FileKind>(() => {
  if (props.task.media) return 'stream'
  if (checkTaskIsBT(props.task) && (props.task.files?.length ?? 0) > 1) return 'folder'
  return fileKindFromName(taskFullName.value)
})
const tone = computed(() => {
  if (fileMissing.value || props.task.status === 'error') return 'error'
  const badge = statusBadge.value?.tone
  if (badge === 'success') return 'success'
  if (badge === 'error') return 'error'
  if (badge === 'waiting') return isActive.value ? 'active' : 'info'
  return undefined
})
const progressState = computed(() => {
  if (props.task.status === 'paused') return 'rb-progress--paused'
  if (props.task.status === 'error') return 'rb-progress--error'
  return ''
})
const transition = computed(() => ({
  duration: reduceMotion.value ? 0 : 0.22,
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
    :class="{ 'group-start': Boolean(heading) }"
    @drag-start="emit('drag-start')"
    @drag-end="emit('drag-end')"
  >
    <h2 v-if="heading" class="group-heading"><TransitionText :text="heading" /></h2>
    <article
      class="task-row"
      :class="{ compact, expanded, active: transferring, selected: view.selected.includes(task.gid) }"
      :aria-busy="pending || undefined"
    >
      <div class="row-summary">
        <div class="row-leading">
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
            <NIcon :size="18"><GripVertical /></NIcon>
          </button>
          <FileTypeIcon v-else :kind="kind" :size="compact ? 28 : 38" />
        </div>
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
            <span class="rb-pill" :data-tone="tone">
              <TransitionText :text="fileMissing ? t('task.file-not-exist') : (statusBadge?.label ?? '')" />
            </span>
            <span v-if="!fileMissing && transferring" class="row-speed">
              {{ isSharing ? '↑' : '↓' }} {{ isSharing ? uploadSpeed : downloadSpeed }}/s
            </span>
            <span v-if="!fileMissing && remainingText && !isSharing && isActive" class="row-remaining">{{
              remainingText
            }}</span>
            <span v-else-if="!transferring && hasSizeInfo" class="row-size">{{ totalSize }}</span>
          </div>
          <div v-if="showProgress" class="progress-line">
            <progress
              class="rb-progress"
              :class="progressState"
              :value="indeterminate ? undefined : percent"
              max="100"
              :aria-label="taskFullName"
            />
            <span class="progress-percent">{{ indeterminate ? '—' : `${Math.round(percent)}%` }}</span>
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
                  <button class="path-link rb-mono" @click="emit('folder', task)">{{ task.dir }}</button>
                </dd>
              </div>
              <div v-if="sourceUrl">
                <dt>{{ t('task.task-tab-sources') }}</dt>
                <dd>
                  <button class="path-link rb-mono" @click="emit('copy-link', task)">{{ sourceUrl }}</button>
                </dd>
              </div>
            </dl>
            <NButton text type="primary" class="details-link" @click="emit('show-info', task)"
              >{{ t('task.task-detail-title')
              }}<template #icon
                ><NIcon><ChevronRight /></NIcon></template
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
  margin: 0 0 8px 4px;
  padding-top: 22px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--rb-text-muted);
}

.task-entry:first-child .group-heading {
  padding-top: 0;
}

.task-row {
  position: relative;
  background: var(--rb-raised);
  box-shadow: 0 0 0 1px var(--rb-hairline);
  transition: background-color var(--rb-motion-feedback) var(--rb-ease);
}

.group-start .task-row,
.task-entry:first-child .task-row {
  border-start-start-radius: var(--rb-radius-card);
  border-start-end-radius: var(--rb-radius-card);
}

.task-entry:last-child .task-row,
.task-entry:has(+ .group-start) .task-row {
  border-end-start-radius: var(--rb-radius-card);
  border-end-end-radius: var(--rb-radius-card);
}

.task-row:hover {
  background: color-mix(in srgb, var(--rb-raised) 100%, var(--rb-hover));
}

.task-row.selected,
.task-row.expanded {
  background: color-mix(in srgb, var(--rb-raised) 100%, var(--rb-selected));
}

/* Light edge on transferring rows: the row itself is a source of light. */
.task-row.active::before {
  content: '';
  position: absolute;
  inset-block: 14px;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--rb-gradient);
  box-shadow: 0 0 12px var(--rb-glow);
}

.row-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 74px;
  padding: 12px 12px 12px 16px;
}

.row-leading {
  display: grid;
  place-items: center;
  flex: none;
  min-width: 38px;
}

.row-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  font: inherit;
  font-size: 14px;
  font-weight: 560;
  line-height: 20px;
  color: var(--rb-text);
  cursor: pointer;
  text-align: start;
  letter-spacing: -0.005em;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--rb-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.row-meta > span:not(.rb-pill) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-speed {
  font-weight: 600;
  color: var(--rb-text);
}

.progress-line {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 620px;
  margin-top: 4px;
}

.progress-percent {
  width: 38px;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-muted);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.compact .row-summary {
  min-height: 46px;
  gap: 12px;
  padding-block: 7px;
}

.compact .row-leading {
  min-width: 28px;
}

.compact .row-content {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(90px, 180px) minmax(150px, auto);
  column-gap: 16px;
  align-items: center;
  gap: 0 16px;
}

.compact .task-name {
  grid-column: 1;
  grid-row: 1;
  font-size: 13px;
}

.compact .row-meta {
  grid-column: 3;
  grid-row: 1;
  justify-content: flex-end;
}

.compact .row-remaining {
  display: none;
}

.compact .progress-line {
  grid-column: 2;
  grid-row: 1;
  margin: 0;
}

.compact.active::before {
  inset-block: 10px;
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
  gap: 10px;
  margin: 0 12px 14px 16px;
  padding: 14px 16px;
  border-radius: var(--rb-radius-tile);
  background: var(--rb-fill);
  color: var(--rb-text-muted);
  font-size: 12px;
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
  color: var(--rb-accent-text);
}

.error {
  color: var(--rb-danger);
}

.drag-handle {
  touch-action: none;
  cursor: grab;
}

.quick-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 24px;
  width: 100%;
}

.quick-metrics > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.quick-metrics dt {
  color: var(--rb-text-faint);
  font-size: 11px;
  text-transform: none;
}

.quick-metrics dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--rb-text);
}

.details-link {
  margin-top: 2px;
}

@media (max-width: 479px) {
  .row-summary {
    gap: 10px;
    padding-inline: 12px;
  }

  .row-leading {
    display: none;
  }

  .compact .row-content {
    display: block;
  }

  .compact .row-meta {
    justify-content: flex-start;
  }
}
</style>
