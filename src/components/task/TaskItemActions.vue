<script setup lang="ts">
/** @fileoverview Action buttons for individual task items. */
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { canFinishMedia } from '@shared/utils/media'
import { TASK_STATUS } from '@shared/constants'
import { NIcon, NDropdown } from 'naive-ui'
import {
  Ellipsis,
  Pause,
  Play,
  CircleStop,
  RefreshCw,
  X,
  Trash2,
  Link,
  Info,
  FolderOpen,
  ExternalLink,
  List,
} from '@lucide/vue'
import { type Component } from 'vue'
import type { Aria2Task } from '@shared/types'
import { canPauseTask, canResumeTask } from '@/composables/taskCapabilities'
import { getBtLifecycleState } from '@/composables/useBtLifecycle'
import { getSharingActionLabelKey, getTaskSharingState } from '@shared/utils/task'

const props = withDefaults(
  defineProps<{
    task: Aria2Task
    fileMissing?: boolean
    pending?: boolean
    density?: 'full' | 'compact'
    inDetail?: boolean
  }>(),
  { density: 'full' },
)
const emit = defineEmits<{
  pause: []
  resume: []
  retry: []
  redownload: []
  'finish-sharing': []
  'finish-media': []
  delete: []
  'delete-record': []
  'copy-link': []
  'show-info': []
  folder: []
  'open-file': []
  'select-files': []
}>()

const { t } = useI18n()

interface ActionDef {
  key: string
  icon: Component
  label: string
  event: string
  emphasis?: boolean
  disabled?: boolean
}

