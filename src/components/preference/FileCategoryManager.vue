<script setup lang="ts">
/** @fileoverview Single-layer file category manager modal. */
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { buildDefaultCategories, MAX_FILE_CATEGORIES } from '@shared/constants'
import { normalizeFileCategory, validateCategoryUrlPatterns } from '@shared/utils/fileCategory'
import { Reorder, AnimatePresence } from 'motion-v'
import ReorderItem from '@/components/common/ReorderItem.vue'
import type { FileCategory } from '@shared/types'
import {
  NButton,
  NCard,
  NCollapseTransition,
  NDynamicTags,
  NIcon,
  NInput,
  NInputGroup,
  NModal,
  NSelect,
  NSpace,
  NText,
} from 'naive-ui'
import { FolderOpenOutline } from '@vicons/ionicons5'

const props = defineProps<{
  show: boolean
  categories: FileCategory[]
  baseDir: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [categories: FileCategory[]]
}>()

const { t } = useI18n()
const draft = ref<FileCategory[]>([])
const selectedKey = ref('')
const urlPatternText = ref('')
const urlRuleError = ref('')
const resetConfirming = ref(false)
let resetConfirmTimer: ReturnType<typeof setTimeout> | undefined
let categoryUid = 0
const categoryKeys = new WeakMap<FileCategory, string>()

const selectedIndex = computed({
  get() {
    const index = draft.value.findIndex((category) => categoryKey(category) === selectedKey.value)
    return index >= 0 ? index : 0
  },
  set(index: number) {
    const category = draft.value[index] ?? draft.value[0]
    selectedKey.value = category ? categoryKey(category) : ''
  },
})
const selectedCategory = computed(() => draft.value[selectedIndex.value])
const modeOptions = computed(() => [
  { label: t('preferences.file-category-url-mode-wildcard'), value: 'wildcard' },
  { label: t('preferences.file-category-url-mode-regex'), value: 'regex' },
])

function cloneCategories(categories: FileCategory[]): FileCategory[] {
  return categories.map((category) =>
    assignCategoryKey(normalizeFileCategory(JSON.parse(JSON.stringify(category)) as FileCategory)),
  )
}

function assignCategoryKey(category: FileCategory): FileCategory {
  categoryKeys.set(category, `category-${++categoryUid}`)
  return category
}

function categoryKey(category: FileCategory): string {
  const key = categoryKeys.get(category)
  if (key) return key
  return categoryKeys.get(assignCategoryKey(category)) ?? `category-${++categoryUid}`
}

function categoryTitle(category: FileCategory): string {
  return category.builtIn
    ? t(`preferences.${category.label}`)
    : category.label || t('preferences.file-category-untitled')
}

function categoryMeta(category: FileCategory): string {
  const extCount = category.extensions.length
  const urlCount = category.urlPatterns?.length ?? 0
  return t('preferences.file-category-summary-counts', { ext: extCount, url: urlCount })
}

function closeModal() {
  stopResetConfirm()
  emit('update:show', false)
}

function urlPatternLines(category: FileCategory): string[] {
  if (category === selectedCategory.value) return urlPatternText.value.split(/\r?\n/)
  return category.urlPatterns ?? []
}

function urlRuleErrorMessage(reason: string, line: number): string {
  const key =
    reason === 'too-long'
      ? 'preferences.file-category-invalid-url-rule-too-long'
      : 'preferences.file-category-invalid-regex'
  return t(key, { line })
}

function validateUrlRules(): boolean {
  urlRuleError.value = ''
  for (const [index, category] of draft.value.entries()) {
    const error = validateCategoryUrlPatterns(urlPatternLines(category), category.urlPatternMode)
    if (!error) continue
    selectedIndex.value = index
    syncUrlPatternText()
    urlRuleError.value = urlRuleErrorMessage(error.reason, error.line)
    return false
  }
  return true
}

function handleSave() {
  if (!validateUrlRules()) return
  handleUrlPatternChange(urlPatternText.value)
  draft.value = draft.value.map(normalizeFileCategory)
  emit('save', cloneCategories(draft.value))
  closeModal()
}

