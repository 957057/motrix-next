<script setup lang="ts">
/** @fileoverview Native-backed task toolbar actions and confirmations. */
import { ref, computed, h, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useTaskStore } from '@/stores/task'

import { batchFinishMedia, saveSession, isEngineReady } from '@/api/aria2'
import { canFinishMedia } from '@shared/utils/media'
import { canPauseTask, canResumeTask } from '@/composables/taskCapabilities'
import { getTaskSharingState, getTaskName } from '@shared/utils/task'
import { deleteTaskFiles } from '@/composables/useFileDelete'

import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { NButton, NIcon, NCheckbox, NDropdown, NInput, NPopover, useDialog } from 'naive-ui'
import { useTaskViewStore } from '@/stores/taskView'
import { useAppMessage } from '@/composables/useAppMessage'
import { usePreferenceStore } from '@/stores/preference'
import { AddOutline, ChevronDownOutline, SearchOutline } from '@vicons/ionicons5'
import TaskViewOptions from './TaskViewOptions.vue'

const { t } = useI18n()
const appStore = useAppStore()
const taskStore = useTaskStore()
const preferenceStore = usePreferenceStore()

const view = useTaskViewStore()
const batchPending = ref(false)
const selectedTasks = computed(() => taskStore.taskList.filter((task) => view.selected.includes(task.gid)))
const availableTasks = computed(() =>
  selectedTasks.value.filter(
    (task) => !taskStore.pendingGids.includes(task.gid) && !taskStore.removingGids.includes(task.gid),
  ),
)
const pausableTasks = computed(() => availableTasks.value.filter(canPauseTask))
const resumableTasks = computed(() => availableTasks.value.filter(canResumeTask))
const sharingLabel = computed(() => {
  const kinds = new Set(
    availableTasks.value
      .map(getTaskSharingState)
      .filter(Boolean)
      .map((state) => state!.kind),
  )
  if (kinds.size !== 1) return t('task.finish-all-sharing')
  return kinds.has('bt') ? t('task.finish-seeding') : t('task.finish-sharing')
})
function removeSucceededSelection(gids: string[]) {
  const succeeded = new Set(gids)
  view.selected = view.selected.filter((gid) => !succeeded.has(gid))
  if (!view.selected.length) view.clearSelection()
}

const message = useAppMessage()
const dialog = useDialog()

async function lockDialog(d: ReturnType<typeof dialog.info>) {
  d.loading = true
  d.negativeButtonProps = { disabled: true }
  d.closable = false
  d.maskClosable = false
  await nextTick()
}

