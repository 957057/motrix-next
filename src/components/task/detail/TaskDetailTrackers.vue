<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NTag } from 'naive-ui'
import { getBtTrackers } from '@/api/aria2'
import { renderDetailCopyableText } from './TaskDetailShared'
import { calcColumnWidth } from '@shared/utils/calcColumnWidth'
import { logger } from '@shared/logger'
import type { Aria2BtTracker } from '@shared/types'

const props = defineProps<{
  gid: string
  tooltip: string
  onCopy: (value: string, label: string) => void
}>()

const { t } = useI18n()
const trackers = ref<Aria2BtTracker[]>([])

const rows = computed(() =>
  trackers.value.map((tracker) => ({
    ...tracker,
    tierNumber: Number(tracker.tier) + 1,
    protocol: tracker.url.match(/^(\w+):\/\//)?.[1]?.toLowerCase() ?? 'unknown',
  })),
)

async function refreshTrackers() {
  if (!props.gid) {
    trackers.value = []
    return
  }
  try {
    trackers.value = await getBtTrackers({ gid: props.gid })
  } catch (error) {
    trackers.value = []
    logger.debug('TaskDetail.trackers', error)
  }
}

const statusType = (status: string) =>
  status === 'working' ? 'success' : status === 'error' ? 'error' : status === 'updating' ? 'warning' : 'default'

const columns = computed(() => {
  const data = rows.value
  return [
    {
      title: t('task.task-tracker-tier'),
      key: 'tierNumber',
      width: calcColumnWidth({
        title: t('task.task-tracker-tier'),
        values: data.map((row) => String(row.tierNumber)),
        sortable: true,
      }),
      align: 'center' as const,
      sorter: (a: (typeof data)[number], b: (typeof data)[number]) => a.tierNumber - b.tierNumber,
    },
    {
      title: 'URL',
      key: 'url',
      render: (row: (typeof data)[number]) =>
        renderDetailCopyableText({ value: row.url, label: 'URL', tooltip: props.tooltip, onCopy: props.onCopy }),
    },
    {
      title: t('task.task-tracker-protocol'),
      key: 'protocol',
      width: calcColumnWidth({
        title: t('task.task-tracker-protocol'),
        values: data.map((row) => row.protocol),
        sortable: true,
      }),
      align: 'center' as const,
      sorter: 'default' as const,
    },
    {
      title: t('task.task-tracker-status'),
      key: 'status',
      width: calcColumnWidth({
        title: t('task.task-tracker-status'),
        values: data.map((row) => row.status),
        sortable: true,
        extraWidth: 20,
      }),
      align: 'center' as const,
      sorter: 'default' as const,
      render: (row: (typeof data)[number]) =>
        h(NTag, { type: statusType(row.status), size: 'small', round: true }, () =>
          t(`task.task-tracker-runtime-${row.status}`),
        ),
    },
  ]
})

watch(() => props.gid, refreshTrackers)
onMounted(refreshTrackers)
</script>

<template>
  <NDataTable
    :columns="columns"
    :data="rows"
    :row-key="(row) => row.url"
    size="small"
    :bordered="true"
    :max-height="400"
    :virtual-scroll="true"
    :min-row-height="34"
    striped
  />
</template>
