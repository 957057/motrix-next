<script setup lang="ts">
/** @fileoverview Native-backed task toolbar actions and confirmations. */
import { ref, computed, h, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useTaskStore } from '@/stores/task'

import { batchFinishMedia, saveSession, isEngineReady } from '@/api/aria2'
import type { I18nKey } from '@shared/i18nTypes'
import { canFinishMedia } from '@shared/utils/media'
import { getTaskSharingState } from '@shared/utils/task'
import { deleteTaskFiles } from '@/composables/useFileDelete'

import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { NButton, NIcon, NCheckbox, NDropdown, useDialog } from 'naive-ui'
import { useTaskViewStore } from '@/stores/taskView'
import { useAppMessage } from '@/composables/useAppMessage'
import { usePreferenceStore } from '@/stores/preference'
import {
  PROGRESS_SORT_FIELDS,
  TERMINAL_SORT_FIELDS,
  ALL_SORT_FIELDS,
  DEFAULT_TASK_SORT,
  type ProgressSortField,
  type TerminalSortField,
  type AllSortField,
} from '@/composables/useTaskSort'
import {
  AddOutline,
  EllipsisHorizontalOutline,
  PlayOutline,
  PauseOutline,
  TrashOutline,
  CloseOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const { t } = useI18n()
const appStore = useAppStore()
const taskStore = useTaskStore()
const preferenceStore = usePreferenceStore()

// ── Sort dropdown ─────────────────────────────────────────────────
const currentTab = computed(() => taskStore.currentList)

/** Map sort field key to its i18n label. */
const SORT_LABELS: Record<ProgressSortField | TerminalSortField | AllSortField, I18nKey> = {
  manual: 'task.sort-manual',
  'added-at': 'task.sort-added-at',
  'completed-at': 'task.sort-completed-at',
  name: 'task.sort-name',
  size: 'task.sort-size',
  progress: 'task.sort-progress',
  speed: 'task.sort-speed',
}

/** Active sort config for the current tab. */
const currentSort = computed(() => {
  const cfg = preferenceStore.config?.taskSort ?? DEFAULT_TASK_SORT
  switch (currentTab.value) {
    case 'failed':
    case 'completed':
      return cfg[currentTab.value]
    case 'all':
      return cfg.all
    default:
      return cfg.progress
  }
})

/** Sort field list for the current tab. */
const currentSortFields = computed(() => {
  switch (currentTab.value) {
    case 'failed':
    case 'completed':
      return TERMINAL_SORT_FIELDS
    case 'all':
      return ALL_SORT_FIELDS
    default:
      return PROGRESS_SORT_FIELDS
  }
})

const view = useTaskViewStore()

async function onSortSelect(key: ProgressSortField | TerminalSortField | AllSortField) {
  await taskStore.changeCurrentSort(key)
}
const message = useAppMessage()
const dialog = useDialog()

const refreshing = ref(false)

async function lockDialog(d: ReturnType<typeof dialog.info>) {
  d.loading = true
  d.negativeButtonProps = { disabled: true }
  d.closable = false
  d.maskClosable = false
  await nextTick()
}

const sharingGids = computed(() =>
  taskStore.taskList
    .filter((task) => view.selected.includes(task.gid))
    .filter((task) => getTaskSharingState(task) !== null)
    .map((task) => task.gid),
)

const deleteFilesLabel = computed(() =>
  t(
    preferenceStore.config.fileDeletionMode === 'permanent'
      ? 'task.delete-local-files-permanent-label'
      : 'task.delete-local-files-trash-label',
  ),
)

function showAddTask() {
  appStore.showAddTaskDialog()
}

async function onRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await taskStore.fetchList()
    if (taskStore.queryError) message.error(taskStore.queryError)
    else message.success(t('task.refresh-list-success'))
  } catch (error) {
    logger.warn('TaskActions.onRefresh', getErrorMessage(error))
  } finally {
    refreshing.value = false
  }
}

