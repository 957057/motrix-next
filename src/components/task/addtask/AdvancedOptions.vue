<script setup lang="ts">
/** @fileoverview Advanced task options panel (UA, auth, referer, cookie, proxy checkbox). */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NFormItem,
  NCollapse,
  NCollapseItem,
  NSelect,
  NInput,
  NInputGroup,
  NCheckbox,
  NCollapseTransition,
  NButton,
  NSwitch,
  NIcon,
} from 'naive-ui'
import { hasUnsafeHeaderChars, sanitizeHeaderValue } from '@shared/utils/headerSanitize'
import { useSystemProxyDetect } from '@/composables/useSystemProxyDetect'
import { useAppMessage } from '@/composables/useAppMessage'
import { SearchOutline } from '@vicons/ionicons5'
import type { TaskProxyMode } from '@shared/utils/proxy'
import UserAgentPopover from '@/components/common/UserAgentPopover.vue'
import type { UserAgentProfile, UserAgentRule } from '@shared/types'

const { t } = useI18n()

const props = defineProps<{
  mediaMode?: 'auto' | 'file' | 'hls' | 'dash'
  show: boolean
  userAgent: string
  authorization: string
  httpAuthUsername: string
  httpAuthPassword: string
  saveHttpAuth: boolean
  referer: string
  cookie: string
  /** Proxy mode for this task. */
  proxyMode: TaskProxyMode
  /** Custom proxy address when proxyMode is 'manual'. */
  customProxy: string
  customProxyUsername?: string
  customProxyPassword?: string
  sourceUrl?: string
  finalUrl?: string
  userAgentSource?: string
  userAgentProfiles: UserAgentProfile[]
  userAgentRules: UserAgentRule[]
  recentUserAgentProfileIds: string[]
}>()

const emit = defineEmits<{
  'update:mediaMode': [value: 'auto' | 'file' | 'hls' | 'dash']
  'update:show': [value: boolean]
  'update:userAgent': [value: string]
  'update:authorization': [value: string]
  'update:httpAuthUsername': [value: string]
  'update:httpAuthPassword': [value: string]
  'update:saveHttpAuth': [value: boolean]
  'update:referer': [value: string]
  'update:cookie': [value: string]
  'update:proxyMode': [value: TaskProxyMode]
  'update:customProxy': [value: string]
  'update:customProxyUsername': [value: string]
  'update:customProxyPassword': [value: string]
  selectUserAgentProfile: [profile: UserAgentProfile]
}>()

function handleDisclosure(names: unknown) {
  emit('update:show', Array.isArray(names) && names.length > 0)
}

const uaHasIssue = computed(() => !!props.userAgent && hasUnsafeHeaderChars(props.userAgent))

function cleanUserAgent() {
  emit('update:userAgent', sanitizeHeaderValue(props.userAgent))
}