function handleAddCategory() {
  if (draft.value.length >= MAX_FILE_CATEGORIES) return
  const baseDir = props.baseDir
  draft.value.push(
    assignCategoryKey({
      label: '',
      extensions: [],
      urlPatterns: [],
      urlPatternMode: 'wildcard',
      directory: baseDir,
      builtIn: false,
    }),
  )
  selectedIndex.value = draft.value.length - 1
}

function handleDeleteCategory() {
  if (!selectedCategory.value) return
  draft.value.splice(selectedIndex.value, 1)
  selectedIndex.value = Math.max(0, Math.min(selectedIndex.value, draft.value.length - 1))
  syncUrlPatternText()
  urlRuleError.value = ''
}

function stopResetConfirm() {
  if (resetConfirmTimer !== undefined) {
    clearTimeout(resetConfirmTimer)
    resetConfirmTimer = undefined
  }
  resetConfirming.value = false
}

function startResetConfirm() {
  stopResetConfirm()
  resetConfirming.value = true
  resetConfirmTimer = setTimeout(stopResetConfirm, 2000)
}

function handleResetCategories() {
  if (!resetConfirming.value) {
    startResetConfirm()
    return
  }
  stopResetConfirm()
  draft.value = cloneCategories(buildDefaultCategories(props.baseDir))
  selectedIndex.value = 0
  syncUrlPatternText()
}

function handleLabelChange(value: string) {
  if (!selectedCategory.value) return
  selectedCategory.value.label = value
  selectedCategory.value.builtIn = false
}

function handleExtChange(values: string[]) {
  if (!selectedCategory.value) return
  selectedCategory.value.extensions = values
    .map((value) => value.toLowerCase().replace(/^\./, '').trim())
    .filter(Boolean)
}