function onDeleteAll() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  // In 'all' view, clear only live aria2 tasks, not DB-only history items.
  const targetGids = [...view.selected]
  if (targetGids.length === 0) return
  const gids = targetGids
  const deleteFiles = ref(false)
  const d = dialog.error({
    title: t('task.delete-task-queue'),
    content: () =>
      h('div', {}, [
        h('p', { style: 'margin: 0 0 12px;' }, t('task.batch-delete-task-confirm', { count: gids.length })),
        h(
          NCheckbox,
          {
            checked: deleteFiles.value,
            'onUpdate:checked': (v: boolean) => {
              deleteFiles.value = v
            },
          },
          { default: () => deleteFilesLabel.value },
        ),
      ]),
    positiveText: t('app.yes'),
    negativeText: t('app.no'),
    onPositiveClick: async () => {
      await lockDialog(d)
      // Capture task references BEFORE removal — the store list mutates after
      // batchRemoveTask, so we'd lose the dir/path info needed for file deletion.
      const targetTasks = taskStore.taskList.filter((t) => gids.includes(t.gid))
      const tasksToDelete = deleteFiles.value ? targetTasks : []
      // Remove task records FIRST, then delete files.
      // This matches the safer order used in single-task delete (TaskView.vue).
      // If file deletion fails, tasks are already cleaned up from aria2;
      // the reverse order would leave orphaned tasks with missing files.
      try {
        const result = await taskStore.batchRemoveTask(gids)
        const succeeded = new Set(result.succeeded)
        view.selected = view.selected.filter((gid) => !succeeded.has(gid))
        const deletedTasks = tasksToDelete.filter((task) => succeeded.has(task.gid))

        let fileDeletionFailed = false
        for (const task of deletedTasks) {
          try {
            await deleteTaskFiles(task, preferenceStore.config.fileDeletionMode)
          } catch (error) {
            fileDeletionFailed = true
            logger.warn('TaskActions.onDeleteAllFiles', getErrorMessage(error))
          }
        }

        if (result.failed.length > 0) {
          const key = result.succeeded.length > 0 ? 'task.batch-delete-task-partial' : 'task.batch-delete-task-fail'
          message[result.succeeded.length > 0 ? 'warning' : 'error'](
            t(key, { removed: result.succeeded.length, failed: result.failed.length }),
          )
        } else if (!fileDeletionFailed) {
          message.success(t('task.batch-delete-task-success'))
        }
        if (fileDeletionFailed) message.error(t('task.remove-task-file-fail'))
      } catch (error) {
        logger.warn('TaskActions.onDeleteAll', getErrorMessage(error))
        message.error(t('task.batch-delete-task-fail'))
      } finally {
        d.destroy()
      }
      return false
    },
  })
}

function resumeAll() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  const d = dialog.info({
    title: t('task.resume-all-task'),
    content: t('task.resume-all-task-confirm') || 'Resume all tasks?',
    positiveText: t('app.yes'),
    negativeText: t('app.no'),
    onPositiveClick: async () => {
      await lockDialog(d)
      try {
        const result = await taskStore.resumeAllTask()
        if (result.resumed > 0) message.success(t('task.resume-all-task-success'))
      } catch (error) {
        logger.warn('TaskActions.resumeAll', getErrorMessage(error))
        message.error(t('task.resume-all-task-fail'))
      } finally {
        d.destroy()
      }
      return false
    },
  })
}

function pauseAll() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  const d = dialog.info({
    title: t('task.pause-all-task'),
    content: t('task.pause-all-task-confirm') || 'Pause all tasks?',
    positiveText: t('app.yes'),
    negativeText: t('app.no'),
    onPositiveClick: async () => {
      await lockDialog(d)
      try {
        await taskStore.pauseAllTask()
        message.success(t('task.pause-all-task-success'))
      } catch (error) {
        logger.warn('TaskActions.pauseAll', getErrorMessage(error))
        message.error(t('task.pause-all-task-fail'))
      } finally {
        d.destroy()
      }
      return false
    },
  })
}

function finishAllSharing() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  const gids = [...sharingGids.value]
  if (gids.length === 0) return
  const d = dialog.warning({
    title: t('task.finish-all-sharing'),
    content: t('task.finish-all-sharing-confirm', { count: gids.length }),
    positiveText: t('app.yes'),
    negativeText: t('app.no'),
    onPositiveClick: async () => {
      await lockDialog(d)
      try {
        const result = await taskStore.finishSharingTasks(gids)
        if (result.failed.length === 0) {
          message.success(t('task.finish-all-sharing-success', { count: result.succeeded.length }))
        } else if (result.succeeded.length > 0) {
          message.warning(
            t('task.finish-all-sharing-partial', {
              finished: result.succeeded.length,
              failed: result.failed.length,
            }),
          )
        } else {
          message.error(t('task.finish-all-sharing-fail'))
        }
      } catch (error) {
        logger.warn('TaskActions.finishAllSharing', getErrorMessage(error))
        message.error(t('task.finish-all-sharing-fail'))
      } finally {
        d.destroy()
      }
      return false
    },
  })
}

const recordingGids = computed(() =>
  taskStore.taskList
    .filter((task) => view.selected.includes(task.gid))
    .filter(canFinishMedia)
    .map((task) => task.gid),
)
const finishingMedia = ref(false)
async function finishRecordings() {
  if (finishingMedia.value) return
  finishingMedia.value = true
  try {
    const result = await batchFinishMedia(recordingGids.value)
    if (result.failed.length) message.error(result.failed.map((item) => item.message).join('; '))
    if (result.succeeded.length) message.info(t('media.finalizing'))
    await saveSession()
    await taskStore.fetchList()
  } catch (error) {
    logger.warn('TaskActions.finishMedia', getErrorMessage(error))
    message.error(getErrorMessage(error))
  } finally {
    finishingMedia.value = false
  }
}

