<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskCardModel } from '@/composables/useTaskCardModel'
import { useTaskFileMissing } from '@/composables/useTaskFileMissing'
import { checkTaskIsBT } from '@shared/utils'
import { fileKindFromName, type FileKind } from '@shared/utils/fileKind'
import TaskItemActions from './TaskItemActions.vue'
import TransitionText from '@/components/common/TransitionText.vue'
import FileTypeIcon from '@/components/common/FileTypeIcon.vue'
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
  statusBadge,
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
const metrics = computed(() => {
  const items: { key: string; label: string; value: string }[] = []
  if (hasSizeInfo.value)
    items.push({
      key: 'size',
      label: props.task.media && props.task.status !== 'complete' ? t('media.duration') : t('task.task-file-size'),
      value: `${completedSize.value} / ${totalSize.value}`,
    })
  if (isActive.value || isSharing.value)
    items.push({
      key: 'speed',
      label: isSharing.value ? t('task.task-upload-speed') : t('task.task-download-speed'),
      value: `${isSharing.value ? uploadSpeed.value : downloadSpeed.value}/s`,
    })
  if (isActive.value && remainingText.value)
    items.push({ key: 'remaining', label: t('task.remaining-prefix'), value: remainingText.value })
  if (props.task.connections)
    items.push({ key: 'connections', label: t('task.task-connections'), value: String(props.task.connections) })
  return items
})
</script>

<template>
  <section class="detail-overview">
    <div class="detail-identity">
      <FileTypeIcon :kind="kind" :size="52" />
      <div class="detail-title">
        <h1>{{ taskFullName }}</h1>
        <span class="rb-pill" :data-tone="tone">
          <TransitionText :text="fileMissing ? t('task.file-not-exist') : (statusBadge?.label ?? '')" />
        </span>
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
    <dl v-if="metrics.length" class="detail-metrics">
      <div v-for="metric in metrics" :key="metric.key" class="metric-tile">
        <dt>{{ metric.label }}</dt>
        <dd>{{ metric.value }}</dd>
      </div>
    </dl>
    <div v-if="!isMetadataFetching && !indeterminate" class="detail-progress">
      <progress
        class="rb-progress"
        :class="{ 'rb-progress--done': task.status === 'complete', 'rb-progress--paused': task.status === 'paused' }"
        :value="percent"
        max="100"
        :aria-label="t('task.task-progress-info')"
      />
      <span class="detail-percent">{{ Math.round(percent) }}%</span>
    </div>
  </section>
</template>

<style scoped>
.detail-overview {
  padding: 4px 0 20px;
}

.detail-identity {
  display: flex;
  align-items: center;
  gap: 18px;
}

.detail-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

h1 {
  font-size: 22px;
  line-height: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.metric-tile {
  padding: 12px 14px;
  border-radius: var(--rb-radius-tile);
  background: var(--rb-raised);
  box-shadow: var(--rb-shadow-raised);
  min-width: 0;
}

dt {
  color: var(--rb-text-muted);
  font-size: 12px;
  line-height: 16px;
}

dd {
  margin-top: 4px;
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.detail-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}

.detail-progress .rb-progress {
  height: 7px;
}

.detail-percent {
  min-width: 40px;
  text-align: end;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-muted);
  font-variant-numeric: tabular-nums;
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
