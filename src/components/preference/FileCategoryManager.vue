<script setup lang="ts">
import AppDialog from '@/components/common/AppDialog.vue'
/** @fileoverview Single-layer file category manager modal. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { buildDefaultCategories, MAX_FILE_CATEGORIES } from '@shared/constants'
import { normalizeFileCategory, validateCategoryUrlPatterns } from '@shared/utils/fileCategory'
import { Reorder, AnimatePresence } from 'motion-v'
import ReorderItem from '@/components/common/ReorderItem.vue'
import type { FileCategory } from '@shared/types'
import {
  NButton,
  useDialog,
  NCollapseTransition,
  NDynamicTags,
  NIcon,
  NInput,
  NInputGroup,
  NSelect,
  NSpace,
  NText,
} from 'naive-ui'
import { FolderOpenOutline, ReorderTwoOutline } from '@vicons/ionicons5'

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
const dialog = useDialog()
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

function handleResetCategories() {
  dialog.warning({
    title: t('preferences.file-category-reset'),
    content: t('preferences.file-category-reset-confirm'),
    positiveText: t('preferences.file-category-reset'),
    negativeText: t('app.cancel'),
    onPositiveClick() {
      draft.value = cloneCategories(buildDefaultCategories(props.baseDir))
      selectedIndex.value = 0
      syncUrlPatternText()
    },
  })
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
    syncUrlPatternText()
    urlRuleError.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <AppDialog :show="show" :title="t('preferences.file-category-manager-title')" size="wide" @close="closeModal">
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
                <NIcon :size="18"><ReorderTwoOutline /></NIcon>
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
          <NButton size="small" block class="category-manager-reset-button" @click="handleResetCategories">
            {{ t('preferences.file-category-reset') }}
          </NButton>
        </div>
      </aside>

      <section v-if="selectedCategory" class="category-manager-editor">
        <Transition name="fade">
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
          <Transition name="fade">
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
  </AppDialog>
</template>

<style scoped>
.category-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.category-manager-priority-hint {
  font-size: 13px;
  color: var(--m3-on-surface-variant);
  margin-bottom: 12px;
}
.category-manager-list-items {
  position: relative;
  max-height: 240px;
  overflow: auto;
}
.category-manager-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 8px;
  border-bottom: 1px solid var(--divider);
  cursor: pointer;
}
.category-manager-list-item--active {
  background: var(--selection-bg);
}
.category-manager-list-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.category-manager-list-title {
  font-size: 14px;
  font-weight: 500;
}
.category-manager-list-meta {
  font-size: 13px;
  color: var(--m3-on-surface-variant);
  overflow-wrap: anywhere;
}
.category-manager-drag-handle {
  cursor: grab;
  touch-action: none;
  display: grid;
  place-items: center;
  width: 32px;
  min-height: 32px;
}
.category-manager-list-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}
.category-manager-editor {
  border-top: 1px solid var(--divider);
  padding-top: 24px;
}
.category-manager-editor-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.category-manager-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.category-manager-field > span {
  font-weight: 500;
}
.category-manager-field p,
.category-manager-field .n-text {
  font-size: 13px;
  line-height: 20px;
  color: var(--m3-on-surface-variant);
}
.category-manager-rule-mode {
  display: flex;
  gap: 12px;
}
.category-manager-dir-row {
  display: flex;
  gap: 8px;
}
.category-manager-dir-row .n-input {
  flex: 1;
}
</style>
