<script setup lang="ts">
/** @fileoverview Task list view with polling, task actions, and file delete confirmation. */
import { motion } from 'motion-v'
import { watchDebounced, useDocumentVisibility } from '@vueuse/core'
import { computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/stores/task'
import { useTaskSelectionStore } from '@/stores/taskSelection'
import { useAppStore } from '@/stores/app'
import { usePreferenceStore } from '@/stores/preference'

import { isEngineReady } from '@/api/aria2'
import { useTaskActions } from '@/composables/useTaskActions'

import { logger } from '@shared/logger'
import { useTaskViewStore } from '@/stores/taskView'
import { NInput, NIcon, useDialog } from 'naive-ui'
import { useAppMessage } from '@/composables/useAppMessage'
import TaskList from '@/components/task/TaskList.vue'
import TaskActions from '@/components/task/TaskActions.vue'
import TaskDetail from '@/components/task/TaskDetail.vue'

const props = withDefaults(defineProps<{ status?: string }>(), { status: 'all' })

import { SearchOutline } from '@vicons/ionicons5'
const view = useTaskViewStore()
const visibility = useDocumentVisibility()
let returnFocus: HTMLElement | null = null
const { t } = useI18n()
const taskStore = useTaskStore()
const appStore = useAppStore()
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
  { key: 'all', title: t('task.scope-all') || 'All' },
  { key: 'progress', title: t('task.scope-progress') || 'In Progress' },
  { key: 'failed', title: t('workspace.needs-action') },
  { key: 'completed', title: t('task.scope-completed') || 'Completed' },
])

const title = computed(() => {
  const sub = subnavs.value.find((s) => s.key === props.status)
  return sub?.title ?? props.status
})

watchDebounced(
  () => view.query,
  () => {
    if (!isUnmounted) taskStore.setCurrentTaskPage(1)
  },
  { debounce: 180, maxWait: 400 },
)

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pollStopped = true
let isUnmounted = false
let changeRequestId = 0

function startPolling() {
  if (isUnmounted || visibility.value === 'hidden') return
  stopPolling()
  pollStopped = false
  async function tick() {
    if (pollStopped) return
    if (isEngineReady()) {
      await taskStore.fetchList().catch((e) => logger.debug('TaskView.fetchList', e))
    }
    if (pollStopped) return
    refreshTimer = setTimeout(tick, appStore.interval)
  }
  refreshTimer = setTimeout(tick, appStore.interval)
}

function stopPolling() {
  pollStopped = true
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

async function changeCurrentList() {
  stopPolling()
  const requestId = ++changeRequestId
  await taskStore.changeCurrentList(props.status)
  if (isUnmounted || requestId !== changeRequestId) return
  startPolling()
}

watch(
  () => props.status,
  () => {
    void changeCurrentList()
  },
)
watch(visibility, (state) => {
  if (state === 'hidden') stopPolling()
  else if (!isUnmounted) void changeCurrentList()
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
  changeRequestId += 1
  stopPolling()
  taskStore.hideTaskDetail()
})
// Task action handlers are now provided by useTaskActions composable above.
// Magnet file selection is handled at app-level in MainLayout.vue.
</script>

<template>
  <div class="task-view">
    <div
      :inert="taskStore.taskDetailVisible || undefined"
      :aria-hidden="taskStore.taskDetailVisible || undefined"
      class="list-view"
    >
      <header class="panel-header">
        <h1 class="task-title">{{ title }}</h1>
        <NInput
          v-model:value="view.query"
          class="task-search"
          clearable
          :placeholder="t('workspace.search-tasks')"
          :aria-label="t('workspace.search-tasks')"
          ><template #prefix
            ><NIcon><SearchOutline /></NIcon></template
        ></NInput>
        <TaskActions />
      </header>
      <motion.div class="panel-content" layout-scroll>
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
    <Transition name="view" @after-leave="finishDetailClose">
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
.panel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px 20px;
  min-height: 40px;
}
.task-title {
  flex: 1;
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  margin: 0;
  white-space: nowrap;
}
.task-search {
  width: 180px;
}
.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 959px) {
  .task-search {
    width: 140px;
  }
  .panel-header {
    gap: 8px;
  }
}
@media (max-width: 719px) {
  .panel-header {
    padding: 8px 16px 16px;
    flex-wrap: wrap;
  }
  .task-title {
    font-size: 20px;
  }
  .task-search {
    order: 3;
    width: 100%;
  }
}
</style>
