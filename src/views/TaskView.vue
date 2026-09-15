<script setup lang="ts">
/** @fileoverview Task list view with native updates, task actions, and file delete confirmation. */
import { motion } from 'motion-v'
import { watchDebounced, useDocumentVisibility } from '@vueuse/core'
import { computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/stores/task'
import { useTaskSelectionStore } from '@/stores/taskSelection'
import { usePreferenceStore } from '@/stores/preference'
import { useTaskActions } from '@/composables/useTaskActions'
import { useTaskViewStore } from '@/stores/taskView'
import { useDialog } from 'naive-ui'
import { useAppMessage } from '@/composables/useAppMessage'
import TransitionText from '@/components/common/TransitionText.vue'
import TaskList from '@/components/task/TaskList.vue'
import TaskActions from '@/components/task/TaskActions.vue'
import TaskDetail from '@/components/task/TaskDetail.vue'

const props = withDefaults(defineProps<{ status?: string }>(), { status: 'all' })

const view = useTaskViewStore()
const visibility = useDocumentVisibility()
let returnFocus: HTMLElement | null = null
const { t } = useI18n()
const taskStore = useTaskStore()
const preferenceStore = usePreferenceStore()
const dialog = useDialog()
const message = useAppMessage()

const {
  handlePauseTask,
  handleResumeTask,
  handleRetryTask,
  handleRedownloadTask,
  handleFinishSharing,
  handleFinishMedia,
  handleDeleteTask,
  handleDeleteRecord,
  handleCopyLink,
  handleShowInfo,
  handleShowInFolder,
  handleOpenFile,
  handleSelectFiles,
} = useTaskActions({
  taskStore,
  preferenceConfig: () => preferenceStore.config,
  t,
  dialog,
  message,
  requestMagnetSelection: (gid) => useTaskSelectionStore().request({ kind: 'bt', gid }),
})

const subnavs = computed(() => [
  { key: 'all', title: t('task.scope-all') },
  { key: 'progress', title: t('task.scope-progress') },
  { key: 'failed', title: t('workspace.needs-action') },
  { key: 'completed', title: t('task.scope-completed') },
])

const title = computed(() => {
  const sub = subnavs.value.find((s) => s.key === taskStore.displayedList)
  return sub?.title ?? props.status
})
watchDebounced(
  () => view.query,
  () => {
    if (!isUnmounted) taskStore.setCurrentTaskPage(1)
  },
  { debounce: 180, maxWait: 400 },
)

let isUnmounted = false
async function changeCurrentList() {
  await taskStore.changeCurrentList(props.status)
}

watch(
  () => props.status,
  () => {
    void changeCurrentList()
  },
)
watch(visibility, (state) => {
  if (state === 'visible' && !isUnmounted) void changeCurrentList()
})
watch(
  () => taskStore.taskDetailVisible,
  async (visible) => {
    if (!visible) return
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    document.getElementById('task-detail-back')?.focus()
  },
)
function finishDetailClose() {
  taskStore.taskDetailClosing = false
  if (taskStore.taskDetailVisible) return
  if (returnFocus?.isConnected) returnFocus.focus()
}
onMounted(() => {
  isUnmounted = false
  void changeCurrentList()
})
onBeforeUnmount(() => {
  isUnmounted = true
  taskStore.hideTaskDetail()
})
</script>

<template>
  <div class="task-view">
    <div
      :inert="taskStore.taskDetailVisible || undefined"
      :aria-hidden="taskStore.taskDetailVisible || undefined"
      class="list-view"
    >
      <header class="rb-page-header">
        <h1 class="rb-page-title task-title">
          <TransitionText
            :text="view.selecting ? t('workspace.selected-count', { count: view.selected.length }) : title"
          />
        </h1>
        <div class="toolbar-region" :inert="taskStore.currentList !== taskStore.displayedList || undefined">
          <TaskActions />
        </div>
      </header>
      <motion.div class="panel-content" layout-scroll :aria-busy="taskStore.listPending">
        <TaskList
          @pause="handlePauseTask"
          @resume="handleResumeTask"
          @retry="handleRetryTask"
          @redownload="handleRedownloadTask"
          @finish-sharing="handleFinishSharing"
          @finish-media="handleFinishMedia"
          @delete="handleDeleteTask"
          @delete-record="handleDeleteRecord"
          @copy-link="handleCopyLink"
          @show-info="handleShowInfo"
          @folder="handleShowInFolder"
          @open-file="handleOpenFile"
          @select-files="handleSelectFiles"
        />
      </motion.div>
    </div>
    <Transition name="push" @after-leave="finishDetailClose">
      <TaskDetail
        v-if="taskStore.taskDetailVisible"
        :show="taskStore.taskDetailVisible"
        :task="taskStore.currentTaskItem"
        :files="taskStore.currentTaskFiles"
        @pause="handlePauseTask"
        @resume="handleResumeTask"
        @close="taskStore.hideTaskDetail()"
        @retry="handleRetryTask"
        @redownload="handleRedownloadTask"
        @finish-sharing="handleFinishSharing"
        @finish-media="handleFinishMedia"
        @delete="handleDeleteTask"
        @delete-record="handleDeleteRecord"
        @copy-link="handleCopyLink"
        @folder="handleShowInFolder"
        @open-file="handleOpenFile"
        @select-files="handleSelectFiles"
      />
    </Transition>
  </div>
</template>

<style scoped>
.task-view {
  height: 100%;
  position: relative;
}

.list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.task-title {
  max-width: 34%;
  display: flex;
  align-items: center;
}

.task-title :deep(.transition-text) {
  min-width: 0;
  overflow: hidden;
}

.task-title :deep(.transition-text > span) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-region {
  min-width: 0;
  flex: 1;
}

.panel-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

@media (max-width: 959px) {
  .rb-page-header {
    gap: 8px;
  }
}

@media (max-width: 719px) {
  .rb-page-header {
    padding: 4px 16px 14px;
  }

  .task-title {
    font-size: 20px;
  }
}
</style>