function handleUrlPatternChange(value: string) {
  if (!selectedCategory.value) return
  urlPatternText.value = value
  urlRuleError.value = ''
  selectedCategory.value.urlPatterns = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function handleUrlModeChange(value: string) {
  if (!selectedCategory.value) return
  selectedCategory.value.urlPatternMode = value === 'regex' ? 'regex' : 'wildcard'
}

function handleDirectoryInput(value: string) {
  if (!selectedCategory.value) return
  selectedCategory.value.directory = value
}

function handleSelectCategory(index: number) {
  selectedIndex.value = index
  syncUrlPatternText()
  urlRuleError.value = ''
}

function handleDragHandlePointerDown(index: number) {
  if (index === selectedIndex.value) return
  handleSelectCategory(index)
}

function moveCategory(oldIndex: number, newIndex: number) {
  if (oldIndex === newIndex) return
  const next = [...draft.value]
  const [category] = next.splice(oldIndex, 1)
  if (!category) return
  next.splice(newIndex, 0, category)
  draft.value = next
}

async function handleSelectCategoryDir() {
  if (!selectedCategory.value) return
  const selected = await openDialog({ directory: true, multiple: false })
  if (typeof selected === 'string') selectedCategory.value.directory = selected
}

function syncUrlPatternText() {
  urlPatternText.value = (selectedCategory.value?.urlPatterns ?? []).join('\n')
}

watch(
  () => props.show,
  (show) => {
    if (!show) return
    draft.value = cloneCategories(
      props.categories.length > 0 ? props.categories : buildDefaultCategories(props.baseDir),
    )
    selectedIndex.value = 0
    stopResetConfirm()
    syncUrlPatternText()
    urlRuleError.value = ''
  },
  { immediate: true },
)
onUnmounted(stopResetConfirm)
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="false"
    transform-origin="center"
    @update:show="(value: boolean) => emit('update:show', value)"
  >
    <NCard
      :title="t('preferences.file-category-manager-title')"
      closable
      class="category-manager-card"
      :bordered="false"
      @close="closeModal"
    >
      <div class="category-manager">
        <aside class="category-manager-list">
          <div class="category-manager-priority-hint">
            {{ t('preferences.file-category-priority-hint') }}
          </div>
          <Reorder.Group v-model:values="draft" as="div" axis="y" class="category-manager-list-items" layout-scroll>
            <AnimatePresence :initial="false" mode="popLayout">
              <ReorderItem
                v-for="(category, index) in draft"
                v-slot="{ start }"
                :key="categoryKey(category)"
                :value="category"
                role="button"
                tabindex="0"
                class="category-manager-list-item"
                :class="{ 'category-manager-list-item--active': index === selectedIndex }"
                @click="handleSelectCategory(index)"
                @keydown.enter.prevent="handleSelectCategory(index)"
                @keydown.space.prevent="handleSelectCategory(index)"
              >
                <span
                  class="category-manager-drag-handle"
                  role="button"
                  tabindex="0"
                  :aria-label="t('preferences.file-category-priority-hint')"
                  @click.stop
                  @pointerdown="
                    (event) => {
                      handleDragHandlePointerDown(index)
                      start(event)
                    }
                  "
                  @keydown.up.stop.prevent="moveCategory(index, Math.max(0, index - 1))"
                  @keydown.down.stop.prevent="moveCategory(index, Math.min(draft.length - 1, index + 1))"
                >
                  <span aria-hidden="true">⋮⋮</span>
                </span>
                <span class="category-manager-list-copy">
                  <span class="category-manager-list-title">{{ categoryTitle(category) }}</span>
                  <span class="category-manager-list-meta">{{ categoryMeta(category) }}</span>
                </span>
              </ReorderItem>
            </AnimatePresence>
          </Reorder.Group>
          <div class="category-manager-list-actions">
            <NButton size="small" block :disabled="draft.length >= MAX_FILE_CATEGORIES" @click="handleAddCategory">
              {{ t('preferences.file-category-add') }}
            </NButton>
            <NButton
              size="small"
              block
              :type="resetConfirming ? 'error' : 'default'"
              class="category-manager-reset-button"
              :class="{ 'category-manager-reset-button--confirm': resetConfirming }"
              @click="handleResetCategories"
            >
              <span class="category-manager-reset-content">
                <Transition name="reset-label">
                  <span :key="resetConfirming ? 'confirm' : 'idle'">
                    {{
                      resetConfirming
                        ? t('preferences.file-category-reset-confirm')
                        : t('preferences.file-category-reset')
                    }}
                  </span>
                </Transition>
              </span>
            </NButton>
          </div>
        </aside>

        <section v-if="selectedCategory" class="category-manager-editor">
          <Transition name="content-fade">
            <div :key="selectedKey" class="category-manager-editor-content">
              <div class="category-manager-field">
                <span>{{ t('preferences.file-category-custom-label') }}</span>
                <NInput :value="categoryTitle(selectedCategory)" size="small" @update:value="handleLabelChange" />
              </div>

              <div class="category-manager-field">
                <div class="category-manager-field-title">
                  <span>{{ t('preferences.file-category-file-types') }}</span>
                  <NText depth="3" class="category-manager-hint">
                    {{ t('preferences.file-category-file-types-hint') }}
                  </NText>
                </div>
                <NDynamicTags
                  :value="selectedCategory.extensions.map((extension: string) => `.${extension}`)"
                  size="small"
                  @update:value="handleExtChange"
                />
              </div>

              <div class="category-manager-field">
                <div class="category-manager-field-row">
                  <div class="category-manager-field-title">
                    <span>{{ t('preferences.file-category-url-rules') }}</span>
                    <NText depth="3" class="category-manager-hint">
                      {{ t('preferences.file-category-url-rules-hint') }}
                    </NText>
                  </div>
                  <div class="category-manager-field-row-right">
                    <NSelect
                      :value="selectedCategory.urlPatternMode ?? 'wildcard'"
                      :options="modeOptions"
                      size="small"
                      class="category-manager-mode"
                      @update:value="handleUrlModeChange"
                    />
                  </div>
                </div>
                <div class="category-manager-url-control">
                  <NInput
                    :value="urlPatternText"
                    type="textarea"
                    :rows="4"
                    size="small"
                    :status="urlRuleError ? 'error' : undefined"
                    :placeholder="t('preferences.file-category-url-placeholder')"
                    @update:value="handleUrlPatternChange"
                  />
                  <NCollapseTransition :show="!!urlRuleError">
                    <div class="category-manager-error">
                      {{ urlRuleError }}
                    </div>
                  </NCollapseTransition>
                </div>
              </div>

              <div class="category-manager-field">
                <span>{{ t('preferences.download-path') }}</span>
                <NInputGroup>
                  <NInput
                    :value="selectedCategory.directory"
                    size="small"
                    class="category-manager-path"
                    @update:value="handleDirectoryInput"
                  />
                  <NButton size="small" class="pref-icon-button-sm" @click="handleSelectCategoryDir">
                    <template #icon>
                      <NIcon :size="14"><FolderOpenOutline /></NIcon>
                    </template>
                  </NButton>
                </NInputGroup>
              </div>
            </div>
          </Transition>
        </section>
      </div>

      <template #footer>
        <NSpace justify="space-between" align="center">
          <div class="category-manager-footer-left">
            <Transition name="footer-delete">
              <NButton
                v-if="selectedCategory"
                key="delete-category"
                size="small"
                ghost
                type="error"
                @click="handleDeleteCategory"
              >
                {{ t('app.delete') }}
              </NButton>
              <NText v-else key="delete-empty" depth="3" />
            </Transition>
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
.category-manager-card {
  width: min(840px, calc(100vw - 32px));
  max-height: min(720px, calc(100dvh - 48px));
}

.category-manager-card :deep(.n-card__content) {
  min-height: 0;
  overflow: hidden;
}

.category-manager {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 16px;
  height: min(520px, calc(100dvh - 208px));
  min-height: 0;
}

.category-manager-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  min-width: 0;
}

