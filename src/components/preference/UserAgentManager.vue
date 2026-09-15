<script setup lang="ts">
import AppDialog from '@/components/common/AppDialog.vue'
/** @fileoverview User-Agent profile and host-rule manager. */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSwitch,
  NTab,
  NTabs,
  NText,
} from 'naive-ui'
import { Plus, ArrowRight, GripVertical } from '@lucide/vue'
import { useAppMessage } from '@/composables/useAppMessage'
import { Reorder, AnimatePresence } from 'motion-v'
import ReorderItem from '@/components/common/ReorderItem.vue'
import { useUserAgentManager } from '@/composables/useUserAgentManager'
import type { UserAgentProfile, UserAgentRule } from '@shared/types'
import { isValidUserAgentHostPattern } from '@shared/utils/userAgentPolicy'

const props = defineProps<{
  show: boolean
  profiles: UserAgentProfile[]
  rules: UserAgentRule[]
  recentProfileIds: string[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [payload: { profiles: UserAgentProfile[]; rules: UserAgentRule[]; recentProfileIds: string[] }]
}>()

const { t } = useI18n()
const message = useAppMessage()
const manager = useUserAgentManager()

type ManagerView = 'profiles-empty' | 'profiles-workspace' | 'rules-no-profile' | 'rules-empty' | 'rules-workspace'

const activeView = computed<ManagerView>(() => {
  if (manager.activePanel.value === 'profiles') {
    return manager.profiles.value.length === 0 ? 'profiles-empty' : 'profiles-workspace'
  }
  if (manager.profiles.value.length === 0) return 'rules-no-profile'
  return manager.rules.value.length === 0 ? 'rules-empty' : 'rules-workspace'
})

const selectedProfileRuleCount = computed(() =>
  manager.selectedProfile.value ? manager.profileRuleCount(manager.selectedProfile.value.id) : 0,
)
const selectedRuleProfileName = computed(
  () =>
    manager.profileOptions.value.find((option) => option.value === manager.selectedRule.value?.profileId)?.label ?? '',
)
const canDeleteSelected = computed(() =>
  manager.activePanel.value === 'profiles'
    ? Boolean(manager.selectedProfile.value)
    : Boolean(manager.selectedRule.value),
)
const profileNameInvalid = computed(
  () => manager.validationRequested.value && !manager.selectedProfile.value?.name.trim(),
)
const profileValueInvalid = computed(
  () => manager.validationRequested.value && !manager.selectedProfile.value?.value.trim(),
)
const ruleHostInvalid = computed(
  () =>
    manager.validationRequested.value && !isValidUserAgentHostPattern(manager.selectedRule.value?.hostPattern ?? ''),
)
const ruleProfileInvalid = computed(
  () =>
    manager.validationRequested.value &&
    !manager.profileOptions.value.some((option) => option.value === manager.selectedRule.value?.profileId),
)
const pluginBehavior = computed<'preserve' | 'override'>({
  get: () => (manager.selectedRule.value?.overridePlugin ? 'override' : 'preserve'),
  set: (value) => {
    if (manager.selectedRule.value) manager.selectedRule.value.overridePlugin = value === 'override'
  },
})

function profileMeta(profile: UserAgentProfile): string {
  const count = manager.profileRuleCount(profile.id)
  return count > 0 ? t('preferences.ua-profile-rule-count', { count }) : t('preferences.ua-no-rules')
}

function profileName(id: string): string {
  return manager.profiles.value.find((profile) => profile.id === id)?.name ?? id
}

function handlePanelChange(value: string | number): void {
  if (value === 'profiles' || value === 'rules') manager.activePanel.value = value
}

function addProfile(): void {
  manager.addProfile(t('preferences.ua-new-profile'))
}

function addRule(): void {
  manager.addRule()
}

function removeProfile(): void {
  if (!manager.removeProfile()) message.error(t('preferences.ua-profile-in-use'))
}

function removeRule(): void {
  manager.removeRule()
}

function removeSelected(): void {
  if (manager.activePanel.value === 'profiles') removeProfile()
  else removeRule()
}

function openProfileSetup(): void {
  manager.activePanel.value = 'profiles'
  addProfile()
}

function closeModal(): void {
  emit('update:show', false)
}

function handleSave(): void {
  const error = manager.validate()
  if (error) {
    message.error(error.kind === 'profile' ? t('preferences.ua-profile-invalid') : t('preferences.ua-rule-invalid'))
    return
  }
  emit('save', manager.payload())
  closeModal()
}

watch(
  () => props.show,
  (show) => {
    if (show) manager.reset({ profiles: props.profiles, rules: props.rules, recentProfileIds: props.recentProfileIds })
  },
  { immediate: true },
)
</script>

<template>
  <AppDialog :show="show" :title="t('preferences.ua-manager-title')" size="wide" @close="closeModal">
    <p class="manager-description">{{ t('preferences.ua-manager-description') }}</p>
    <NTabs :value="manager.activePanel.value" type="line" @update:value="handlePanelChange">
      <NTab name="profiles">{{ t('preferences.ua-saved') }} · {{ manager.profiles.value.length }}</NTab>
      <NTab name="rules">{{ t('preferences.ua-rules') }} · {{ manager.rules.value.length }}</NTab>
    </NTabs>

    <div class="ua-manager-content-stage">
      <Transition name="fade">
        <div v-if="manager.activePanel.value === 'profiles'" :key="activeView" class="ua-manager-pane-stage">
          <div v-if="manager.profiles.value.length === 0" class="ua-manager-full-empty">
            <NEmpty :description="t('task.ua-no-saved')">
              <template #extra>
                <NButton type="primary" :disabled="!manager.canAddProfile.value" @click="addProfile">
                  <template #icon
                    ><NIcon><Plus /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-profile') }}
                </NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else class="ua-manager-workspace">
            <aside class="ua-manager-sidebar">
              <div class="ua-manager-sidebar-header">
                <NText depth="3">{{ t('preferences.ua-saved') }}</NText>
                <NButton size="small" secondary :disabled="!manager.canAddProfile.value" @click="addProfile">
                  <template #icon
                    ><NIcon><Plus /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-profile') }}
                </NButton>
              </div>
              <TransitionGroup tag="div" name="list" class="ua-manager-list">
                <NButton
                  v-for="profile in manager.profiles.value"
                  :key="profile.id"
                  block
                  class="ua-manager-list-button"
                  :secondary="manager.selectedProfileId.value === profile.id"
                  :quaternary="manager.selectedProfileId.value !== profile.id"
                  :aria-pressed="manager.selectedProfileId.value === profile.id"
                  @click="manager.selectProfile(profile.id)"
                >
                  <span class="ua-manager-list-copy">
                    <span class="ua-manager-list-title">{{ profile.name }}</span>
                    <span class="ua-manager-list-meta">{{ profileMeta(profile) }}</span>
                  </span>
                </NButton>
              </TransitionGroup>
            </aside>

            <section class="ua-manager-editor">
              <Transition name="view">
                <NForm
                  v-if="manager.selectedProfile.value"
                  :key="manager.selectedProfile.value.id"
                  label-placement="top"
                  size="small"
                >
                  <NFormItem
                    :label="t('preferences.ua-profile-name')"
                    :validation-status="profileNameInvalid ? 'error' : undefined"
                    :feedback="profileNameInvalid ? t('preferences.ua-profile-invalid') : undefined"
                  >
                    <NInput v-model:value="manager.selectedProfile.value.name" />
                  </NFormItem>
                  <NFormItem
                    :label="t('preferences.user-agent')"
                    :validation-status="profileValueInvalid ? 'error' : undefined"
                    :feedback="profileValueInvalid ? t('preferences.ua-profile-invalid') : undefined"
                  >
                    <NInput
                      v-model:value="manager.selectedProfile.value.value"
                      type="textarea"
                      :autosize="{ minRows: 5, maxRows: 9 }"
                    />
                  </NFormItem>
                  <NText depth="3" class="ua-manager-editor-note">
                    {{ t('preferences.ua-profile-rule-count', { count: selectedProfileRuleCount }) }}
                  </NText>
                </NForm>
              </Transition>
            </section>
          </div>
        </div>

        <div v-else :key="activeView" class="ua-manager-pane-stage">
          <div v-if="manager.profiles.value.length === 0" class="ua-manager-full-empty">
            <NEmpty :description="t('preferences.ua-rules-require-profile')">
              <template #extra>
                <NButton type="primary" @click="openProfileSetup">
                  <template #icon
                    ><NIcon><Plus /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-profile') }}
                </NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else-if="manager.rules.value.length === 0" class="ua-manager-full-empty">
            <NEmpty :description="t('preferences.ua-no-rules')">
              <template #extra>
                <NButton type="primary" :disabled="!manager.canAddRule.value" @click="addRule">
                  <template #icon
                    ><NIcon><Plus /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-rule') }}
                </NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else class="ua-manager-workspace">
            <aside class="ua-manager-sidebar">
              <div class="ua-manager-sidebar-header ua-manager-sidebar-header--stacked">
                <NText depth="3">{{ t('preferences.ua-rule-order-hint') }}</NText>
                <NButton size="small" secondary :disabled="!manager.canAddRule.value" @click="addRule">
                  <template #icon
                    ><NIcon><Plus /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-rule') }}
                </NButton>
              </div>
              <Reorder.Group
                v-model:values="manager.rules.value"
                as="div"
                axis="y"
                class="ua-manager-list ua-manager-rule-list"
                layout-scroll
              >
                <AnimatePresence :initial="false" mode="popLayout">
                  <ReorderItem
                    v-for="(rule, index) in manager.rules.value"
                    v-slot="{ start }"
                    :key="rule.id"
                    :value="rule"
                    role="button"
                    tabindex="0"
                    class="ua-manager-rule-row"
                    :class="{ 'ua-manager-rule-row--active': manager.selectedRuleId.value === rule.id }"
                    :aria-pressed="manager.selectedRuleId.value === rule.id"
                    @click="manager.selectRule(rule.id)"
                    @keydown.enter.prevent="manager.selectRule(rule.id)"
                    @keydown.space.prevent="manager.selectRule(rule.id)"
                  >
                    <span
                      class="ua-manager-rule-handle"
                      role="button"
                      tabindex="0"
                      :aria-label="t('preferences.ua-rule-reorder')"
                      @click.stop
                      @pointerdown="
                        (event) => {
                          manager.selectRule(rule.id)
                          start(event)
                        }
                      "
                      @keydown.up.stop.prevent="manager.moveRule(index, Math.max(0, index - 1))"
                      @keydown.down.stop.prevent="
                        manager.moveRule(index, Math.min(manager.rules.value.length - 1, index + 1))
                      "
                    >
                      <NIcon aria-hidden="true"><GripVertical /></NIcon>
                    </span>
                    <span class="ua-manager-list-copy">
                      <span class="ua-manager-list-title">{{ rule.hostPattern || t('preferences.ua-new-rule') }}</span>
                      <span class="ua-manager-list-meta">
                        {{ profileName(rule.profileId) }} ·
                        {{ rule.enabled ? t('preferences.ua-rule-enabled') : t('preferences.ua-rule-disabled') }}
                      </span>
                    </span>
                  </ReorderItem>
                </AnimatePresence>
              </Reorder.Group>
            </aside>

            <section class="ua-manager-editor">
              <Transition name="view">
                <NForm
                  v-if="manager.selectedRule.value"
                  :key="manager.selectedRule.value.id"
                  label-placement="top"
                  size="small"
                >
                  <NFormItem :label="t('preferences.ua-rule-enabled')">
                    <NSwitch v-model:value="manager.selectedRule.value.enabled" />
                  </NFormItem>
                  <NFormItem
                    :label="t('preferences.ua-rule-host')"
                    :validation-status="ruleHostInvalid ? 'error' : undefined"
                    :feedback="ruleHostInvalid ? t('preferences.ua-rule-invalid') : t('preferences.ua-rule-host-hint')"
                  >
                    <NInput v-model:value="manager.selectedRule.value.hostPattern" placeholder="*.example.com" />
                  </NFormItem>
                  <NFormItem
                    :label="t('preferences.ua-rule-profile')"
                    :validation-status="ruleProfileInvalid ? 'error' : undefined"
                    :feedback="ruleProfileInvalid ? t('preferences.ua-rule-invalid') : undefined"
                  >
                    <NSelect
                      v-model:value="manager.selectedRule.value.profileId"
                      :options="manager.profileOptions.value"
                    />
                  </NFormItem>
                  <NFormItem :label="t('preferences.ua-browser-user-agent')">
                    <NRadioGroup v-model:value="pluginBehavior" size="small">
                      <NRadioButton value="preserve">{{ t('preferences.ua-override-off') }}</NRadioButton>
                      <NRadioButton value="override">{{ t('preferences.ua-override-on') }}</NRadioButton>
                    </NRadioGroup>
                  </NFormItem>
                  <div class="ua-manager-rule-preview">
                    <div class="ua-manager-rule-flow">
                      <strong>{{ manager.selectedRule.value.hostPattern || '*.example.com' }}</strong>
                      <NIcon aria-hidden="true"><ArrowRight /></NIcon>
                      <strong>{{ selectedRuleProfileName }}</strong>
                    </div>
                    <NText depth="3">
                      {{
                        manager.selectedRule.value.overridePlugin
                          ? t('preferences.ua-override-on')
                          : t('preferences.ua-override-off')
                      }}
                    </NText>
                  </div>
                </NForm>
              </Transition>
            </section>
          </div>
        </div>
      </Transition>
    </div>

    <template #footer>
      <NSpace justify="space-between" align="center">
        <div class="ua-manager-footer-left">
          <Transition name="fade">
            <NButton v-if="canDeleteSelected" size="small" ghost type="error" @click="removeSelected">
              {{ t('app.delete') }}
            </NButton>
          </Transition>
        </div>
        <NSpace>
          <NButton @click="closeModal">{{ t('app.cancel') }}</NButton>
          <NButton type="primary" @click="handleSave">{{ t('app.save') }}</NButton>
        </NSpace>
      </NSpace>
    </template>
  </AppDialog>
</template>

<style scoped>
.manager-description {
  margin-bottom: 16px;
  color: var(--rb-text-muted);
  font-size: 13px;
}
.ua-manager-content-stage {
  margin-top: 20px;
  min-height: 200px;
}
.ua-manager-pane-stage {
  position: relative;
}
.ua-manager-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.ua-manager-sidebar,
.ua-manager-editor {
  min-width: 0;
}
.ua-manager-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ua-manager-list {
  position: relative;
  max-height: 220px;
  overflow: auto;
}
.ua-manager-list-button {
  width: 100%;
  height: auto;
  min-height: 56px;
  padding: 12px;
  justify-content: flex-start;
  border-bottom: 1px solid var(--rb-hairline);
  border-radius: 0;
}
.ua-manager-list-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.ua-manager-list-title {
  font-weight: 500;
  font-size: 14px;
}
.ua-manager-list-meta {
  font-size: 13px;
  color: var(--rb-text-muted);
  white-space: normal;
  overflow-wrap: anywhere;
}
.ua-manager-editor {
  position: relative;
  padding-top: 20px;
  border-top: 1px solid var(--rb-hairline);
}
.ua-manager-editor > .view-leave-active {
  inset-block-start: 20px;
}
.ua-manager-editor-form,
.ua-manager-rule-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ua-manager-full-empty {
  padding-block: 32px;
}
.ua-manager-rule-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--rb-hairline);
}
.ua-rule-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ua-manager-rule-handle {
  cursor: grab;
  touch-action: none;
  display: grid;
  place-items: center;
  min-width: 32px;
  min-height: 32px;
}
.ua-manager-rule-row--active {
  background: var(--rb-selected);
}
</style>
