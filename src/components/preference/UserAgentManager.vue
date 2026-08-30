<script setup lang="ts">
/** @fileoverview User-Agent profile and host-rule manager. */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Sortable from 'sortablejs'
import type { SortableEvent } from 'sortablejs'
import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NText,
} from 'naive-ui'
import { AddOutline, ArrowForwardOutline, ReorderThreeOutline } from '@vicons/ionicons5'
import { vMotionAutoAnimate } from '@/directives/motionAutoAnimate'
import { useAppMessage } from '@/composables/useAppMessage'
import { useReducedMotion } from '@/composables/useReducedMotion'
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
const reduceMotion = useReducedMotion()
const manager = useUserAgentManager()
const ruleListRef = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

const selectedProfileRuleCount = computed(() =>
  manager.selectedProfile.value ? manager.profileRuleCount(manager.selectedProfile.value.id) : 0,
)
const selectedRuleProfileName = computed(
  () =>
    manager.profileOptions.value.find((option) => option.value === manager.selectedRule.value?.profileId)?.label ?? '',
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

function openProfileSetup(): void {
  manager.activePanel.value = 'profiles'
  addProfile()
}

function closeModal(): void {
  destroySortable()
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

function moveRule(event: SortableEvent): void {
  if (event.oldIndex === undefined || event.newIndex === undefined) return
  manager.moveRule(event.oldIndex, event.newIndex)
}

function destroySortable(): void {
  sortable?.destroy()
  sortable = null
}

function mountSortable(): void {
  destroySortable()
  if (!ruleListRef.value) return
  sortable = Sortable.create(ruleListRef.value, {
    animation: reduceMotion.value ? 0 : 220,
    handle: '.ua-manager-rule-handle',
    draggable: '.ua-manager-rule-row',
    direction: 'vertical',
    ghostClass: 'ua-manager-rule-row--ghost',
    chosenClass: 'ua-manager-rule-row--chosen',
    onUpdate: moveRule,
  })
}

watch(
  () => props.show,
  async (show) => {
    if (!show) {
      destroySortable()
      return
    }
    manager.reset({
      profiles: props.profiles,
      rules: props.rules,
      recentProfileIds: props.recentProfileIds,
    })
    await nextTick()
    mountSortable()
  },
)

watch([manager.activePanel, () => manager.rules.value.length], async ([panel]) => {
  if (!props.show || panel !== 'rules') {
    destroySortable()
    return
  }
  await nextTick()
  mountSortable()
})

watch(reduceMotion, (enabled) => {
  sortable?.option('animation', enabled ? 0 : 220)
})

onUnmounted(destroySortable)
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="false"
    transform-origin="center"
    :transition="{ name: 'fade-scale' }"
    @update:show="(value: boolean) => emit('update:show', value)"
  >
    <NCard closable class="ua-manager-card" :bordered="false" @close="closeModal">
      <template #header>
        <div class="ua-manager-heading">
          <strong>{{ t('preferences.ua-manager-title') }}</strong>
          <NText depth="3">{{ t('preferences.ua-manager-description') }}</NText>
        </div>
      </template>

      <NTabs
        :value="manager.activePanel.value"
        type="segment"
        animated
        class="ua-manager-tabs"
        @update:value="handlePanelChange"
      >
        <NTabPane name="profiles" :tab="`${t('preferences.ua-saved')} · ${manager.profiles.value.length}`">
          <div v-if="manager.profiles.value.length === 0" class="ua-manager-full-empty">
            <NEmpty :description="t('task.ua-no-saved')">
              <template #extra>
                <NButton type="primary" :disabled="!manager.canAddProfile.value" @click="addProfile">
                  <template #icon
                    ><NIcon><AddOutline /></NIcon
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
                    ><NIcon><AddOutline /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-profile') }}
                </NButton>
              </div>
              <div v-motion-auto-animate="{ duration: 220, easing: 'ease-out' }" class="ua-manager-list">
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
              </div>
            </aside>

            <section v-motion-auto-animate="{ duration: 200, easing: 'ease-out' }" class="ua-manager-editor">
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
            </section>
          </div>
        </NTabPane>

        <NTabPane name="rules" :tab="`${t('preferences.ua-rules')} · ${manager.rules.value.length}`">
          <div v-if="manager.profiles.value.length === 0" class="ua-manager-full-empty">
            <NEmpty :description="t('preferences.ua-rules-require-profile')">
              <template #extra>
                <NButton type="primary" @click="openProfileSetup">
                  <template #icon
                    ><NIcon><AddOutline /></NIcon
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
                    ><NIcon><AddOutline /></NIcon
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
                    ><NIcon><AddOutline /></NIcon
                  ></template>
                  {{ t('preferences.ua-add-rule') }}
                </NButton>
              </div>
              <div ref="ruleListRef" class="ua-manager-list ua-manager-rule-list">
                <div v-for="rule in manager.rules.value" :key="rule.id" class="ua-manager-rule-row">
                  <NButton
                    circle
                    quaternary
                    size="small"
                    class="ua-manager-rule-handle"
                    :aria-label="t('preferences.ua-rule-reorder')"
                  >
                    <template #icon
                      ><NIcon><ReorderThreeOutline /></NIcon
                    ></template>
                  </NButton>
                  <NButton
                    block
                    class="ua-manager-list-button ua-manager-rule-button"
                    :secondary="manager.selectedRuleId.value === rule.id"
                    :quaternary="manager.selectedRuleId.value !== rule.id"
                    :aria-pressed="manager.selectedRuleId.value === rule.id"
                    @click="manager.selectRule(rule.id)"
                  >
                    <span class="ua-manager-list-copy">
                      <span class="ua-manager-list-title">{{ rule.hostPattern || t('preferences.ua-new-rule') }}</span>
                      <span class="ua-manager-list-meta">
                        {{ profileName(rule.profileId) }} ·
                        {{ rule.enabled ? t('preferences.ua-rule-enabled') : t('preferences.ua-rule-disabled') }}
                      </span>
                    </span>
                  </NButton>
                </div>
              </div>
            </aside>

            <section v-motion-auto-animate="{ duration: 200, easing: 'ease-out' }" class="ua-manager-editor">
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
                    <NIcon aria-hidden="true"><ArrowForwardOutline /></NIcon>
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
            </section>
          </div>
        </NTabPane>
      </NTabs>

      <template #footer>
        <NSpace justify="space-between" align="center">
          <div v-motion-auto-animate="{ duration: 180, easing: 'ease-out' }" class="ua-manager-footer-left">
            <NButton
              v-if="manager.activePanel.value === 'profiles' && manager.selectedProfile.value"
              key="delete-profile"
              size="small"
              ghost
              type="error"
              @click="removeProfile"
            >
              {{ t('app.delete') }}
            </NButton>
            <NButton
              v-else-if="manager.activePanel.value === 'rules' && manager.selectedRule.value"
              key="delete-rule"
              size="small"
              ghost
              type="error"
              @click="removeRule"
            >
              {{ t('app.delete') }}
            </NButton>
          </div>
          <NSpace>
            <NButton @click="closeModal">{{ t('app.cancel') }}</NButton>
            <NButton type="primary" @click="handleSave">{{ t('app.save') }}</NButton>
          </NSpace>
        </NSpace>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.ua-manager-card {
  width: min(900px, calc(100vw - 32px));
  max-height: min(740px, calc(100vh - 32px));
}

.ua-manager-card :deep(.n-card__content) {
  min-height: 0;
  overflow: hidden;
}

.ua-manager-heading {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ua-manager-heading strong {
  font-size: 18px;
  font-weight: 600;
}

.ua-manager-heading .n-text {
  font-size: 12px;
  font-weight: 400;
}

.ua-manager-tabs {
  height: clamp(390px, 62vh, 540px);
}

.ua-manager-tabs :deep(.n-tabs-pane-wrapper),
.ua-manager-tabs :deep(.n-tab-pane) {
  height: 100%;
  min-height: 0;
}

.ua-manager-tabs :deep(.n-tabs-pane-wrapper) {
  padding-top: 16px;
}

.ua-manager-workspace {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.ua-manager-sidebar,
.ua-manager-editor {
  min-width: 0;
  min-height: 0;
}

.ua-manager-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 16px;
  border-right: 1px solid var(--m3-outline-variant);
}

.ua-manager-sidebar-header {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ua-manager-sidebar-header--stacked {
  align-items: flex-start;
}

.ua-manager-sidebar-header .n-text {
  font-size: 12px;
  line-height: 1.4;
}

.ua-manager-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ua-manager-list-button {
  height: auto;
  min-height: 56px;
  padding: 8px 10px;
  justify-content: flex-start;
}

.ua-manager-list-button :deep(.n-button__content) {
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
}

.ua-manager-list-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.ua-manager-list-title,
.ua-manager-list-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ua-manager-list-title {
  font-size: 13px;
  font-weight: 500;
}

.ua-manager-list-meta {
  color: var(--m3-on-surface-variant);
  font-size: 12px;
}

.ua-manager-rule-list {
  gap: 8px;
}

.ua-manager-rule-row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 4px;
  align-items: center;
}

.ua-manager-rule-handle {
  cursor: grab;
}

.ua-manager-rule-handle:active {
  cursor: grabbing;
}

.ua-manager-rule-row--ghost {
  opacity: 0.25;
}

.ua-manager-rule-row--chosen {
  opacity: 0.8;
}

.ua-manager-rule-button {
  min-width: 0;
}

.ua-manager-editor {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px 4px 8px 0;
}

.ua-manager-editor :deep(.n-form-item) {
  margin-bottom: 10px;
}

.ua-manager-editor-note {
  display: block;
  font-size: 12px;
}

.ua-manager-rule-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--m3-outline-variant);
  border-radius: 10px;
  background: var(--m3-surface-container-low);
}

.ua-manager-rule-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.ua-manager-rule-flow strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ua-manager-rule-flow strong:last-child {
  text-align: right;
}

.ua-manager-rule-preview .n-text {
  font-size: 12px;
}

.ua-manager-full-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.ua-manager-footer-left {
  min-width: 88px;
  min-height: 34px;
}

@media (max-width: 720px) {
  .ua-manager-card {
    width: calc(100vw - 20px);
    max-height: calc(100vh - 20px);
  }

  .ua-manager-tabs {
    height: min(620px, calc(100vh - 190px));
    min-height: 300px;
  }

  .ua-manager-workspace {
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }

  .ua-manager-sidebar {
    max-height: 210px;
    flex: 0 0 auto;
    padding-right: 0;
    padding-bottom: 14px;
    border-right: 0;
    border-bottom: 1px solid var(--m3-outline-variant);
  }

  .ua-manager-list {
    min-height: 96px;
  }

  .ua-manager-editor {
    flex: 0 0 auto;
    overflow: visible;
  }
}
</style>
