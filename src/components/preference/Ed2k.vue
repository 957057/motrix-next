<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'
import { useRoute } from 'vue-router'
/** @fileoverview ED2K preference tab: search, engine options, and server discovery. */
import { ref, computed, onMounted, h } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import { useDialog } from 'naive-ui'
import {
  NButton,
  NCollapseTransition,
  NDataTable,
  NForm,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NSelect,
  NSwitch,
  NText,
} from 'naive-ui'
import { Dices, Download, RefreshCw, Search } from '@lucide/vue'
import { usePreferenceStore } from '@/stores/preference'
import { useTaskStore } from '@/stores/task'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import { useAppMessage } from '@/composables/useAppMessage'
import { useEngineRestart } from '@/composables/useEngineRestart'
import {
  buildEd2kForm,
  buildEd2kSystemConfig,
  randomEd2kPort,
  transformEd2kForStore,
  validateEd2kForm,
} from '@/composables/useEd2kPreference'
import { useEd2kSearchSession } from '@/composables/useEd2kSearchSession'
import { PROXY_SCOPES } from '@shared/constants'
import { diffConfig, checkIsNeedRestart } from '@shared/utils/config'
import { bytesToSize } from '@shared/utils'
import { resolveAppProxyUrl } from '@shared/utils/proxy'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { logger } from '@shared/logger'
import type { Ed2kSearchResult } from '@shared/types'
import PreferenceActionBar from './PreferenceActionBar.vue'
import PreferenceHintLabel from './PreferenceHintLabel.vue'

const { t } = useI18n()
const settingsRoute = useRoute()
const preferenceStore = usePreferenceStore()
const taskStore = useTaskStore()
const dialog = useDialog()
const message = useAppMessage()
const { constraint, configFieldProps, areConfigFieldsValid } = usePreferenceNumericValidation()
const { restartEngine } = useEngineRestart()

const needsRestart = ref(false)
const bootstrapSyncing = ref(false)
const bootstrapStatus = ref<Ed2kBootstrapStatus>({
  serverMetSize: null,
  nodesDatSize: null,
  serverMetModified: null,
  nodesDatModified: null,
})

interface Ed2kBootstrapStatus {
  serverMetSize: number | null
  nodesDatSize: number | null
  serverMetModified: number | null
  nodesDatModified: number | null
}

interface Ed2kBootstrapSyncResult {
  status: Ed2kBootstrapStatus
}

const {
  searchKeyword,
  searchFileType,
  searchMinSources,
  searchState,
  searchResults,
  searchElapsedMs,
  searchActive,
  runSearch,
} = useEd2kSearchSession({ t, message })
const searchButtonText = computed(() =>
  searchActive.value ? t('preferences.ed2k-search-cancel') : t('preferences.ed2k-search-submit'),
)
const searchMaxDurationMs = computed(() => Math.max(1, Number(form.value.ed2kSearchTimeout || 20)) * 1000)
const searchElapsedSeconds = computed(() => Math.floor(searchElapsedMs.value / 1000))
const searchStatusText = computed(() =>
  searchActive.value
    ? t('preferences.ed2k-search-progress', {
        elapsed: searchElapsedSeconds.value,
        total: Math.floor(searchMaxDurationMs.value / 1000),
        count: searchResults.value.length,
      })
    : t('preferences.ed2k-search-ready', { total: Math.floor(searchMaxDurationMs.value / 1000) }),
)
const bootstrapLastSyncText = computed(() => {
  const latest = Math.max(bootstrapStatus.value.serverMetModified ?? 0, bootstrapStatus.value.nodesDatModified ?? 0)
  return latest > 0 ? new Date(latest).toLocaleString() : '-'
})
const syncIntervalOptions = computed(() => [
  { label: t('preferences.interval-every-startup'), value: 0 },
  { label: t('preferences.interval-6-hours'), value: 6 },
  { label: t('preferences.interval-12-hours'), value: 12 },
  { label: t('preferences.interval-daily'), value: 24 },
  { label: t('preferences.interval-weekly'), value: 168 },
])

const fileTypeOptions = computed(() => [
  { label: t('preferences.ed2k-search-type-any'), value: '' },
  { label: t('preferences.ed2k-search-type-audio'), value: 'audio' },
  { label: t('preferences.ed2k-search-type-video'), value: 'video' },
  { label: t('preferences.ed2k-search-type-document'), value: 'doc' },
  { label: t('preferences.ed2k-search-type-archive'), value: 'archive' },
])

function buildForm() {
  return buildEd2kForm(preferenceStore.config)
}