.category-manager-priority-hint {
  flex: 0 0 auto;
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.4;
}

.category-manager-list-items {
  flex: 1 1 0;
  position: relative;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.category-manager-list-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 54px;
  margin-bottom: 6px;
  padding: 8px 10px;
  border: 1px solid var(--m3-outline-variant);
  border-radius: 8px;
  color: var(--n-text-color);
  background: var(--m3-surface-container-low);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s cubic-bezier(0.2, 0, 0, 1),
    border-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.category-manager-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: 22px;
  border-radius: 6px;
  color: var(--n-text-color-3);
  cursor: grab;
  touch-action: none;
  transition:
    color 0.18s cubic-bezier(0.2, 0, 0, 1),
    background-color 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.category-manager-drag-handle:hover {
  color: var(--m3-primary);
  background: var(--m3-surface-container-highest);
}

.category-manager-drag-handle:active {
  cursor: grabbing;
}

.category-manager-list-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.category-manager-list-item:hover {
  border-color: var(--m3-primary);
}

.category-manager-list-item--active {
  border-color: var(--m3-primary);
  background: var(--m3-surface-container-high);
}
.category-manager-list-title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-manager-list-meta {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.category-manager-list-actions {
  display: grid;
  gap: 8px;
  flex: 0 0 auto;
}

.category-manager-reset-button {
  transition:
    color 0.2s cubic-bezier(0.2, 0, 0, 1),
    background-color 0.2s cubic-bezier(0.2, 0, 0, 1),
    border-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.category-manager-reset-button--confirm {
  background: color-mix(in srgb, var(--m3-error) 14%, transparent);
}

.category-manager-reset-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.category-manager-editor {
  min-width: 0;
  padding: 2px 0;
}

.category-manager-editor-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.category-manager-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
}

.category-manager-hint {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  white-space: nowrap;
}

.category-manager-field-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.category-manager-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.category-manager-field-row-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.category-manager-mode {
  width: 128px;
  flex: 0 0 auto;
}

.category-manager-url-control {
  min-width: 0;
}

.category-manager-path {
  flex: 1;
}

.category-manager-error {
  margin-top: 6px;
  color: var(--m3-error);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
}

.category-manager-footer-left {
  min-width: 76px;
}

.content-fade-enter-active {
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.content-fade-leave-active {
  transition: opacity 0.14s cubic-bezier(0.3, 0, 0.8, 0.15);
}

.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}

.reset-label-enter-active,
.reset-label-leave-active {
  transition:
    opacity 0.16s cubic-bezier(0.2, 0, 0, 1),
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.reset-label-enter-from,
.reset-label-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

.footer-delete-enter-active {
  transition:
    opacity 0.26s cubic-bezier(0.2, 0, 0, 1),
    transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.footer-delete-leave-active {
  transition:
    opacity 0.14s cubic-bezier(0.3, 0, 0.8, 0.15),
    transform 0.14s cubic-bezier(0.3, 0, 0.8, 0.15);
}

.footer-delete-enter-from,
.footer-delete-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
</style>