const message = useAppMessage()
const { detecting: detectingProxy, detect: detectProxy } = useSystemProxyDetect({
  onSuccess(info) {
    emit('update:customProxy', info.server)
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
</script>

<template>
  <NCollapse :expanded-names="show ? ['advanced'] : []" @update:expanded-names="handleDisclosure">
    <NCollapseItem name="advanced" :title="t('task.show-advanced-options')">
      <slot />
      <NFormItem v-if="mediaMode !== undefined" :label="t('media.mode')">
        <NSelect
          :value="mediaMode"
          :options="[
            { value: 'auto', label: t('media.auto') },
            { value: 'file', label: t('media.original') },
            { value: 'hls', label: 'HLS' },
            { value: 'dash', label: 'DASH' },
          ]"
          @update:value="(value) => $emit('update:mediaMode', value)"
        />
      </NFormItem>
      <NCollapse
        :default-expanded-names="['request', ...(authorization || httpAuthUsername ? ['auth'] : [])]"
        class="advanced-groups"
        arrow-placement="right"
      >
        <NCollapseItem name="request" :title="t('task.request-options')">
          <NFormItem :label="t('task.task-user-agent')">
            <div class="ua-field-wrapper">
              <NInputGroup class="ua-input-row">
                <NInput
                  :value="userAgent"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 3 }"
                  @update:value="$emit('update:userAgent', $event)"
                />
                <UserAgentPopover
                  :url="sourceUrl"
                  :final-url="finalUrl"
                  :referer="referer"
                  :profiles="userAgentProfiles"
                  :rules="userAgentRules"
                  :recent-profile-ids="recentUserAgentProfileIds"
                  @select="$emit('selectUserAgentProfile', $event)"
                />
              </NInputGroup>
              <NCollapseTransition :show="!!userAgentSource"
                ><p class="field-hint">{{ userAgentSource }}</p></NCollapseTransition
              >
              <NCollapseTransition :show="uaHasIssue"
                ><div class="field-warning">
                  <span>{{ t('preferences.ua-unsafe-chars-detected') }}</span
                  ><NButton size="small" @click="cleanUserAgent">{{ t('preferences.ua-sanitize') }}</NButton>
                </div></NCollapseTransition
              >
            </div>
          </NFormItem>
          <NFormItem :label="t('task.task-referer')">
            <NInput
              :value="referer"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              @update:value="$emit('update:referer', $event)"
            />
          </NFormItem>
          <NFormItem :label="t('task.task-cookie')">
            <NInput
              :value="cookie"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              @update:value="$emit('update:cookie', $event)"
            />
          </NFormItem>
        </NCollapseItem>
        <NCollapseItem name="auth" :title="t('task.task-http-auth')">
          <NFormItem :label="t('task.task-authorization')">
            <NInput
              :value="authorization"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              @update:value="$emit('update:authorization', $event)"
            />
          </NFormItem>
          <NFormItem :label="t('task.task-http-auth')">
            <div class="http-auth-fields">
              <NInput
                :value="httpAuthUsername"
                :placeholder="t('task.task-http-auth-username-placeholder')"
                :input-props="{ 'aria-label': t('task.task-http-auth-username-placeholder') }"
                @update:value="$emit('update:httpAuthUsername', $event)"
              />
              <NInput
                :value="httpAuthPassword"
                type="password"
                show-password-on="click"
                :placeholder="t('task.task-http-auth-password-placeholder')"
                :input-props="{ 'aria-label': t('task.task-http-auth-password-placeholder') }"
                @update:value="$emit('update:httpAuthPassword', $event)"
              />
              <NCheckbox :checked="saveHttpAuth" @update:checked="$emit('update:saveHttpAuth', $event)">
                {{ t('task.task-http-auth-save') }}
              </NCheckbox>
            </div>
          </NFormItem>
        </NCollapseItem>
      </NCollapse>
      <NFormItem :label="t('task.use-proxy')">
        <NSwitch
          :value="proxyMode === 'manual'"
          @update:value="$emit('update:proxyMode', $event ? 'manual' : 'direct')"
        />
      </NFormItem>
      <NCollapseTransition :show="proxyMode === 'manual'">
        <div class="proxy-radio-group">
          <div class="custom-proxy-input">
            <NInput
              :value="customProxy"
              placeholder="http://host:port"
              @update:value="$emit('update:customProxy', $event)"
            />
            <NInput
              :value="customProxyUsername"
              :placeholder="t('preferences.proxy-username')"
              @update:value="$emit('update:customProxyUsername', $event)"
            />
            <NInput
              :value="customProxyPassword"
              type="password"
              show-password-on="click"
              :placeholder="t('preferences.proxy-password')"
              @update:value="$emit('update:customProxyPassword', $event)"
            />
            <NButton :loading="detectingProxy" size="small" @click="detectProxy">
              <template #icon>
                <NIcon><SearchOutline /></NIcon>
              </template>
              {{ t('preferences.detect-system-proxy') }}
            </NButton>
          </div>
        </div>
      </NCollapseTransition>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped>
.ua-field-wrapper,
.http-auth-fields,
.custom-proxy-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-hint {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
  line-height: 20px;
}
.field-warning {
  color: var(--m3-error);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.custom-proxy-input .n-button {
  align-self: flex-start;
}
.advanced-groups {
  margin-block-end: 24px;
}
.advanced-groups :deep(.n-collapse-item) {
  margin-inline: 0;
  border-top: 0;
}
.proxy-radio-group {
  padding-block-end: 8px;
}
</style>
