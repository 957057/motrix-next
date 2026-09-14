<script setup lang="ts">
/** @fileoverview Shared save/discard action bar for preference pages. */
import { useI18n } from 'vue-i18n'
import { NButton, NSpace } from 'naive-ui'

withDefaults(defineProps<{ isDirty: boolean; isValid?: boolean }>(), {
  isValid: true,
})
defineEmits<{ save: []; discard: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="form-actions">
    <NSpace :size="12" align="center">
      <NButton
        :type="isDirty && isValid ? 'primary' : 'default'"
        :disabled="!isDirty || !isValid"
        @click="$emit('save')"
      >
        {{ t('preferences.save') }}
      </NButton>
      <NButton quaternary :disabled="!isDirty" @click="$emit('discard')">
        {{ t('preferences.discard') }}
      </NButton>
    </NSpace>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
  border-top: 1px solid var(--divider);
  padding: 12px 24px;
}
</style>
