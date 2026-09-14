<script setup lang="ts">
/** @fileoverview Shared save/discard action bar for preference pages. */
import { useI18n } from 'vue-i18n'
import { NButton, NCollapseTransition } from 'naive-ui'

withDefaults(defineProps<{ isDirty: boolean; isValid?: boolean; isSaving?: boolean }>(), {
  isValid: true,
  isSaving: false,
})
defineEmits<{ save: []; discard: [] }>()

const { t } = useI18n()
</script>

<template>
  <NCollapseTransition :show="isDirty || isSaving">
    <div class="form-actions">
      <span class="form-dirty-state" role="status">{{ t('preferences.not-saved') }}</span>
      <div class="form-action-buttons">
        <NButton :disabled="isSaving" @click="$emit('discard')">{{ t('preferences.discard') }}</NButton>
        <NButton
          :type="isDirty && isValid ? 'primary' : 'default'"
          :disabled="!isDirty || !isValid || isSaving"
          :loading="isSaving"
          @click="$emit('save')"
        >
          {{ t('preferences.save') }}
        </NButton>
      </div>
    </div>
  </NCollapseTransition>
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
.form-action-buttons {
  display: flex;
  gap: 12px;
}
.form-dirty-state {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
}
</style>
