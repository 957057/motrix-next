<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NPopover,
  NButton,
  NIcon,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NSelect,
  NCollapseTransition,
} from 'naive-ui'
import { SlidersHorizontal } from '@lucide/vue'
import { useTaskStore } from '@/stores/task'
import { usePreferenceStore } from '@/stores/preference'
import { useAppMessage } from '@/composables/useAppMessage'
import {
  ALL_SORT_FIELDS,
  PROGRESS_SORT_FIELDS,
  TERMINAL_SORT_FIELDS,
  type ProgressSortField,
  type TerminalSortField,
  type SortDirection,
} from '@/composables/useTaskSort'
import type { I18nKey } from '@shared/i18nTypes'
import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'

const { t } = useI18n()
const tasks = useTaskStore()
const preferences = usePreferenceStore()
const message = useAppMessage()
const busy = ref(false)
const show = ref(false)
const sort = computed(() => preferences.config.taskSort[tasks.currentList])
const fields = computed(() =>
  tasks.currentList === 'all'
    ? ALL_SORT_FIELDS
    : tasks.currentList === 'progress'
      ? PROGRESS_SORT_FIELDS
      : TERMINAL_SORT_FIELDS,
)
const labels: Record<ProgressSortField | TerminalSortField, I18nKey> = {
  manual: 'task.sort-manual',
  'added-at': 'task.sort-added-at',
  'completed-at': 'task.sort-completed-at',
  name: 'task.sort-name',
  size: 'task.sort-size',
  progress: 'task.sort-progress',
  speed: 'task.sort-speed',
}
const options = computed(() => fields.value.map((value) => ({ value, label: t(labels[value]) })))
const directions = computed(() => [
  { value: 'asc', label: t('workspace.ascending') },
  { value: 'desc', label: t('workspace.descending') },
])
async function save(operation: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    if ((await operation()) === false) throw new Error('Could not save view preferences')
  } catch (error) {
    logger.warn('TaskViewOptions.save', getErrorMessage(error))
    message.error(t('preferences.save-fail-message'))
  } finally {
    busy.value = false
  }
}
function setField(field: ProgressSortField | TerminalSortField) {
  void save(() => tasks.setCurrentSort(field, sort.value.direction))
}
function setDirection(direction: SortDirection) {
  void save(() => tasks.setCurrentSort(sort.value.field, direction))
}
</script>

<template>
  <NPopover v-model:show="show" trigger="click" placement="bottom-end" :show-arrow="false">
    <template #trigger>
      <NButton quaternary :aria-label="t('workspace.view')" :aria-expanded="show">
        <template #icon
          ><NIcon :size="15"><SlidersHorizontal /></NIcon
        ></template>
        {{ t('workspace.view') }}
      </NButton>
    </template>
    <NForm class="view-options" label-placement="top" :show-feedback="false" :disabled="busy">
      <NFormItem :label="t('workspace.display')">
        <NRadioGroup
          :value="preferences.config.taskCardMode"
          :aria-label="t('workspace.display')"
          @update:value="
            (value) => save(() => preferences.updateAndSave({ taskCardMode: value as 'full' | 'compact' }))
          "
        >
          <NRadioButton value="full">{{ t('workspace.comfortable') }}</NRadioButton>
          <NRadioButton value="compact">{{ t('workspace.compact') }}</NRadioButton>
        </NRadioGroup>
      </NFormItem>
      <NFormItem :label="t('task.sort-by')">
        <NSelect :value="sort.field" :options="options" :aria-label="t('task.sort-by')" @update:value="setField" />
      </NFormItem>
      <NCollapseTransition :show="sort.field !== 'manual'"
        ><NFormItem :label="t('workspace.sort-order')">
          <NSelect
            :value="sort.direction"
            :options="directions"
            :aria-label="t('workspace.sort-order')"
            @update:value="setDirection"
          /> </NFormItem
      ></NCollapseTransition>
    </NForm>
  </NPopover>
</template>

<style scoped>
.view-options {
  width: min(240px, calc(100vw - 64px));
  max-height: calc(100dvh - 120px);
  overflow: auto;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.view-options :deep(.n-form-item-label) {
  padding-bottom: 6px;
}
</style>
