<script setup lang="ts">
/** @fileoverview Shared BitTorrent file selector for local torrents and magnets. */
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NInput } from 'naive-ui'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { bytesToSize } from '@shared/utils'
import { calcColumnWidth } from '@shared/utils/calcColumnWidth'
import type { BtFileSelectionItem } from '@shared/types'

const props = withDefaults(
  defineProps<{
    files: BtFileSelectionItem[]
    selectedIndices: number[]
    maxHeight?: number
  }>(),
  { maxHeight: 240 },
)

const emit = defineEmits<{
  'update:selectedIndices': [indices: number[]]
}>()

const { t } = useI18n()
const query = ref('')
const visibleFiles = computed(() =>
  props.files.filter((file) => file.path.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())),
)

const commonRoot = computed(() => {
  const paths = props.files.map((file) => file.path.replace(/\\/g, '/'))
  const root = paths[0]?.split('/')[0]
  return root && paths.every((path) => path.startsWith(`${root}/`)) ? `${root}/` : ''
})
function displayPath(path: string) {
  return path.replace(/\\/g, '/').slice(commonRoot.value.length)
}

const columns = computed<DataTableColumns<BtFileSelectionItem>>(() => [
  { type: 'selection' },
  {
    title: t('task.file-name'),
    key: 'path',
    ellipsis: true,
    render: (row) => h('span', { title: row.path }, displayPath(row.path)),
  },
  {
    title: t('task.file-size'),
    key: 'length',
    align: 'right',
    width: calcColumnWidth({
      title: t('task.file-size'),
      values: props.files.map((file) => bytesToSize(file.length)),
      sortable: true,
    }),
    sorter: (a, b) => a.length - b.length,
    render: (row) => bytesToSize(row.length),
  },
])

const selectedFiles = computed(() => {
  const selected = new Set(props.selectedIndices)
  return props.files.filter((file) => selected.has(file.index))
})
const selectedSize = computed(() => selectedFiles.value.reduce((sum, file) => sum + file.length, 0))

function updateSelection(keys: DataTableRowKey[]) {
  const visible = new Set(visibleFiles.value.map((file) => file.index))
  const hiddenSelection = props.selectedIndices.filter((index) => !visible.has(index))
  emit('update:selectedIndices', [...new Set([...hiddenSelection, ...keys.map(Number).filter(Number.isFinite)])])
}
</script>

<template>
  <div class="bt-file-selector">
    <NInput
      v-model:value="query"
      :placeholder="t('task.search-files')"
      :input-props="{ 'aria-label': t('task.search-files') }"
      clearable
    />
    <NDataTable
      :columns="columns"
      :bordered="false"
      :single-line="true"
      :theme-overrides="{ borderColor: 'transparent', tdPaddingSmall: '10px 12px', thPaddingSmall: '8px 12px' }"
      :pagination="false"
      :data="visibleFiles"
      :row-key="(row: BtFileSelectionItem) => row.index"
      :checked-row-keys="selectedIndices"
      :max-height="maxHeight"
      size="small"
      @update:checked-row-keys="updateSelection"
    />
    <div class="file-summary" aria-live="polite">
      <span class="summary-value"> {{ selectedIndices.length }}/{{ files.length }} </span>

      <span class="summary-divider">—</span>
      <span class="summary-value">{{ bytesToSize(selectedSize) }}</span>
    </div>
  </div>
</template>

<style scoped>
.bt-file-selector {
  display: grid;
  gap: 10px;
}

.file-summary {
  display: inline-flex;
  justify-self: end;
  align-items: baseline;
  gap: 6px;
  min-height: 20px;
  color: var(--m3-on-surface-variant);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.summary-value {
  color: var(--m3-on-surface);
  font-weight: 600;
}

.summary-divider {
  color: var(--m3-outline);
}
</style>
