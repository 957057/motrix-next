<script setup lang="ts">
/** Native transfer status, a recent-speed sparkline and explicit speed-limit controls. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { NIcon, NPopover, NInputNumber, NSelect, NButton, NSwitch, NPagination } from 'naive-ui'
import { ArrowUp, ArrowDown, Timer, ChevronUp, Gauge } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { usePreferenceStore } from '@/stores/preference'
import { useTaskStore } from '@/stores/task'
import { changeGlobalOption, isEngineReady } from '@/api/aria2'
import { bytesToSize } from '@shared/utils'
import {
  formatLimitBadge,
  parseSpeedLimitValue,
  buildSpeedLimitString,
  toggleSpeedLimit,
  applyCustomLimit,
} from '@/composables/useSpeedLimiter'
import { useAppMessage } from '@/composables/useAppMessage'
import { logger } from '@shared/logger'
import Sparkline from '@/components/common/Sparkline.vue'

const route = useRoute()
const tasks = useTaskStore()
const { t } = useI18n()
const appStore = useAppStore()
const preferenceStore = usePreferenceStore()
const message = useAppMessage()

const stat = computed(() => appStore.stat)
const isLimited = computed(() => !!preferenceStore.config.speedLimitEnabled)
const isScheduleActive = computed(() => !!preferenceStore.config.speedScheduleEnabled)
const downloadSpeed = computed(() => bytesToSize(String(stat.value.downloadSpeed)))
const uploadSpeed = computed(() => bytesToSize(String(stat.value.uploadSpeed)))
const transferring = computed(() => stat.value.downloadSpeed > 0 || stat.value.uploadSpeed > 0)
const dlLimitBadge = computed(() => formatLimitBadge(preferenceStore.config.maxOverallDownloadLimit))
const ulLimitBadge = computed(() => formatLimitBadge(preferenceStore.config.maxOverallUploadLimit))

const showPopover = ref(false)
const applying = ref(false)
const popoverDlValue = ref(0)
const popoverDlUnit = ref('K')
const popoverUlValue = ref(0)
const popoverUlUnit = ref('K')
const speedUnitOptions = [
  { label: 'KB/s', value: 'K' },
  { label: 'MB/s', value: 'M' },
]

function openPopover() {
  const dl = parseSpeedLimitValue(preferenceStore.config.maxOverallDownloadLimit)
  const ul = parseSpeedLimitValue(preferenceStore.config.maxOverallUploadLimit)
  popoverDlValue.value = dl.num
  popoverDlUnit.value = dl.unit
  popoverUlValue.value = ul.num
  popoverUlUnit.value = ul.unit
  showPopover.value = true
}

function makeDeps() {
  return {
    changeGlobalOption,
    updateAndSave: (partial: Partial<typeof preferenceStore.config>) => preferenceStore.updateAndSave(partial),
  }
}

async function handleClick() {
  if (!isEngineReady() || applying.value) return
  applying.value = true
  try {
    const result = await toggleSpeedLimit(preferenceStore.config, makeDeps())
    if (result === 'enabled') message.success(t('app.speedometer-limit-applied'))
    else if (result === 'disabled') message.success(t('app.speedometer-limit-removed'))
    else message.info(t('app.speedometer-needs-config'))
  } catch (error) {
    logger.error('StatusBar.toggleLimit', error)
    message.error(t('preferences.save-fail-message'))
  } finally {
    applying.value = false
  }
}

async function handleApply() {
  if (!isEngineReady() || applying.value) return
  if (popoverDlValue.value === 0 && popoverUlValue.value === 0) {
    message.warning(t('app.speedometer-enter-values'))
    return
  }
  const dlStr = buildSpeedLimitString(popoverDlValue.value, popoverDlUnit.value)
  const ulStr = buildSpeedLimitString(popoverUlValue.value, popoverUlUnit.value)
  applying.value = true
  try {
    await applyCustomLimit(dlStr, ulStr, makeDeps())
    showPopover.value = false
    message.success(t('app.speedometer-limit-applied'))
  } catch (e) {
    logger.error('StatusBar.applyLimit', e)
    message.error(t('preferences.save-fail-message'))
  } finally {
    applying.value = false
  }
}

async function handleScheduleToggle(enabled: boolean) {
  if (applying.value) return
  applying.value = true
  try {
    await preferenceStore.updateAndSave({ speedScheduleEnabled: enabled })
    message.success(t(enabled ? 'app.schedule-enabled' : 'app.schedule-disabled'))
  } catch (error) {
    logger.error('StatusBar.toggleSchedule', error)
    message.error(t('preferences.save-fail-message'))
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <footer class="status-bar">
    <div class="transfer-status" :class="{ transferring }">
      <span class="transfer-metric transfer-metric--down">
        <NIcon :size="14"><ArrowDown /></NIcon>
        <span class="transfer-value">{{ downloadSpeed }}/s</span>
      </span>
      <span class="transfer-metric transfer-metric--up">
        <NIcon :size="14"><ArrowUp /></NIcon>
        <span class="transfer-value">{{ uploadSpeed }}/s</span>
      </span>
    </div>
    <Sparkline class="transfer-graph" :values="appStore.speedHistory.down" :height="26" />
    <NPagination
      v-if="route.path.startsWith('/task') && tasks.currentTaskPageCount() > 1"
      :page="tasks.taskPagination[tasks.currentList].page"
      :page-count="tasks.currentTaskPageCount()"
      :page-slot="3"
      :disabled="tasks.currentList !== tasks.displayedList"
      size="small"
      @update:page="tasks.setCurrentTaskPage"
    />
    <NPopover
      :show="showPopover"
      trigger="click"
      placement="top-end"
      :show-arrow="false"
      @update:show="(value) => (value ? openPopover() : (showPopover = false))"
    >
      <template #trigger>
        <button
          class="limit-trigger"
          :class="{ limited: isLimited }"
          :aria-label="t('app.speedometer-set-limit')"
          :aria-expanded="showPopover"
        >
          <NIcon :size="14"><Gauge /></NIcon>
          <span class="limit-label">{{ t('app.speedometer-set-limit') }}</span>
          <span v-if="isLimited" class="limit-badge">{{ dlLimitBadge }} / {{ ulLimitBadge }}</span>
          <NIcon class="limit-chevron" :class="{ expanded: showPopover }" :size="14" aria-hidden="true"
            ><ChevronUp
          /></NIcon>
        </button>
      </template>
      <div class="limit-panel">
        <div class="limit-panel-heading">
          <div class="limit-panel-title">{{ t('app.speedometer-enable-limit') }}</div>
          <NSwitch
            :disabled="applying"
            :value="isLimited"
            :aria-label="t('app.speedometer-enable-limit')"
            @update:value="handleClick"
          />
        </div>
        <div class="limit-panel-row">
          <div class="limit-panel-label">
            <NIcon :size="13"><ArrowDown /></NIcon>
            <span>{{ t('app.speedometer-download-limit') }}</span>
          </div>
          <div class="limit-panel-inputs">
            <NInputNumber
              v-model:value="popoverDlValue"
              :input-props="{ 'aria-label': t('app.speedometer-download-limit') }"
              :disabled="applying"
              :min="0"
              :max="65535"
              :step="1"
              :show-button="false"
              size="small"
              style="width: 88px"
            />
            <NSelect
              v-model:value="popoverDlUnit"
              :disabled="applying"
              :options="speedUnitOptions"
              size="small"
              style="width: 84px"
            />
          </div>
        </div>
        <div class="limit-panel-row">
          <div class="limit-panel-label">
            <NIcon :size="13"><ArrowUp /></NIcon>
            <span>{{ t('app.speedometer-upload-limit') }}</span>
          </div>
          <div class="limit-panel-inputs">
            <NInputNumber
              v-model:value="popoverUlValue"
              :input-props="{ 'aria-label': t('app.speedometer-upload-limit') }"
              :disabled="applying"
              :min="0"
              :max="65535"
              :step="1"
              :show-button="false"
              size="small"
              style="width: 88px"
            />
            <NSelect
              v-model:value="popoverUlUnit"
              :disabled="applying"
              :options="speedUnitOptions"
              size="small"
              style="width: 84px"
            />
          </div>
        </div>
        <div class="limit-panel-row limit-panel-row--schedule">
          <div class="limit-panel-label">
            <NIcon :size="13"><Timer /></NIcon>
            <span>{{ t('preferences.speed-schedule-enabled') }}</span>
          </div>
          <NSwitch
            :disabled="applying"
            :aria-label="t('preferences.speed-schedule-enabled')"
            :value="isScheduleActive"
            size="small"
            @update:value="handleScheduleToggle"
          />
        </div>
        <p v-if="isScheduleActive && !isLimited" class="limit-panel-note">
          {{ t('preferences.schedule-needs-limit') }}
        </p>
        <NButton type="primary" :loading="applying" :disabled="applying" block class="limit-apply" @click="handleApply">
          {{ t('app.speedometer-apply') }}
        </NButton>
      </div>
    </NPopover>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  flex-shrink: 0;
  gap: 18px;
  align-items: center;
  min-height: 44px;
  padding-inline: var(--rb-page-inline);
  border-top: 1px solid var(--rb-hairline);
  font-size: 12px;
  color: var(--rb-text-muted);
}

.transfer-status {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}

.transfer-metric {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--rb-text-muted);
  transition: color var(--rb-motion-view) var(--rb-ease);
}

.transfer-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 72px;
  color: var(--rb-text);
}

.transferring .transfer-metric--down .n-icon {
  color: var(--rb-accent);
}

.transfer-graph {
  flex: 1 1 120px;
  max-width: 320px;
  align-self: stretch;
  padding-block: 8px;
}

.limit-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  color: var(--rb-text-muted);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--rb-motion-feedback) var(--rb-ease),
    color var(--rb-motion-feedback) var(--rb-ease);
}

.limit-trigger:hover {
  color: var(--rb-text);
  background: var(--rb-hover);
}

.limit-trigger.limited {
  color: var(--rb-accent-text);
  background: var(--rb-accent-soft);
}

.limit-badge {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.limit-chevron {
  flex-shrink: 0;
  transition: transform var(--rb-motion-view) var(--rb-ease);
}

.limit-chevron.expanded {
  transform: rotate(180deg);
}

.limit-panel {
  width: min(320px, calc(100vw - 56px));
  max-height: calc(100dvh - 96px);
  overflow: auto;
}

.limit-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--rb-hairline);
}

.limit-panel-title {
  font-weight: 600;
  color: var(--rb-text);
}

.limit-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-block: 8px;
}

.limit-panel-row--schedule {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--rb-hairline);
}

.limit-panel-label {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--rb-text);
}

.limit-panel-inputs {
  display: flex;
  gap: 6px;
}

.limit-panel-note {
  margin-top: 4px;
  font-size: 12px;
  color: var(--rb-warning);
}

.limit-apply {
  margin-top: 12px;
}

@media (max-width: 719px) {
  .status-bar {
    padding-inline: 16px;
    gap: 8px;
  }

  .transfer-metric--up,
  .transfer-graph {
    display: none;
  }
}

@media (max-width: 479px) {
  .limit-badge,
  .limit-label {
    display: none;
  }
}
</style>