const actions = computed(() => {
  const lifecycle = getBtLifecycleState(props.task)
  const sharing = getTaskSharingState(props.task)
  let primary: ActionDef[]
  if (props.task.media?.state === 'awaiting-selection') {
    primary = [
      { key: 'select-content', icon: List, label: t('media.select-tracks'), event: 'resume', emphasis: true },
      { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
    ]
  } else if (lifecycle === 'selection') {
    primary = [
      {
        key: 'select-files',
        icon: List,
        label: t('task.select-files'),
        event: 'select-files',
        emphasis: true,
      },
      { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
    ]
  } else if (lifecycle === 'recovering') {
    primary = [{ key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' }]
  } else if (lifecycle === 'error') {
    primary = [
      ...(props.task.status === TASK_STATUS.ERROR
        ? [{ key: 'retry', icon: RefreshCw, label: t('task.retry-task'), event: 'retry' }]
        : []),
      { key: 'info', icon: Info, label: t('task.task-detail-title'), event: 'show-info' },
      { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
    ]
  } else if (sharing?.phase === 'active') {
    primary = [
      { key: 'toggle', icon: Pause, label: t(getSharingActionLabelKey(sharing.kind, 'pause')), event: 'pause' },
      {
        key: 'finish-sharing',
        icon: CircleStop,
        label: t(getSharingActionLabelKey(sharing.kind, 'finish')),
        event: 'finish-sharing',
      },
      { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
    ]
  } else if (sharing?.phase === 'paused') {
    primary = [
      { key: 'toggle', icon: Play, label: t(getSharingActionLabelKey(sharing.kind, 'resume')), event: 'resume' },
      {
        key: 'finish-sharing',
        icon: CircleStop,
        label: t(getSharingActionLabelKey(sharing.kind, 'finish')),
        event: 'finish-sharing',
      },
      { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
    ]
  } else {
    const actionsMap: Record<string, ActionDef[]> = {
      [TASK_STATUS.ACTIVE]: [
        { key: 'toggle', icon: Pause, label: t('task.pause-task'), event: 'pause' },
        { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
      ],
      [TASK_STATUS.PAUSED]: [
        { key: 'toggle', icon: Play, label: t('task.resume-task'), event: 'resume' },
        { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
      ],
      [TASK_STATUS.WAITING]: [
        { key: 'toggle', icon: Pause, label: t('task.pause-task'), event: 'pause' },
        { key: 'delete', icon: X, label: t('task.delete-task'), event: 'delete' },
      ],
      [TASK_STATUS.ERROR]: [
        { key: 'retry', icon: RefreshCw, label: t('task.retry-task'), event: 'retry' },
        { key: 'trash', icon: Trash2, label: t('task.remove-record'), event: 'delete-record' },
      ],
      [TASK_STATUS.COMPLETE]: [
        { key: 'open', icon: ExternalLink, label: t('task.open-file'), event: 'open-file' },
        { key: 'folder', icon: FolderOpen, label: t('task.show-in-folder'), event: 'folder' },
        { key: 'redownload', icon: RefreshCw, label: t('task.restart-task'), event: 'redownload' },
        { key: 'trash', icon: Trash2, label: t('task.remove-record'), event: 'delete-record' },
      ],
      [TASK_STATUS.REMOVED]: [
        { key: 'open', icon: ExternalLink, label: t('task.open-file'), event: 'open-file' },
        { key: 'folder', icon: FolderOpen, label: t('task.show-in-folder'), event: 'folder' },
        { key: 'redownload', icon: RefreshCw, label: t('task.restart-task'), event: 'redownload' },
        { key: 'trash', icon: Trash2, label: t('task.remove-record'), event: 'delete-record' },
      ],
    }
    primary = actionsMap[props.task.status] || []
  }
  if (canFinishMedia(props.task))
    primary.unshift({ key: 'finish-media', icon: CircleStop, label: t('media.finish'), event: 'finish-media' })
  const primaryKeys = new Set(primary.map((a) => a.key))

  // Destructive actions (trash, delete) always go to the far right
  const destructiveKeys = new Set(['trash', 'delete'])
  const leading = primary.filter(
    (a) => !destructiveKeys.has(a.key) && !(a.key === 'open' && props.task.media && props.task.status !== 'complete'),
  )
  const trailing = primary.filter((a) => destructiveKeys.has(a.key))

  const common: ActionDef[] = [
    { key: 'folder', icon: FolderOpen, label: t('task.show-in-folder'), event: 'folder' },
    { key: 'link', icon: Link, label: t('task.copy-link'), event: 'copy-link' },
    { key: 'info', icon: Info, label: t('task.task-detail-title'), event: 'show-info' },
  ].filter((a) => !primaryKeys.has(a.key) && !(props.inDetail && a.key === 'info'))

  return [...leading, ...common, ...trailing].map((action) => ({
    ...action,
    disabled:
      props.pending ||
      (action.key === 'open' && props.fileMissing) ||
      (action.event === 'pause' && !canPauseTask(props.task)) ||
      (action.event === 'resume' && action.key === 'toggle' && !canResumeTask(props.task)),
  }))
})

const primary = computed(() => actions.value.find((action) => !['delete', 'trash'].includes(action.key)))
const inlineActions = computed(() =>
  actions.value.filter((action) => action === primary.value || action.key === 'finish-sharing'),
)
const menuOptions = computed(() =>
  actions.value
    .filter((action) => !inlineActions.value.includes(action))
    .map((action) => ({
      key: action.event,
      label: action.label,
      disabled: action.disabled,
      icon: () => h(NIcon, null, { default: () => h(action.icon) }),
    })),
)
function onAction(event: string) {
  if (props.pending) return
  switch (event) {
    case 'pause':
      emit('pause')
      break
    case 'resume':
      emit('resume')
      break
    case 'retry':
      emit('retry')
      break
    case 'redownload':
      emit('redownload')
      break
    case 'finish-media':
      emit('finish-media')
      break
    case 'finish-sharing':
      emit('finish-sharing')
      break
    case 'delete':
      emit('delete')
      break
    case 'delete-record':
      emit('delete-record')
      break
    case 'copy-link':
      emit('copy-link')
      break
    case 'show-info':
      emit('show-info')
      break
    case 'folder':
      emit('folder')
      break
    case 'open-file':
      emit('open-file')
      break
    case 'select-files':
      emit('select-files')
      break
  }
}
</script>

<template>
  <div class="row-actions" @click.stop @dblclick.stop>
    <button
      v-for="action in inlineActions"
      :key="action.key"
      type="button"
      class="primary-action"
      :class="{ emphasized: action.emphasis }"
      :aria-label="action.label"
      :title="action.label"
      :disabled="action.disabled"
      @click="onAction(action.event)"
    >
      <span class="action-icon"
        ><Transition name="fade"
          ><NIcon :key="action.event" :size="17"><component :is="action.icon" /></NIcon></Transition></span
      ><span v-if="action.emphasis || action.key === 'open' || action.key === 'finish-sharing'" class="action-text">{{
        action.label
      }}</span>
    </button>
    <NDropdown trigger="click" :options="menuOptions" placement="bottom-end" @select="onAction">
      <button type="button" class="icon-button" :aria-label="t('workspace.more-actions')" :disabled="pending">
        <NIcon :size="18"><Ellipsis /></NIcon>
      </button>
    </NDropdown>
  </div>
</template>
<style scoped>
.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.action-icon {
  display: inline-grid;
  width: 17px;
  height: 17px;
}

.action-icon > .n-icon {
  grid-area: 1 / 1;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 32px;
  min-height: 32px;
  padding: 0 8px;
  border-radius: var(--rb-radius-control);
  color: var(--rb-text-muted);
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--rb-motion-feedback) var(--rb-ease),
    color var(--rb-motion-feedback) var(--rb-ease),
    transform var(--rb-motion-feedback) var(--rb-ease);
}

.primary-action:hover {
  background: var(--rb-hover);
  color: var(--rb-text);
}

.primary-action:active {
  transform: scale(0.96);
}

.primary-action.emphasized {
  color: var(--rb-accent-text);
  background: var(--rb-accent-soft);
  padding-inline: 12px;
}

.primary-action.emphasized:hover {
  filter: brightness(0.98);
}

.primary-action:disabled {
  opacity: 0.4;
  cursor: default;
  transform: none;
}

@media (max-width: 479px) {
  .primary-action {
    padding-inline: 4px;
  }

  .action-text {
    display: none;
  }
}
</style>
