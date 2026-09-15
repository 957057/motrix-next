<script setup lang="ts">
import { NCheckbox, NCheckboxGroup } from 'naive-ui'

defineProps<{
  value: string[]
  options: Array<{ label: string; value: string }>
}>()

const emit = defineEmits<{
  'update:value': [value: string[]]
}>()
</script>

<template>
  <NCheckboxGroup
    class="pref-control-full"
    :value="value"
    @update:value="(next) => emit('update:value', next as string[])"
  >
    <div class="preference-checkbox-grid">
      <NCheckbox v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </NCheckbox>
    </div>
  </NCheckboxGroup>
</template>

<style scoped>
.preference-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 8px 24px;
  max-width: 540px;
  margin-inline-start: auto;
  padding: 3px 0;
}

.preference-checkbox-grid :deep(.n-checkbox) {
  min-height: 28px;
  align-items: flex-start;
}

.preference-checkbox-grid :deep(.n-checkbox__label) {
  color: var(--rb-text);
  font-size: 13px;
  line-height: 1.35;
}
@container (max-width: 700px) {
  .preference-checkbox-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container (max-width: 560px) {
  .preference-checkbox-grid {
    margin-inline-start: 0;
  }
}
</style>
