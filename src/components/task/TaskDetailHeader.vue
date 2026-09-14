<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { DocumentOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useTaskCardModel } from '@/composables/useTaskCardModel'
import { useTaskFileMissing } from '@/composables/useTaskFileMissing'
import TaskItemActions from './TaskItemActions.vue'
import type { Aria2Task } from '@shared/types'
const props = defineProps<{ task: Aria2Task; pending: boolean }>()
defineEmits<{
  pause: [task: Aria2Task]
  resume: [task: Aria2Task]
  retry: [task: Aria2Task]
  redownload: [task: Aria2Task]
  'finish-sharing': [task: Aria2Task]
  'finish-media': [task: Aria2Task]
  delete: [task: Aria2Task]
  'delete-record': [task: Aria2Task]
  'copy-link': [task: Aria2Task]
  folder: [task: Aria2Task]
  'open-file': [task: Aria2Task]
  'select-files': [task: Aria2Task]
}>()
const { t } = useI18n()
const taskRef = computed(() => props.task)
const { fileMissing } = useTaskFileMissing(taskRef)
const {
  taskFullName,
  hasSizeInfo,
  taskStatus,
  completedSize,
  totalSize,
  downloadSpeed,
  uploadSpeed,
  percent,
  indeterminate,
  isMetadataFetching,
  isActive,
  isSharing,
  remainingText,
} = useTaskCardModel(taskRef)
</script>

<template>
  <section class="detail-overview">
    <div class="detail-identity">
      <NIcon :size="40"><DocumentOutline /></NIcon>
      <div class="detail-title">
        <h1>{{ taskFullName }}</h1>
        <p>{{ taskStatus }}</p>
      </div>
      <TaskItemActions
        :task="task"
        :pending="pending"
        :file-missing="fileMissing"
        in-detail
        @pause="$emit('pause', task)"
        @resume="$emit('resume', task)"
        @retry="$emit('retry', task)"
        @redownload="$emit('redownload', task)"
        @finish-sharing="$emit('finish-sharing', task)"
        @finish-media="$emit('finish-media', task)"
        @delete="$emit('delete', task)"
        @delete-record="$emit('delete-record', task)"
        @copy-link="$emit('copy-link', task)"
        @folder="$emit('folder', task)"
        @open-file="$emit('open-file', task)"
        @select-files="$emit('select-files', task)"
      />
    </div>
    <dl class="detail-metrics">
      <div v-if="hasSizeInfo">
        <dt>{{ task.media && task.status !== 'complete' ? t('media.duration') : t('task.task-file-size') }}</dt>
        <dd>{{ completedSize }} / {{ totalSize }}</dd>
      </div>
      <div v-if="isActive || isSharing">
        <dt>{{ isSharing ? t('task.task-upload-speed') : t('task.task-download-speed') }}</dt>
        <dd>{{ isSharing ? uploadSpeed : downloadSpeed }}</dd>
      </div>
      <div v-if="isActive && remainingText">
        <dt>{{ t('task.remaining-prefix') }}</dt>
        <dd>{{ remainingText }}</dd>
      </div>
      <div v-if="task.connections">
        <dt>{{ t('task.task-connections') }}</dt>
        <dd>{{ task.connections }}</dd>
      </div>
    </dl>
    <div v-if="!isMetadataFetching && !indeterminate" class="detail-progress">
      <progress :value="percent" max="100" :aria-label="t('task.task-progress-info')" /><span
        >{{ Math.round(percent) }}%</span
      >
    </div>
  </section>
</template>

<style scoped>
.detail-overview {
  padding: 8px 0 24px;
}
.detail-identity {
  display: flex;
  align-items: center;
  gap: 20px;
}
.detail-identity > .n-icon {
  flex-shrink: 0;
}
.detail-title {
  flex: 1;
  min-width: 0;
}
h1 {
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
p,
dt {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
  line-height: 20px;
}
.detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  margin-top: 24px;
}
dd {
  font-size: 16px;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.detail-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  font-size: 13px;
}
progress {
  width: 100%;
  height: 4px;
  appearance: none;
  border: 0;
  border-radius: 2px;
  accent-color: var(--m3-primary);
}
progress::-webkit-progress-bar {
  background: var(--progress-track);
  border-radius: 2px;
}
progress::-webkit-progress-value {
  background: var(--m3-primary);
  border-radius: 2px;
  transition: width 240ms linear;
}
@media (max-height: 480px) {
  .detail-metrics {
    margin-top: 12px;
  }
  .detail-overview {
    padding-bottom: 12px;
  }
}
</style>