const sharingGids = computed(() =>
  availableTasks.value.filter((task) => getTaskSharingState(task) !== null).map((task) => task.gid),
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

function removeSelectedTasks() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  // Capture the user's explicit selection before dispatching native removals.
  const targetGids = availableTasks.value.map((task) => task.gid)
  if (targetGids.length === 0) return
  const gids = targetGids
  const deleteFiles = ref(false)
  const d = dialog.error({
    title: t('task.delete-task'),
    content: () =>
      h('div', {}, [
        h('p', { style: 'margin: 0 0 12px;' }, t('task.batch-delete-task-confirm', { count: gids.length })),
        h(
          'ul',
          { class: 'removal-task-list' },
          taskStore.taskList
            .filter((task) => gids.includes(task.gid))
            .map((task) => h('li', { key: task.gid }, getTaskName(task))),
        ),
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
    positiveText: t('task.delete-task'),
    negativeText: t('app.cancel'),
    onPositiveClick: async () => {
      await lockDialog(d)
      batchPending.value = true
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
        removeSucceededSelection(result.succeeded)
        const deletedTasks = tasksToDelete.filter((task) => succeeded.has(task.gid))

        let fileDeletionFailed = false
        for (const task of deletedTasks) {
          try {
            await deleteTaskFiles(task, preferenceStore.config.fileDeletionMode)
          } catch (error) {
            fileDeletionFailed = true
            logger.warn('TaskActions.removeSelectedTasksFiles', getErrorMessage(error))
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
        logger.warn('TaskActions.removeSelectedTasks', getErrorMessage(error))
        message.error(t('task.batch-delete-task-fail'))
      } finally {
        batchPending.value = false
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
    positiveText: t('task.resume-all-task'),
    negativeText: t('app.cancel'),
    onPositiveClick: async () => {
      await lockDialog(d)
      batchPending.value = true
      try {
        const result = await taskStore.resumeAllTask()
        if (result.resumed > 0) message.success(t('task.resume-all-task-success'))
      } catch (error) {
        logger.warn('TaskActions.resumeAll', getErrorMessage(error))
        message.error(t('task.resume-all-task-fail'))
      } finally {
        batchPending.value = false
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
    positiveText: t('task.pause-all-task'),
    negativeText: t('app.cancel'),
    onPositiveClick: async () => {
      await lockDialog(d)
      batchPending.value = true
      try {
        await taskStore.pauseAllTask()
        message.success(t('task.pause-all-task-success'))
      } catch (error) {
        logger.warn('TaskActions.pauseAll', getErrorMessage(error))
        message.error(t('task.pause-all-task-fail'))
      } finally {
        batchPending.value = false
        d.destroy()
      }
      return false
    },
  })
}

function finishSelectedSharing() {
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  const gids = [...sharingGids.value]
  if (gids.length === 0) return
  const d = dialog.warning({
    title: sharingLabel.value,
    content: t('task.finish-all-sharing-confirm', { count: gids.length }),
    positiveText: sharingLabel.value,
    negativeText: t('app.cancel'),
    onPositiveClick: async () => {
      await lockDialog(d)
      batchPending.value = true
      try {
        const result = await taskStore.finishSharingTasks(gids)
        removeSucceededSelection(result.succeeded)
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
        logger.warn('TaskActions.finishSelectedSharing', getErrorMessage(error))
        message.error(t('task.finish-all-sharing-fail'))
      } finally {
        batchPending.value = false
        d.destroy()
      }
      return false
    },
  })
}

const recordingGids = computed(() => availableTasks.value.filter(canFinishMedia).map((task) => task.gid))
const finishingMedia = ref(false)
async function finishRecordings() {
  if (finishingMedia.value || batchPending.value) return
  finishingMedia.value = true
  batchPending.value = true
  try {
    const result = await batchFinishMedia([...recordingGids.value])
    removeSucceededSelection(result.succeeded)
    if (result.failed.length) message.error(result.failed.map((item) => item.message).join('; '))
    if (result.succeeded.length) message.info(t('media.finalizing'))
    await saveSession()
    await taskStore.fetchList()
  } catch (error) {
    logger.warn('TaskActions.finishMedia', getErrorMessage(error))
    message.error(getErrorMessage(error))
  } finally {
    finishingMedia.value = false
    batchPending.value = false
  }
}

const queueOptions = computed(() => [
  { key: 'resume', label: t('task.resume-all-task'), disabled: batchPending.value || !taskStore.taskCounts.progress },
  { key: 'pause', label: t('task.pause-all-task'), disabled: batchPending.value || !taskStore.taskCounts.progress },
])
function handleQueue(key: string) {
  if (batchPending.value || taskStore.currentList !== 'progress') return
  if (key === 'resume') resumeAll()
  else if (key === 'pause') pauseAll()
}
const overflowOptions = computed(() => [
  ...(resumableTasks.value.length
    ? [
        {
          key: 'resume',
          label: `${t('task.resume-task')} (${resumableTasks.value.length})`,
          disabled: batchPending.value,
        },
      ]
    : []),
  ...(pausableTasks.value.length
    ? [{ key: 'pause', label: `${t('task.pause-task')} (${pausableTasks.value.length})`, disabled: batchPending.value }]
    : []),
  ...(availableTasks.value.length
    ? [{ key: 'remove', label: t('task.delete-task'), disabled: batchPending.value }]
    : []),
  ...(recordingGids.value.length ? [{ key: 'record', label: t('media.finish'), disabled: batchPending.value }] : []),
])
function handleOverflow(key: string) {
  if (key === 'resume' || key === 'pause') void runSelected(key)
  else if (key === 'record') void finishRecordings()
  else if (key === 'remove') removeSelectedTasks()
}
async function runSelected(action: 'pause' | 'resume') {
  if (batchPending.value) return
  if (!isEngineReady()) {
    message.warning(t('app.engine-not-ready'))
    return
  }
  const targets = [...(action === 'pause' ? pausableTasks.value : resumableTasks.value)]
  if (!targets.length) return
  batchPending.value = true
  try {
    const results = await Promise.allSettled(
      targets.map(async (task) => {
        if (action === 'resume') return taskStore.resumeTask(task)
        await taskStore.pauseTask(task)
        return true
      }),
    )
    const succeeded = targets
      .filter((_, index) => {
        const result = results[index]
        return result.status === 'fulfilled' && result.value !== false
      })
      .map((task) => task.gid)
    removeSucceededSelection(succeeded)
    if (succeeded.length !== targets.length) message.error(t('workspace.partial-failure'))
  } finally {
    batchPending.value = false
  }
}
</script>

<template>
  <div class="task-actions">
    <Transition
      name="toolbar"
      @before-leave="(element) => element.setAttribute('inert', '')"
      @before-enter="(element) => element.removeAttribute('inert')"
      @leave-cancelled="(element) => element.removeAttribute('inert')"
    >
      <div v-if="view.selecting" key="selection" class="toolbar-content selection-actions">
        <NCheckbox
          :checked="taskStore.taskList.length > 0 && view.selected.length === taskStore.taskList.length"
          :indeterminate="view.selected.length > 0 && view.selected.length < taskStore.taskList.length"
          :disabled="batchPending"
          :aria-label="t('workspace.select-page')"
          @update:checked="view.selected = $event ? taskStore.taskList.map((task) => task.gid) : []"
        >
          <span class="select-page-label">{{ t('workspace.select-page') }}</span>
        </NCheckbox>

        <NButton
          v-if="resumableTasks.length"
          class="selection-secondary"
          quaternary
          :disabled="batchPending"
          :aria-label="t('task.resume-task')"
          @click="runSelected('resume')"
        >
          {{ t('task.resume-task')
          }}<span v-if="resumableTasks.length" class="action-count">{{ resumableTasks.length }}</span>
        </NButton>
        <NButton
          v-if="pausableTasks.length"
          class="selection-secondary"
          quaternary
          :disabled="batchPending"
          :aria-label="t('task.pause-task')"
          @click="runSelected('pause')"
        >
          {{ t('task.pause-task')
          }}<span v-if="pausableTasks.length" class="action-count">{{ pausableTasks.length }}</span>
        </NButton>
        <NButton
          v-if="sharingGids.length"
          class="selection-primary"
          :title="sharingLabel"
          quaternary
          :disabled="batchPending"
          :aria-label="sharingLabel"
          @click="finishSelectedSharing"
        >
          <span class="action-label">{{ sharingLabel }}</span
          ><span class="action-count">{{ sharingGids.length }}</span>
        </NButton>
        <NButton
          v-if="recordingGids.length"
          class="selection-secondary"
          quaternary
          :disabled="batchPending"
          :loading="finishingMedia"
          @click="finishRecordings"
          >{{ t('media.finish') }}</NButton
        >
        <NButton
          v-if="availableTasks.length"
          class="selection-secondary"
          quaternary
          :disabled="batchPending"
          :aria-label="t('task.delete-task')"
          @click="removeSelectedTasks"
          >{{ t('task.delete-task') }}</NButton
        >
        <NDropdown v-if="overflowOptions.length" trigger="click" :options="overflowOptions" @select="handleOverflow">
          <NButton
            class="selection-overflow"
            quaternary
            :disabled="batchPending"
            :aria-label="t('workspace.more-actions')"
            >{{ t('workspace.more-actions') }}<NIcon :size="14"><ChevronDownOutline /></NIcon
          ></NButton>
        </NDropdown>
        <NButton quaternary :disabled="batchPending" :aria-label="t('workspace.done')" @click="view.clearSelection()">{{
          t('workspace.done')
        }}</NButton>
      </div>
      <div v-else key="default" class="toolbar-content">
        <NInput
          v-model:value="view.query"
          class="toolbar-search"
          clearable
          :placeholder="t('workspace.search-tasks')"
          :input-props="{ 'aria-label': t('workspace.search-tasks') }"
        >
          <template #prefix
            ><NIcon><SearchOutline /></NIcon
          ></template>
        </NInput>
        <NPopover trigger="click" placement="bottom-end" :show-arrow="false">
          <template #trigger
            ><NButton class="search-popover-trigger" quaternary :aria-label="t('workspace.search-tasks')"
              ><template #icon
                ><NIcon><SearchOutline /></NIcon></template></NButton
          ></template>
          <NInput
            v-model:value="view.query"
            clearable
            autofocus
            :placeholder="t('workspace.search-tasks')"
            :input-props="{ 'aria-label': t('workspace.search-tasks') }"
            style="width: min(260px, calc(100vw - 64px))"
          />
        </NPopover>
        <NDropdown
          v-if="taskStore.currentList === 'progress'"
          trigger="click"
          :options="queueOptions"
          @select="handleQueue"
        >
          <NButton quaternary :aria-label="t('workspace.queue')"
            >{{ t('workspace.queue') }}<NIcon :size="14" class="toolbar-chevron"><ChevronDownOutline /></NIcon
          ></NButton>
        </NDropdown>
        <TaskViewOptions />
        <NButton quaternary :aria-label="t('workspace.select-tasks')" @click="view.selecting = true">{{
          t('workspace.select-tasks')
        }}</NButton>
        <NButton type="primary" :aria-label="t('task.new-task')" @click="showAddTask"
          ><template #icon
            ><NIcon><AddOutline /></NIcon></template
          >{{ t('task.new-task') }}</NButton
        >
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.task-actions {
  display: grid;
  min-width: 0;
  width: 100%;
  container-type: inline-size;
}
.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  grid-area: 1 / 1;
  min-height: 36px;
  min-width: 0;
  white-space: nowrap;
}
.toolbar-content > .n-button {
  flex-shrink: 0;
}
.toolbar-search {
  flex: 1;
  min-width: 80px;
  max-width: 200px;
}
.search-popover-trigger.n-button,
.selection-overflow.n-button {
  display: none;
}
.selection-primary.n-button {
  flex-shrink: 1;
  min-width: 0;
}
.selection-primary :deep(.n-button__content) {
  min-width: 0;
}
.action-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toolbar-chevron {
  margin-inline-start: 6px;
}
.action-count {
  margin-inline-start: 6px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.toolbar-enter-active,
.toolbar-leave-active {
  transition: opacity 160ms ease;
}
.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
}
.toolbar-leave-active {
  pointer-events: none;
}
@container (max-width: 620px) {
  .selection-secondary.n-button {
    display: none;
  }
  .selection-overflow.n-button {
    display: inline-flex;
  }
}
@container (max-width: 560px) {
  .toolbar-search,
  .select-page-label {
    display: none;
  }
  .search-popover-trigger.n-button {
    display: inline-flex;
  }
}
@container (max-width: 360px) {
  .toolbar-content {
    gap: 2px;
  }
  .toolbar-content > .n-button {
    padding-inline: 6px;
  }
}
</style>
