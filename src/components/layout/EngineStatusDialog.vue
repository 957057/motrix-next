<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NModal, NSpin, NText } from 'naive-ui'
import { CloseCircleOutline } from '@vicons/ionicons5'
import { useEngineStore } from '@/stores/engine'
import { useAppMessage } from '@/composables/useAppMessage'
import { getErrorMessage } from '@shared/utils/errorMessage'

const { t } = useI18n()
const engineStore = useEngineStore()
const message = useAppMessage()
const pendingAction = ref<'cancel' | 'retry' | null>(null)

const recovering = computed(() => engineStore.isBusy)
const failed = computed(() => engineStore.snapshot.phase === 'failed')
const title = computed(() =>
  engineStore.snapshot.cause === 'runtimeCrash' ? t('app.engine-crashed') : t('app.engine-failed'),
)

async function cancel() {
  if (pendingAction.value) return
  pendingAction.value = 'cancel'
  try {
    await engineStore.cancel()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    pendingAction.value = null
  }
}

async function retry() {
  if (pendingAction.value) return
  pendingAction.value = 'retry'
  try {
    await engineStore.ensureRunning('manualRestart')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    pendingAction.value = null
  }
}
</script>

<template>
  <NModal :show="engineStore.showStatusDialog" :mask-closable="false" :close-on-esc="false" transform-origin="center">
    <div class="engine-dialog">
      <div class="engine-dialog-header">
        <span class="engine-dialog-title">{{ title }}</span>
      </div>
      <div class="engine-dialog-body">
        <div v-if="recovering" class="engine-phase">
          <NSpin size="medium" />
          <NText class="engine-main-text">{{ t('app.engine-recovering') }}</NText>
          <NText depth="3">
            {{ t('app.engine-retry') }} {{ engineStore.snapshot.attempt }} / {{ engineStore.snapshot.maxAttempts }}
          </NText>
        </div>
        <div v-else-if="failed" class="engine-phase">
          <div class="engine-icon-error">
            <NIcon :size="40"><CloseCircleOutline /></NIcon>
          </div>
          <NText class="engine-main-text">{{ t('app.engine-unrecoverable') }}</NText>
          <NText v-if="engineStore.snapshot.failure" depth="3" class="engine-error-message">
            {{ engineStore.snapshot.failure.message }}
          </NText>
        </div>
      </div>
      <div class="engine-dialog-footer">
        <NButton :loading="pendingAction === 'cancel'" :disabled="pendingAction !== null" @click="cancel">
          {{ t('app.cancel') }}
        </NButton>
        <NButton v-if="failed" type="primary" :loading="pendingAction === 'retry'" @click="retry">
          {{ t('app.engine-manual-retry') }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.engine-dialog {
  width: 420px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--m3-surface-container-high);
  box-shadow: 0 12px 40px var(--m3-shadow);
}

.engine-dialog-header {
  padding: 18px 22px 0;
}

.engine-dialog-title,
.engine-main-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--m3-on-surface);
}

.engine-dialog-body {
  display: flex;
  min-height: 230px;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.engine-phase {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.engine-icon-error {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--m3-error);
  background: color-mix(in srgb, var(--m3-error) 12%, transparent);
}

.engine-error-message {
  max-width: 340px;
  overflow-wrap: anywhere;
}

.engine-dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px 30px 22px;
  border-top: 1px solid var(--m3-outline-variant);
}

.engine-dialog-footer :deep(.n-button) {
  min-width: 120px;
}
</style>