const { form, isDirty, handleSave, handleReset, resetSnapshot } = usePreferenceForm({
  buildForm,
  buildSystemConfig: buildEd2kSystemConfig,
  transformForStore: transformEd2kForStore,
  beforeSave: async (f) => {
    const validationKey = validateEd2kForm(f)
    if (validationKey) {
      message.error(t(validationKey))
      return false
    }

    const changed = diffConfig(preferenceStore.config, transformEd2kForStore(f))
    if (checkIsNeedRestart(changed)) {
      const ok = await new Promise<boolean>((resolve) => {
        let accepted = false
        dialog.info({
          title: t('preferences.engine-restart-title'),
          content: t('preferences.engine-restart-confirm'),
          positiveText: t('preferences.engine-restart-now'),
          negativeText: t('app.cancel'),
          maskClosable: false,
          onPositiveClick: () => {
            accepted = true
          },
          onNegativeClick: () => resolve(false),
          onClose: () => resolve(false),
          onAfterLeave: () => {
            if (accepted) resolve(true)
          },
        })
      })
      if (!ok) return false
      needsRestart.value = true
    }
    return true
  },
  afterSave: async (f, prevConfig) => {
    if (needsRestart.value) {
      needsRestart.value = false
      restartEngine('settingsChange')
    }

    if (
      preferenceStore.config.enableUpnp &&
      (f.ed2kListenPort !== prevConfig.ed2kListenPort || f.ed2kUdpListenPort !== prevConfig.ed2kUdpListenPort)
    ) {
      await syncUpnpState(f.ed2kListenPort, f.ed2kUdpListenPort)
    }
  },
})
const numericFieldsValid = computed(() =>
  areConfigFieldsValid({
    ed2kSearchTimeout: form.value.ed2kSearchTimeout,
    ed2kListenPort: form.value.ed2kListenPort,
    ed2kUdpListenPort: form.value.ed2kUdpListenPort,
    ed2kUploadSlots: form.value.ed2kUploadSlots,
    ed2kMaxConnections: form.value.ed2kMaxConnections,
  }),
)

function onPortDice() {
  form.value.ed2kListenPort = randomEd2kPort()
}

function onUdpPortDice() {
  form.value.ed2kUdpListenPort = randomEd2kPort()
}

async function syncUpnpState(ed2kPort: number, ed2kUdpPort: number) {
  try {
    await invoke('start_upnp_mapping', {
      ed2kPort: ed2kPort > 0 ? ed2kPort : null,
      ed2kUdpPort: ed2kUdpPort > 0 ? ed2kUdpPort : null,
    })
  } catch (e) {
    logger.warn('UPnP', `ED2K sync failed: ${getErrorMessage(e)}`)
    message.warning(t('preferences.upnp-mapping-failed'))
  }
}

async function handleSearch() {
  await runSearch(searchMaxDurationMs.value)
}

async function handleDownload(row: Ed2kSearchResult) {
  if (!row.ed2kLink) return
  try {
    await taskStore.addUri({
      uris: [row.ed2kLink],
      outs: [],
      options: { dir: preferenceStore.config.dir },
      fileCategory: {
        enabled: preferenceStore.config.fileCategoryEnabled,
        categories: preferenceStore.config.fileCategories,
      },
    })
    message.success(t('preferences.ed2k-download-started'))
  } catch (e) {
    logger.debug('ED2K.download', e)
    message.error(t('preferences.ed2k-search-failed'))
  }
}

async function refreshBootstrapStatus() {
  try {
    bootstrapStatus.value = await invoke<Ed2kBootstrapStatus>('get_ed2k_bootstrap_status')
  } catch (e) {
    logger.debug('ED2K.bootstrapStatus', e)
  }
}

async function handleSyncBootstrapFiles() {
  const validationKey = validateEd2kForm(form.value)
  if (validationKey) {
    message.error(t(validationKey))
    return
  }
  bootstrapSyncing.value = true
  try {
    const proxyUrl = resolveAppProxyUrl(preferenceStore.config.proxy, PROXY_SCOPES.UPDATE_TRACKERS) ?? undefined
    const result = await invoke<Ed2kBootstrapSyncResult>('sync_ed2k_bootstrap_files', {
      serverMetUrl: form.value.ed2kServerMetUrl,
      nodesDatUrl: form.value.ed2kNodesDatUrl,
      proxy: proxyUrl,
    })
    bootstrapStatus.value = result.status
    message.success(t('preferences.ed2k-bootstrap-sync-succeed'))
  } catch (e) {
    logger.debug('ED2K.bootstrapSync', e)
    message.error(t('preferences.ed2k-bootstrap-sync-failed'))
  } finally {
    bootstrapSyncing.value = false
  }
}

