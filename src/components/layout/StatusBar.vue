<script setup lang="ts">
/** Native transfer status and explicit speed-limit controls. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { usePreferenceStore } from '@/stores/preference'
import { changeGlobalOption, isEngineReady } from '@/api/aria2'
import { bytesToSize } from '@shared/utils'
import { NIcon, NPopover, NInputNumber, NSelect, NButton, NSwitch, NDivider, NText } from 'naive-ui'
import { ArrowUpOutline, ArrowDownOutline, TimerOutline, ChevronUpOutline } from '@vicons/ionicons5'
import {
  formatLimitBadge,
  parseSpeedLimitValue,
  buildSpeedLimitString,
  toggleSpeedLimit,
  applyCustomLimit,
} from '@/composables/useSpeedLimiter'
import { useAppMessage } from '@/composables/useAppMessage'
import { logger } from '@shared/logger'

import { NPagination } from 'naive-ui'
import { useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/task'
const route = useRoute()
const tasks = useTaskStore()
const { t } = useI18n()
const appStore = useAppStore()
const preferenceStore = usePreferenceStore()
const message = useAppMessage()

const stat = computed(() => appStore.stat)
const isLimited = computed(() => !!preferenceStore.config.speedLimitEnabled)
const isScheduleActive = computed(() => !!preferenceStore.config.speedScheduleEnabled)
/** Clock badge only when schedule is actually effective (both switches ON). */
const downloadSpeed = computed(() => bytesToSize(String(stat.value.downloadSpeed)))
const uploadSpeed = computed(() => bytesToSize(String(stat.value.uploadSpeed)))

// ── Limit badge display ─────────────────────────────────────────────

const dlLimitBadge = computed(() => formatLimitBadge(preferenceStore.config.maxOverallDownloadLimit))
const ulLimitBadge = computed(() => formatLimitBadge(preferenceStore.config.maxOverallUploadLimit))

// ── Popover state ───────────────────────────────────────────────────

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

// ── Dependency injection for composable calls ───────────────────────

function makeDeps() {
  return {
    changeGlobalOption,
    updateAndSave: (partial: Partial<typeof preferenceStore.config>) => preferenceStore.updateAndSave(partial),
  }
}

// Apply the explicit switch inside the limits panel.

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

// ── Apply custom limit from popover ─────────────────────────────────

async function handleApply() {
  if (!isEngineReady() || applying.value) return

  // Reject 0/0 — at least one direction must have a non-zero limit
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

// ── Schedule toggle from popover ───────────────────────────────────────
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
    <div class="transfer-status">
      <span
        ><NIcon><ArrowDownOutline /></NIcon>{{ downloadSpeed }}/s</span
      ><span class="upload-status"
        ><NIcon><ArrowUpOutline /></NIcon>{{ uploadSpeed }}/s</span
      >
    </div>
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
      <template #trigger
        ><button class="limit-trigger" :aria-label="t('app.speedometer-set-limit')" :aria-expanded="showPopover">
          <span class="limit-label">{{ t('app.speedometer-set-limit') }}</span
          ><span v-if="isLimited" class="limit-badge"> · {{ dlLimitBadge }} / {{ ulLimitBadge }}</span
          ><NIcon class="limit-chevron" :class="{ expanded: showPopover }" :size="14" aria-hidden="true"
            ><ChevronUpOutline
          /></NIcon></button
      ></template>
      <!-- Speed limit configuration panel -->
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
            <NIcon :size="12"><ArrowDownOutline /></NIcon>
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
              size="small"
              style="width: 100px"
            />
            <NSelect
              v-model:value="popoverDlUnit"
              :disabled="applying"
              :options="speedUnitOptions"
              size="small"
              style="width: 88px"
            />
          </div>
        </div>

        <div class="limit-panel-row">
          <div class="limit-panel-label">
            <NIcon :size="12"><ArrowUpOutline /></NIcon>
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
              size="small"
              style="width: 100px"
            />
            <NSelect
              v-model:value="popoverUlUnit"
              :disabled="applying"
              :options="speedUnitOptions"
              size="small"
              style="width: 88px"
            />
          </div>
        </div>

        <NDivider style="margin: 12px 0 8px" />
        <div class="limit-panel-row">
          <div class="limit-panel-label">
            <NIcon :size="12"><TimerOutline /></NIcon>
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

        <NText
          v-if="isScheduleActive && !isLimited"
          depth="3"
          type="warning"
          style="font-size: 11px; margin-top: 4px; display: block"
        >
          {{ t('preferences.schedule-needs-limit') }}
        </NText>

        <NButton
          type="primary"
          :loading="applying"
          :disabled="applying"
          block
          style="margin-top: 12px"
          @click="handleApply"
        >
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
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-inline: 24px;
  border-top: 1px solid var(--divider);
  font-size: 12px;
  color: var(--m3-on-surface-variant);
}
.transfer-status,
.transfer-status span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.transfer-status {
  gap: 16px;
}
.limit-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  padding: 6px 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  text-align: end;
  white-space: nowrap;
  border-radius: 4px;
}
.limit-trigger:hover {
  color: var(--m3-primary);
}
.limit-chevron {
  flex-shrink: 0;
  transition: transform 160ms ease;
}
.limit-chevron.expanded {
  transform: rotate(180deg);
}
.limit-panel {
  width: min(340px, calc(100vw - 56px));
  max-height: calc(100dvh - 96px);
  overflow: auto;
}
.limit-panel-title {
  font-weight: 600;
  margin-block: 12px;
}
.limit-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-block: 12px;
}
.limit-panel-label {
  display: flex;
  gap: 6px;
  align-items: center;
}
.limit-panel-inputs {
  display: flex;
  gap: 6px;
}
@media (max-width: 719px) {
  .status-bar {
    margin-inline: 16px;
    gap: 8px;
  }
  .upload-status {
    display: none !important;
  }
}
@media (max-width: 479px) {
  .limit-badge {
    display: none;
  }
  .limit-trigger {
    min-width: 32px;
    justify-content: center;
  }
}
.limit-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
</style>
