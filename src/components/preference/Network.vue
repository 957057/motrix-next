<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsRow from './SettingsRow.vue'
/** @fileoverview Network preference tab: proxy, ports, user-agent, timeouts, file allocation. */
import { ref, computed, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import { useAppColorTokens } from '@/composables/useColorScheme'
import { usePlatform } from '@/composables/usePlatform'
import { useSystemProxyDetect } from '@/composables/useSystemProxyDetect'
import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { useAppMessage } from '@/composables/useAppMessage'
import { PROXY_SCOPE_OPTIONS, FILE_ALLOCATION_OPTIONS } from '@shared/constants'
import {
  buildNetworkForm,
  buildNetworkSystemConfig,
  transformNetworkForStore,
  validateNetworkForm,
} from '@/composables/useNetworkPreference'
import { proxySwitchValueToMode } from '@shared/utils/proxy'

import userAgentMap from '@shared/ua'
import { hasUnsafeHeaderChars, sanitizeHeaderValue } from '@shared/utils/headerSanitize'
import {
  NForm,
  NConfigProvider,
  NCollapseTransition,
  NInput,
  NInputNumber,
  NInputGroup,
  NSwitch,
  NSelect,
  NButton,
  NButtonGroup,
  NIcon,
  NText,
} from 'naive-ui'
const showUserAgentManager = ref(false)
import PreferenceActionBar from './PreferenceActionBar.vue'
import PreferenceCheckboxGrid from './PreferenceCheckboxGrid.vue'
import PreferenceHintLabel from './PreferenceHintLabel.vue'
import UserAgentManager from './UserAgentManager.vue'
import { SearchOutline } from '@vicons/ionicons5'

const settingsRoute = useRoute()
const { t } = useI18n()
const preferenceStore = usePreferenceStore()
const message = useAppMessage()
const { constraint, configFieldProps, fieldProps, areConfigFieldsValid, portRecoveryConstraint } =
  usePreferenceNumericValidation()
const { isWindows } = usePlatform()

const proxyScopeOptions = computed(() =>
  PROXY_SCOPE_OPTIONS.map((value: string) => ({
    label: t(`preferences.proxy-scope-${value}`),
    value,
  })),
)
const colorTokens = useAppColorTokens()
const proxyScopeTheme = computed(() => {
  const tokens = colorTokens.value
  return {
    Tag: {
      border: 'none',
      borderRadius: '4px',
      color: tokens.surfaceContainer,
      colorBordered: tokens.surfaceContainer,
      textColor: tokens.onSurface,
    },
    Select: {
      peers: {
        InternalSelection: {
          paddingMultiple: '6px 28px 6px 8px',
          color: tokens.surfaceContainerLow,
          colorActive: tokens.surfaceContainerLow,
          boxShadowHover: 'none',
          boxShadowActive: 'none',
          boxShadowFocus: 'none',
          borderFocus: `2px solid ${tokens.primary.color}`,
        },
        InternalSelectMenu: {
          color: tokens.surfaceContainerLow,
          optionColorActive: 'transparent',
          optionColorPending: tokens.surfaceContainer,
          optionColorActivePending: tokens.surfaceContainer,
          optionHeightMedium: '36px',
          paddingMedium: '6px',
        },
      },
    },
  }
})
const fileAllocationOptions = computed(() =>
  FILE_ALLOCATION_OPTIONS.filter((value) => !(isWindows.value && value === 'falloc')).map((value) => ({
    label: value,
    value,
  })),
)

type PortRecoveryTarget = 'rpc' | 'extensionApi' | 'bt' | 'ed2k' | 'ed2kUdp'
const portRecoveryTargets: PortRecoveryTarget[] = ['rpc', 'extensionApi', 'bt', 'ed2k', 'ed2kUdp']
const portRecoveryTargetOptions = computed(() => [
  { label: t('preferences.rpc-listen-port'), value: 'rpc' },
  { label: t('preferences.extension-api-port'), value: 'extensionApi' },
  { label: t('preferences.port-conflict-recovery-bt'), value: 'bt' },
  { label: t('preferences.port-conflict-recovery-ed2k'), value: 'ed2k' },
  { label: t('preferences.port-conflict-recovery-ed2k-udp'), value: 'ed2kUdp' },
])
const selectedPortRecoveryTargets = computed<string[]>({
  get: () => portRecoveryTargets.filter((target) => form.value.portConflictRecovery[target]),
  set: (targets) => {
    const selected = new Set(targets)
    for (const target of portRecoveryTargets) {
      form.value.portConflictRecovery[target] = selected.has(target)
    }
  },
})

// ── Proxy detection ─────────────────────────────────────────────────
const { detecting: detectingProxy, detect: detectProxy } = useSystemProxyDetect({
  onSuccess(info) {
    form.value.proxy.server = info.server
    if (info.bypass) form.value.proxy.bypass = info.bypass
    form.value.proxy.mode = 'manual'
    message.success(t('preferences.proxy-detected-success'))
  },
  onSocks() {
    message.warning(t('preferences.proxy-system-socks-rejected'))
  },
  onNotFound() {
    message.info(t('preferences.proxy-system-not-detected'))
  },
  onError() {
    message.error(t('preferences.proxy-system-detect-failed'))
  },
})

function buildForm() {
  return buildNetworkForm(preferenceStore.config)
}

const { form, isDirty, handleSave, handleReset, resetSnapshot, patchSnapshot } = usePreferenceForm({
  buildForm,
  buildSystemConfig: buildNetworkSystemConfig,
  transformForStore: transformNetworkForStore,
  beforeSave: (f) => {
    const validationKey = validateNetworkForm(f)
    if (validationKey) {
      message.error(t(validationKey))
      return false
    }
    return true
  },
  afterSave: async (f, prevConfig) => {
    if (f.enableUpnp !== prevConfig.enableUpnp) await syncUpnpState(!!f.enableUpnp)
  },
})
const numericFieldsValid = computed(
  () =>
    areConfigFieldsValid({
      connectTimeout: form.value.connectTimeout,
      timeout: form.value.timeout,
    }) &&
    !fieldProps(form.value.portConflictRecovery.rangeStart, portRecoveryConstraint).validationStatus &&
    !fieldProps(form.value.portConflictRecovery.rangeEnd, portRecoveryConstraint).validationStatus &&
    form.value.portConflictRecovery.rangeStart <= form.value.portConflictRecovery.rangeEnd,
)
const portRecoveryFieldProps = computed(() => {
  const recovery = form.value.portConflictRecovery
  if (recovery.rangeStart > recovery.rangeEnd) {
    return {
      validationStatus: 'error' as const,
      feedback: t('preferences.port-conflict-recovery-invalid-range'),
    }
  }
  const start = fieldProps(recovery.rangeStart, portRecoveryConstraint)
  return start.validationStatus ? start : fieldProps(recovery.rangeEnd, portRecoveryConstraint)
})

// ── UPnP save-time sync ─────────────────────────────────────────────
async function syncUpnpState(enabled: boolean) {
  const config = preferenceStore.config
  try {
    if (enabled) {
      await invoke('start_upnp_mapping', {
        ed2kPort: Number(config.ed2kListenPort) > 0 ? Number(config.ed2kListenPort) : null,
        ed2kUdpPort: Number(config.ed2kUdpListenPort) > 0 ? Number(config.ed2kUdpListenPort) : null,
      })
    } else {
      await invoke('stop_upnp_mapping')
    }
  } catch (e) {
    logger.warn('UPnP', `sync failed: ${getErrorMessage(e)}`)
    message.warning(t('preferences.upnp-mapping-failed'))
  }
}

// ── User-Agent presets ──────────────────────────────────────────────
function changeUA(type: string) {
  const ua = userAgentMap[type]
  if (ua) form.value.userAgent = ua
}

const uaHasIssue = computed(() => !!form.value.userAgent && hasUnsafeHeaderChars(form.value.userAgent as string))

function cleanUserAgent() {
  form.value.userAgent = sanitizeHeaderValue(form.value.userAgent as string)
}

async function handleUserAgentManagerSave(payload: {
  profiles: typeof form.value.userAgentProfiles
  rules: typeof form.value.userAgentRules
  recentProfileIds: typeof form.value.recentUserAgentProfileIds
}) {
  form.value.userAgentProfiles = payload.profiles
  form.value.userAgentRules = payload.rules
  form.value.recentUserAgentProfileIds = payload.recentProfileIds
  const saved = await preferenceStore.updateAndSave({
    userAgentProfiles: payload.profiles,
    userAgentRules: payload.rules,
    recentUserAgentProfileIds: payload.recentProfileIds,
  })
  if (!saved) {
    message.error(t('preferences.save-fail-message'))
    return
  }
  patchSnapshot({
    userAgentProfiles: payload.profiles,
    userAgentRules: payload.rules,
    recentUserAgentProfileIds: payload.recentProfileIds,
  } as Partial<typeof form.value>)
}

function handleProxySwitch(value: boolean) {
  form.value.proxy.mode = proxySwitchValueToMode(value)
}

onMounted(() => {
  Object.assign(form.value, buildForm())
  resetSnapshot()
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
        <!-- Proxy -->
        <h2 class="settings-section-title">{{ t('preferences.proxy') }}</h2>
        <SettingsRow setting-key="task.use-proxy">
          <template #label>
            <PreferenceHintLabel :label="t('task.use-proxy')" :hint="t('preferences.proxy-request-scope-hint')" />
          </template>
          <NSwitch
            :aria-label="t('task.use-proxy')"
            :value="form.proxy.mode !== 'direct'"
            @update:value="handleProxySwitch"
          />
        </SettingsRow>
        <NCollapseTransition :show="form.proxy.mode === 'manual' || !!settingsRoute.hash">
          <div class="proxy-collapse__inner collapse-indent">
            <SettingsRow setting-key="preferences.proxy-server">
              <template #label>
                <PreferenceHintLabel
                  :label="t('preferences.proxy-server')"
                  :hint="t('preferences.proxy-protocol-hint')"
                />
              </template>
              <NInputGroup>
                <NInput
                  v-model:value="form.proxy.server"
                  :input-props="{ 'aria-label': t('preferences.proxy-server') }"
                  class="pref-control-full"
                  placeholder="http://host:port"
                />
                <NButton
                  class="pref-action-button network-proxy-detect-button"
                  :loading="detectingProxy"
                  @click="detectProxy"
                >
                  <template #icon>
                    <NIcon><SearchOutline /></NIcon>
                  </template>
                  {{ t('preferences.detect-system-proxy') }}
                </NButton>
              </NInputGroup>
            </SettingsRow>
            <SettingsRow setting-key="preferences.proxy-username" :label="t('preferences.proxy-username')">
              <NInput
                v-model:value="form.proxy.username"
                :input-props="{ 'aria-label': t('preferences.proxy-username') }"
              />
            </SettingsRow>
            <SettingsRow setting-key="preferences.proxy-password" :label="t('preferences.proxy-password')">
              <NInput
                v-model:value="form.proxy.password"
                :input-props="{ 'aria-label': t('preferences.proxy-password') }"
                type="password"
                show-password-on="click"
              />
            </SettingsRow>
            <SettingsRow setting-key="preferences.proxy-bypass" :label="t('preferences.proxy-bypass')">
              <NInput
                v-model:value="form.proxy.bypass"
                :input-props="{ 'aria-label': t('preferences.proxy-bypass') }"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 3 }"
                :placeholder="t('preferences.proxy-bypass-input-tips')"
              />
            </SettingsRow>
            <SettingsRow setting-key="preferences.proxy-scope" :label="t('preferences.proxy-scope')">
              <NConfigProvider :theme-overrides="proxyScopeTheme" class="pref-control-full">
                <NSelect
                  v-model:value="form.proxy.scope"
                  :aria-label="t('preferences.proxy-scope')"
                  :options="proxyScopeOptions"
                  multiple
                  class="proxy-scope-select"
                />
              </NConfigProvider>
            </SettingsRow>
          </div>
        </NCollapseTransition>

        <!-- Port conflict recovery -->
        <h2 class="settings-section-title">{{ t('preferences.port-conflict-recovery') }}</h2>
        <SettingsRow
          setting-key="preferences.port-conflict-recovery-enable"
          :label="t('preferences.port-conflict-recovery-enable')"
        >
          <NSwitch
            v-model:value="form.portConflictRecovery.enabled"
            :aria-label="t('preferences.port-conflict-recovery-enable')"
          />
        </SettingsRow>
        <NCollapseTransition :show="form.portConflictRecovery.enabled || !!settingsRoute.hash">
          <div class="port-recovery-collapse__inner collapse-indent">
            <SettingsRow v-bind="portRecoveryFieldProps" setting-key="preferences.port-conflict-recovery-range">
              <template #label>
                <PreferenceHintLabel
                  :label="t('preferences.port-conflict-recovery-range')"
                  :hint="t('preferences.port-conflict-recovery-range-hint')"
                />
              </template>
              <NInputGroup>
                <NInputNumber
                  v-model:value="form.portConflictRecovery.rangeStart"
                  :input-props="{ 'aria-label': t('preferences.port-conflict-recovery-range') }"
                  :min="portRecoveryConstraint.min"
                  :max="portRecoveryConstraint.max"
                  class="pref-port"
                />
                <span class="port-range-separator">to</span>
                <NInputNumber
                  v-model:value="form.portConflictRecovery.rangeEnd"
                  :input-props="{ 'aria-label': t('preferences.port-conflict-recovery-range') }"
                  :min="portRecoveryConstraint.min"
                  :max="portRecoveryConstraint.max"
                  class="pref-port"
                />
              </NInputGroup>
            </SettingsRow>
            <SettingsRow
              setting-key="preferences.port-conflict-recovery-apply-to"
              :label="t('preferences.port-conflict-recovery-apply-to')"
            >
              <PreferenceCheckboxGrid
                v-model:value="selectedPortRecoveryTargets"
                :options="portRecoveryTargetOptions"
              />
            </SettingsRow>
          </div>
        </NCollapseTransition>

        <!-- User-Agent -->
        <h2 class="settings-section-title">{{ t('preferences.user-agent') }}</h2>
        <SettingsRow setting-key="preferences.mock-user-agent" :label="t('preferences.mock-user-agent')">
          <div class="ua-field-wrapper">
            <NInput
              v-model:value="form.userAgent"
              :input-props="{ 'aria-label': t('preferences.mock-user-agent') }"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="User-Agent"
            />
            <NCollapseTransition :show="uaHasIssue">
              <div class="ua-warn-collapse__inner">
                <div class="ua-warn-bar">
                  <span class="ua-warn-text">⚠ {{ t('preferences.ua-unsafe-chars-detected') }}</span>
                  <NButton size="tiny" type="primary" ghost @click="cleanUserAgent">
                    {{ t('preferences.ua-sanitize') }}
                  </NButton>
                </div>
              </div>
            </NCollapseTransition>
          </div>
        </SettingsRow>
        <SettingsRow continuation actions>
          <div class="ua-preset-row">
            <NButtonGroup size="small">
              <NButton @click="changeUA('chrome')">Chrome</NButton>
              <NButton @click="changeUA('edge')">Edge</NButton>
              <NButton @click="changeUA('safari')">Safari</NButton>
              <NButton @click="changeUA('firefox')">Firefox</NButton>
            </NButtonGroup>
            <NButton type="error" size="small" ghost @click="form.userAgent = ''">
              {{ t('preferences.ua-reset') }}
            </NButton>
          </div>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.ua-saved"
          :label="t('preferences.ua-manager-title')"
          :hint="
            t('preferences.ua-manager-summary', {
              profiles: form.userAgentProfiles.length,
              rules: form.userAgentRules.length,
            })
          "
          actions
        >
          <NButton @click="showUserAgentManager = true">{{ t('preferences.ua-manage') }}</NButton>
        </SettingsRow>

        <!-- Port mapping -->
        <h2 class="settings-section-title">{{ t('preferences.port') }}</h2>
        <SettingsRow label="UPnP/NAT-PMP">
          <NSwitch v-model:value="form.enableUpnp" />
        </SettingsRow>

        <!-- Timeout & Disk -->
        <h2 class="settings-section-title">{{ t('preferences.transfer-params') }}</h2>
        <SettingsRow
          setting-key="preferences.connect-timeout"
          :label="t('preferences.connect-timeout')"
          v-bind="configFieldProps('connectTimeout', form.connectTimeout)"
        >
          <NInputNumber
            v-model:value="form.connectTimeout"
            :input-props="{ 'aria-label': t('preferences.connect-timeout') }"
            :min="constraint('connectTimeout').min"
            :max="constraint('connectTimeout').max"
            class="pref-number"
          />
          <NText depth="3" class="pref-inline-note">{{ t('preferences.unit-seconds') }}</NText>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.timeout"
          :label="t('preferences.timeout')"
          v-bind="configFieldProps('timeout', form.timeout)"
        >
          <NInputNumber
            v-model:value="form.timeout"
            :input-props="{ 'aria-label': t('preferences.timeout') }"
            :min="constraint('timeout').min"
            :max="constraint('timeout').max"
            class="pref-number"
          />
          <NText depth="3" class="pref-inline-note">{{ t('preferences.unit-seconds') }}</NText>
        </SettingsRow>
        <SettingsRow setting-key="preferences.file-allocation" :label="t('preferences.file-allocation')">
          <NSelect
            v-model:value="form.fileAllocation"
            :aria-label="t('preferences.file-allocation')"
            :options="fileAllocationOptions"
            class="pref-control-auto"
          />
        </SettingsRow>
      </NForm>
    </div>
    <UserAgentManager
      v-model:show="showUserAgentManager"
      :profiles="form.userAgentProfiles"
      :rules="form.userAgentRules"
      :recent-profile-ids="form.recentUserAgentProfileIds"
      @save="handleUserAgentManagerSave"
    />
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
/* Naive UI owns the visible focus border; do not add a second global outline. */
.proxy-scope-select :deep(.n-base-selection-tags:focus-visible) {
  outline: none;
}

.proxy-collapse__inner {
  overflow: hidden;
}
.port-recovery-collapse__inner {
  overflow: hidden;
}
.port-range-separator {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  color: var(--m3-on-surface-variant);
  font-size: 12px;
  line-height: 1;
}
.network-proxy-detect-button {
  min-width: fit-content;
}
/* ── UA preset row ───────────────────────────────────────────────── */
.ua-preset-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ua-field-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