const resultColumns = computed(() => [
  { title: t('task.file-name'), key: 'name', ellipsis: { tooltip: true } },
  {
    title: t('task.file-size'),
    key: 'length',
    width: 110,
    align: 'right' as const,
    render: (row: Ed2kSearchResult) => bytesToSize(String(row.length ?? 0)),
  },
  {
    title: t('preferences.ed2k-search-sources'),
    key: 'sourceCount',
    width: 92,
    align: 'right' as const,
  },
  {
    title: t('preferences.ed2k-search-complete-sources'),
    key: 'completeSourceCount',
    width: 112,
    align: 'right' as const,
  },
  {
    title: '',
    key: 'actions',
    width: 58,
    align: 'center' as const,
    render: (row: Ed2kSearchResult) => {
      return row.ed2kLink
        ? h(
            NButton,
            { size: 'tiny', quaternary: true, onClick: () => handleDownload(row) },
            {
              icon: () => h(NIcon, null, { default: () => h(Download) }),
            },
          )
        : null
    },
  },
])

onMounted(() => {
  Object.assign(form.value, buildForm())
  resetSnapshot()
  void refreshBootstrapStatus()
})
</script>

<template>
  <div class="preference-form-wrapper">
    <div class="preference-form-scroll">
      <NForm
        label-placement="left"
        label-align="left"
        class="form-preference"
        :disabled="preferenceStore.savingChanges"
      >
        <h2 class="settings-section-title">{{ t('preferences.ed2k-search') }}</h2>
        <SettingsRow setting-key="preferences.ed2k-search-keyword" :label="t('preferences.ed2k-search-keyword')">
          <NInput
            v-model:value="searchKeyword"
            :input-props="{ 'aria-label': t('preferences.ed2k-search-keyword') }"
            :disabled="searchActive"
            @keyup.enter="handleSearch"
          />
        </SettingsRow>
        <SettingsRow :label="t('preferences.ed2k-search')" :hint="searchStatusText" actions>
          <NButton
            class="ed2k-search-button"
            type="primary"
            :disabled="searchState === 'cancelling'"
            @click="handleSearch"
          >
            <template #icon>
              <NIcon><Search /></NIcon>
            </template>

            <span :key="searchButtonText">{{ searchButtonText }}</span>
          </NButton>
        </SettingsRow>
        <SettingsRow setting-key="preferences.ed2k-search-type" :label="t('preferences.ed2k-search-type')">
          <NSelect
            v-model:value="searchFileType"
            :aria-label="t('preferences.ed2k-search-type')"
            :options="fileTypeOptions"
            class="pref-control-auto"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ed2k-search-min-sources"
          :label="t('preferences.ed2k-search-min-sources')"
        >
          <NInputNumber
            v-model:value="searchMinSources"
            :input-props="{ 'aria-label': t('preferences.ed2k-search-min-sources') }"
            :min="1"
            :max="9999"
            class="pref-port"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ed2k-search-timeout"
          :label="t('preferences.ed2k-search-timeout')"
          v-bind="configFieldProps('ed2kSearchTimeout', form.ed2kSearchTimeout)"
        >
          <NInputNumber
            v-model:value="form.ed2kSearchTimeout"
            :input-props="{ 'aria-label': t('preferences.ed2k-search-timeout') }"
            :min="constraint('ed2kSearchTimeout').min"
            :max="constraint('ed2kSearchTimeout').max"
            class="pref-port"
          />
          <NText depth="3" class="pref-inline-note">{{ t('preferences.unit-seconds') }}</NText>
        </SettingsRow>
        <SettingsRow :show-label="false">
          <NDataTable
            class="search-results"
            size="small"
            :columns="resultColumns"
            :data="searchResults"
            :bordered="false"
            :pagination="{ pageSize: 8 }"
          />
        </SettingsRow>

        <h2 class="settings-section-title">{{ t('preferences.ed2k-settings') }}</h2>
        <SettingsRow
          setting-key="preferences.ed2k-listen-port"
          :label="t('preferences.ed2k-listen-port')"
          v-bind="configFieldProps('ed2kListenPort', form.ed2kListenPort)"
        >
          <NInputGroup>
            <NInputNumber
              v-model:value="form.ed2kListenPort"
              :input-props="{ 'aria-label': t('preferences.ed2k-listen-port') }"
              :min="constraint('ed2kListenPort').min"
              :max="constraint('ed2kListenPort').max"
              class="pref-port"
            />
            <NButton secondary class="pref-action-button pref-action-button--compact" @click="onPortDice">
              <template #icon>
                <NIcon><Dices /></NIcon>
              </template>
              {{ t('preferences.random-port') }}
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ed2k-udp-listen-port"
          :label="t('preferences.ed2k-udp-listen-port')"
          v-bind="configFieldProps('ed2kUdpListenPort', form.ed2kUdpListenPort)"
        >
          <NInputGroup>
            <NInputNumber
              v-model:value="form.ed2kUdpListenPort"
              :input-props="{ 'aria-label': t('preferences.ed2k-udp-listen-port') }"
              :min="constraint('ed2kUdpListenPort').min"
              :max="constraint('ed2kUdpListenPort').max"
              class="pref-port"
            />
            <NButton secondary class="pref-action-button pref-action-button--compact" @click="onUdpPortDice">
              <template #icon>
                <NIcon><Dices /></NIcon>
              </template>
              {{ t('preferences.random-port') }}
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ed2k-upload-slots"
          :label="t('preferences.ed2k-upload-slots')"
          v-bind="configFieldProps('ed2kUploadSlots', form.ed2kUploadSlots)"
        >
          <NInputNumber
            v-model:value="form.ed2kUploadSlots"
            :input-props="{ 'aria-label': t('preferences.ed2k-upload-slots') }"
            :min="constraint('ed2kUploadSlots').min"
            :max="constraint('ed2kUploadSlots').max"
            class="pref-port"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ed2k-max-connections"
          :label="t('preferences.ed2k-max-connections')"
          v-bind="configFieldProps('ed2kMaxConnections', form.ed2kMaxConnections)"
        >
          <NInputNumber
            v-model:value="form.ed2kMaxConnections"
            :input-props="{ 'aria-label': t('preferences.ed2k-max-connections') }"
            :min="constraint('ed2kMaxConnections').min"
            :max="constraint('ed2kMaxConnections').max"
            class="pref-port"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.ed2k-preview-priority" :label="t('preferences.ed2k-preview-priority')">
          <NSwitch v-model:value="form.ed2kPreviewPriority" :aria-label="t('preferences.ed2k-preview-priority')" />
        </SettingsRow>

        <h2 class="settings-section-title">{{ t('preferences.ed2k-bootstrap') }}</h2>
        <SettingsRow setting-key="preferences.ed2k-server-met-url">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.ed2k-server-met-url')"
              :hint="t('preferences.ed2k-server-met-hint')"
            />
          </template>
          <NInput
            v-model:value="form.ed2kServerMetUrl"
            :input-props="{ 'aria-label': t('preferences.ed2k-server-met-url') }"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.ed2k-nodes-dat-url">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.ed2k-nodes-dat-url')"
              :hint="t('preferences.ed2k-nodes-dat-hint')"
            />
          </template>
          <NInput
            v-model:value="form.ed2kNodesDatUrl"
            :input-props="{ 'aria-label': t('preferences.ed2k-nodes-dat-url') }"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.ed2k-server" :label="t('preferences.ed2k-server')">
          <NInput
            v-model:value="form.ed2kServer"
            :input-props="{ 'aria-label': t('preferences.ed2k-server') }"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 5 }"
            :placeholder="t('preferences.ed2k-server-placeholder')"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.auto-sync" :label="t('preferences.auto-sync')">
          <NSwitch v-model:value="form.ed2kBootstrapAutoSync" :aria-label="t('preferences.auto-sync')" />
        </SettingsRow>
        <NCollapseTransition :show="form.ed2kBootstrapAutoSync || !!settingsRoute.hash" class="collapse-indent">
          <SettingsRow setting-key="preferences.sync-frequency" :label="t('preferences.sync-frequency')">
            <NSelect
              v-model:value="form.ed2kBootstrapSyncIntervalHours"
              :aria-label="t('preferences.sync-frequency')"
              :options="syncIntervalOptions"
              class="pref-control-auto"
            />
          </SettingsRow>
        </NCollapseTransition>
        <SettingsRow
          :label="t('preferences.ed2k-bootstrap')"
          :hint="`${t('preferences.last-sync-time')} ${bootstrapLastSyncText}`"
          actions
        >
          <NButton
            class="pref-action-button ed2k-bootstrap-sync-button"
            :loading="bootstrapSyncing"
            @click="handleSyncBootstrapFiles"
          >
            <template #icon>
              <NIcon><RefreshCw /></NIcon>
            </template>
            {{ t('preferences.ed2k-bootstrap-sync') }}
          </NButton>
        </SettingsRow>
      </NForm>
    </div>
    <PreferenceActionBar
      :is-saving="preferenceStore.savingChanges"
      :is-dirty="isDirty"
      :is-valid="numericFieldsValid"
      @save="handleSave"
      @discard="handleReset"
    />
  </div>
</template>

<style scoped>
.search-results {
  width: 100%;
  min-width: 0;
}
.ed2k-bootstrap-sync-button {
  min-width: 100px;
}
.ed2k-search-button {
  min-width: 104px;
  overflow: hidden;
}
</style>