const sortOptions = computed(() =>
  currentSortFields.value.map((field) => ({
    key: field,
    label: `${t(SORT_LABELS[field])}${currentSort.value.field === field ? (currentSort.value.direction === 'asc' ? ' ↑' : ' ↓') : ''}`,
  })),
)
const batchOptions = computed(() => [
  { key: 'finish-sharing', label: t('task.finish-all-sharing'), disabled: !sharingGids.value.length },
  { key: 'finish-media', label: t('media.finish'), disabled: !recordingGids.value.length || finishingMedia.value },
])
const moreOptions = computed(() => [
  { key: 'select', label: t('workspace.select-tasks') },
  {
    key: 'density',
    label: preferenceStore.config.taskCardMode === 'compact' ? t('workspace.comfortable') : t('workspace.compact'),
  },
  { key: 'refresh', label: t('task.refresh-list'), disabled: refreshing.value },
  { key: 'resume', label: t('task.resume-all-task'), disabled: !taskStore.taskCounts.progress },
  { key: 'pause', label: t('task.pause-all-task'), disabled: !taskStore.taskCounts.progress },
])
function handleMore(key: string) {
  switch (key) {
    case 'select':
      view.selecting = true
      break
    case 'density':
      void preferenceStore.updateAndSave({
        taskCardMode: preferenceStore.config.taskCardMode === 'compact' ? 'full' : 'compact',
      })
      break
    case 'refresh':
      void onRefresh()
      break
    case 'resume':
      resumeAll()
      break
    case 'pause':
      pauseAll()
      break
    case 'finish-sharing':
      finishAllSharing()
      break
    case 'finish-media':
      void finishRecordings()
      break
  }
}
const batchPending = ref(false)
async function runSelected(action: 'pause' | 'resume') {
  if (batchPending.value) return
  batchPending.value = true
  const gids = [...view.selected]
  try {
    const results = await Promise.allSettled(
      taskStore.taskList
        .filter((task) => gids.includes(task.gid))
        .map((task) => (action === 'pause' ? taskStore.pauseTask(task) : taskStore.resumeTask(task))),
    )
    if (results.some((result) => result.status === 'rejected')) message.error(t('workspace.partial-failure'))
    else view.clearSelection()
  } finally {
    batchPending.value = false
  }
}
</script>

<template>
  <div class="task-actions">
    <template v-if="view.selecting">
      <NCheckbox
        :checked="taskStore.taskList.length > 0 && view.selected.length === taskStore.taskList.length"
        :indeterminate="view.selected.length > 0 && view.selected.length < taskStore.taskList.length"
        :aria-label="t('app.menu-select-all')"
        @update:checked="view.selected = $event ? taskStore.taskList.map((task) => task.gid) : []"
      />
      <span class="selected-count">{{ view.selected.length }}</span>
      <NButton
        quaternary
        :disabled="!view.selected.length || batchPending"
        :aria-label="t('task.resume-task')"
        @click="runSelected('resume')"
        ><template #icon
          ><NIcon><PlayOutline /></NIcon></template
      ></NButton>
      <NButton
        quaternary
        :disabled="!view.selected.length || batchPending"
        :aria-label="t('task.pause-task')"
        @click="runSelected('pause')"
        ><template #icon
          ><NIcon><PauseOutline /></NIcon></template
      ></NButton>
      <NButton
        quaternary
        :disabled="!view.selected.length || batchPending"
        :aria-label="t('task.delete-task')"
        @click="onDeleteAll"
        ><template #icon
          ><NIcon><TrashOutline /></NIcon></template
      ></NButton>
      <NDropdown trigger="click" :options="batchOptions" @select="handleMore"
        ><NButton quaternary :aria-label="t('workspace.more-actions')"
          ><template #icon
            ><NIcon><EllipsisHorizontalOutline /></NIcon></template></NButton
      ></NDropdown>
      <NButton quaternary :aria-label="t('app.cancel')" @click="view.clearSelection()"
        ><template #icon
          ><NIcon><CloseOutline /></NIcon></template
      ></NButton>
    </template>
    <template v-else>
      <NDropdown trigger="click" :options="sortOptions" @select="onSortSelect"
        ><NButton quaternary :aria-label="t('task.sort-by')"
          ><template #icon
            ><NIcon><SwapVerticalOutline /></NIcon></template></NButton
      ></NDropdown>
      <NDropdown trigger="click" :options="moreOptions" @select="handleMore"
        ><NButton quaternary :aria-label="t('workspace.more-actions')"
          ><template #icon
            ><NIcon><EllipsisHorizontalOutline /></NIcon></template></NButton
      ></NDropdown>
      <NButton type="primary" :aria-label="t('task.new-task')" @click="showAddTask"
        ><template #icon
          ><NIcon><AddOutline /></NIcon></template
        ><span class="new-label">{{ t('task.new-task') }}</span></NButton
      >
    </template>
  </div>
</template>
<style scoped>
.task-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.selected-count {
  color: var(--m3-primary);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 479px) {
  .new-label {
    display: none;
  }
}
</style>
