<script setup lang="ts">
/** @fileoverview Shared save/discard action bar for preference pages. */
import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'
import { AnimatePresence, motion } from 'motion-v'

withDefaults(defineProps<{ isDirty: boolean; isValid?: boolean; isSaving?: boolean }>(), {
  isValid: true,
  isSaving: false,
})
defineEmits<{ save: []; discard: [] }>()

const { t } = useI18n()
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-if="isDirty || isSaving"
      key="bar"
      class="form-actions-host"
      :initial="{ opacity: 0, y: 24 }"
      :animate="{ opacity: 1, y: 0 }"
      :exit="{ opacity: 0, y: 24 }"
    >
      <div class="form-actions">
        <span class="form-dirty-state" role="status">{{ t('preferences.not-saved') }}</span>
        <div class="form-action-buttons">
          <NButton size="small" :disabled="isSaving" @click="$emit('discard')">{{ t('preferences.discard') }}</NButton>
          <NButton
            size="small"
            :type="isDirty && isValid ? 'primary' : 'default'"
            :disabled="!isDirty || !isValid || isSaving"
            :loading="isSaving"
            @click="$emit('save')"
          >
            {{ t('preferences.save') }}
          </NButton>
        </div>
      </div>
    </motion.div>
  </AnimatePresence>
</template>

<style scoped>
.form-actions-host {
  position: absolute;
  inset-inline: var(--rb-page-inline);
  bottom: 16px;
  z-index: 5;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: space-between;
  width: min(100%, 560px);
  padding: 8px 8px 8px 16px;
  border-radius: 999px;
  background: var(--rb-overlay);
  box-shadow: var(--rb-shadow-overlay);
  pointer-events: auto;
}

.form-action-buttons {
  display: flex;
  gap: 8px;
}

.form-dirty-state {
  color: var(--rb-text-muted);
  font-size: 12px;
  font-weight: 500;
}
</style>
