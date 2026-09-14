<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NForm,
  NFormItem,
  NInputNumber,
  NSwitch,
  NDivider,
  NCollapse,
  NCollapseItem,
  NCollapseTransition,
} from 'naive-ui'
import { useConnectionsPreference } from '@/composables/useConnectionsPreference'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import PreferenceActionBar from './PreferenceActionBar.vue'
import ConnectionSecret from './ConnectionSecret.vue'

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
      <NForm label-placement="left" label-align="left" label-width="260px" class="form-preference" :disabled="isSaving">
        <NDivider title-placement="left">{{ t('preferences.extension-section') }}</NDivider>
        <NFormItem :label="t('preferences.auto-submit-from-extension')">
          <NSwitch
            v-model:value="form.autoSubmitFromExtension"
            :aria-label="t('preferences.auto-submit-from-extension')"
          />
        </NFormItem>
        <NCollapseTransition :show="form.autoSubmitFromExtension">
          <NFormItem :label="t('preferences.silent-auto-submit-from-extension')">
            <NSwitch
              v-model:value="form.silentAutoSubmitFromExtension"
              :aria-label="t('preferences.silent-auto-submit-from-extension')"
            />
          </NFormItem>
        </NCollapseTransition>
        <NCollapse class="connection-disclosure">
          <NCollapseItem name="extension" :title="t('preferences.connection-config')">
            <NFormItem
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
            </NFormItem>
            <NFormItem :label="t('preferences.extension-api-secret')">
              <ConnectionSecret
                v-model="form.extensionApiSecret"
                :label="t('preferences.extension-api-secret')"
                :disabled="isSaving"
              />
            </NFormItem>
            <p class="connection-hint">{{ t('preferences.extension-api-secret-tip') }}</p>
          </NCollapseItem>
        </NCollapse>

        <NDivider title-placement="left">{{ t('preferences.rpc') }}</NDivider>
        <NFormItem
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
        </NFormItem>
        <NFormItem :label="t('preferences.rpc-secret')">
          <ConnectionSecret v-model="form.rpcSecret" :label="t('preferences.rpc-secret')" :disabled="isSaving" />
        </NFormItem>
        <p class="connection-hint">{{ t('preferences.restart-required') }}</p>

        <NDivider title-placement="left">{{ t('preferences.access-scope') }}</NDivider>
        <NFormItem :label="t('preferences.allow-remote-access')">
          <NSwitch v-model:value="form.allowRemoteAccess" :aria-label="t('preferences.allow-remote-access')" />
        </NFormItem>
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
