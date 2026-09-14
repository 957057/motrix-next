<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsRow from './SettingsRow.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NForm, NInputNumber, NSwitch, NCollapse, NCollapseItem, NCollapseTransition } from 'naive-ui'
import { useConnectionsPreference } from '@/composables/useConnectionsPreference'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import PreferenceActionBar from './PreferenceActionBar.vue'
import ConnectionSecret from './ConnectionSecret.vue'

const settingsRoute = useRoute()
const expandedGroups = ref<string[]>([])
watch(
  () => settingsRoute.hash,
  (hash) => {
    if (hash.includes('extension-api')) expandedGroups.value = ['extension']
  },
  { immediate: true },
)
const { t } = useI18n()
const { form, isDirty, isSaving, handleSave, handleReset } = useConnectionsPreference()
const { constraint, configFieldProps, areConfigFieldsValid } = usePreferenceNumericValidation()
const valid = computed(() =>
  areConfigFieldsValid({ extensionApiPort: form.value.extensionApiPort, rpcListenPort: form.value.rpcListenPort }),
)
</script>

<template>
  <div class="preference-form-wrapper" :aria-busy="isSaving">
    <div class="preference-form-scroll">
      <NForm label-placement="left" label-align="left" class="form-preference" :disabled="isSaving">
        <h2 class="settings-section-title">{{ t('preferences.extension-section') }}</h2>
        <SettingsRow
          setting-key="preferences.auto-submit-from-extension"
          :label="t('preferences.auto-submit-from-extension')"
        >
          <NSwitch
            v-model:value="form.autoSubmitFromExtension"
            :aria-label="t('preferences.auto-submit-from-extension')"
          />
        </SettingsRow>
        <NCollapseTransition :show="form.autoSubmitFromExtension || !!settingsRoute.hash">
          <SettingsRow
            setting-key="preferences.silent-auto-submit-from-extension"
            :label="t('preferences.silent-auto-submit-from-extension')"
          >
            <NSwitch
              v-model:value="form.silentAutoSubmitFromExtension"
              :aria-label="t('preferences.silent-auto-submit-from-extension')"
            />
          </SettingsRow>
        </NCollapseTransition>
        <NCollapse v-model:expanded-names="expandedGroups" class="connection-disclosure">
          <NCollapseItem name="extension" :title="t('preferences.connection-config')">
            <SettingsRow
              setting-key="preferences.extension-api-port"
              :label="t('preferences.extension-api-port')"
              v-bind="configFieldProps('extensionApiPort', form.extensionApiPort)"
            >
              <NInputNumber
                v-model:value="form.extensionApiPort"
                :min="constraint('extensionApiPort').min"
                :max="constraint('extensionApiPort').max"
                :input-props="{ 'aria-label': t('preferences.extension-api-port') }"
                class="pref-port"
              />
            </SettingsRow>
            <SettingsRow setting-key="preferences.extension-api-secret" :label="t('preferences.extension-api-secret')">
              <ConnectionSecret
                v-model="form.extensionApiSecret"
                :label="t('preferences.extension-api-secret')"
                :disabled="isSaving"
              />
            </SettingsRow>
            <p class="connection-hint">{{ t('preferences.extension-api-secret-tip') }}</p>
          </NCollapseItem>
        </NCollapse>

        <h2 class="settings-section-title">{{ t('preferences.rpc') }}</h2>
        <SettingsRow
          setting-key="preferences.rpc-listen-port"
          :label="t('preferences.rpc-listen-port')"
          v-bind="configFieldProps('rpcListenPort', form.rpcListenPort)"
        >
          <NInputNumber
            v-model:value="form.rpcListenPort"
            :min="constraint('rpcListenPort').min"
            :max="constraint('rpcListenPort').max"
            :input-props="{ 'aria-label': t('preferences.rpc-listen-port') }"
            class="pref-port"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.rpc-secret" :label="t('preferences.rpc-secret')">
          <ConnectionSecret v-model="form.rpcSecret" :label="t('preferences.rpc-secret')" :disabled="isSaving" />
        </SettingsRow>
        <p class="connection-hint">{{ t('preferences.restart-required') }}</p>

        <h2 class="settings-section-title">{{ t('preferences.access-scope') }}</h2>
        <SettingsRow setting-key="preferences.allow-remote-access" :label="t('preferences.allow-remote-access')">
          <NSwitch v-model:value="form.allowRemoteAccess" :aria-label="t('preferences.allow-remote-access')" />
        </SettingsRow>
        <p class="connection-hint">{{ t('preferences.access-scope-hint') }}</p>
      </NForm>
    </div>
    <PreferenceActionBar
      :is-dirty="isDirty"
      :is-valid="valid"
      :is-saving="isSaving"
      @save="handleSave"
      @discard="handleReset"
    />
  </div>
</template>

<style scoped>
.connection-disclosure {
  margin-block: 0 24px;
}
.connection-hint {
  margin: 0 0 20px;
  color: var(--m3-on-surface-variant);
  font-size: 12px;
  line-height: 1.6;
  max-inline-size: 64ch;
}
</style>
