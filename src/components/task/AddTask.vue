<script setup lang="ts">
import AppDialog from '@/components/common/AppDialog.vue'
import { hasInvalidDownloadLinks } from '@shared/utils/downloadInput'
import { invoke } from '@tauri-apps/api/core'
/** @fileoverview Add task dialog: link and torrent creation with one native submission lifecycle. */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useTaskStore } from '@/stores/task'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import { useHttpAuthStore } from '@/stores/httpAuth'
import { ADD_TASK_TYPE } from '@shared/constants'
import { detectResource } from '@shared/utils'
import {
  mergeRawUriLines,
  normalizeUriLines,
  extractDecodedFilename,
  extractMagnetDisplayName,
} from '@shared/utils/batchHelpers'
import { resolveDownloadCategory, resolveFileSetCategory } from '@shared/utils/fileCategory'
import { buildOuts } from '@shared/utils/rename'
import {
  buildEngineOptions,
  classifySubmitError,
  submitBatchItems,
  submitManualUris,
  getDownloadProxy,
} from '@/composables/useAddTaskSubmit'
import type { AddTaskForm, ManualUriSubmitResult } from '@/composables/useAddTaskSubmit'
import { isValidAria2ProxyUrl } from '@shared/utils/proxy'
import { handleTaskStart } from '@/composables/useTaskNotifyHandlers'
import { isMagnetUri } from '@/composables/useMagnetFlow'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'
import {
  getDefaultTaskProxyMode,
  getDefaultTaskProxyPassword,
  getDefaultTaskProxyServer,
  getDefaultTaskProxyUsername,
} from '@shared/utils/proxy'
import { resolveUserVisibleDownloadDir } from '@shared/utils/userVisibleDirectory'
import { findMatchingUserAgentRule, resolveUserAgent } from '@shared/utils/userAgentPolicy'

import {
  resolveUnresolvedItems,
  resolveTorrentItem,
  chooseTorrentFile as chooseTorrentFileImpl,
} from '@/composables/useAddTaskFileOps'
import {
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NIcon,
  NInputGroup,
  NCollapseTransition,
  NSpin,
  NAlert,
} from 'naive-ui'
import { useAppMessage } from '@/composables/useAppMessage'
import type { BatchItem, BatchItemKind, BtFileSelectionItem, UserAgentProfile } from '@shared/types'
import { DocumentOutline, CloseOutline, FolderOpenOutline, CloudUploadOutline, RefreshOutline } from '@vicons/ionicons5'
import { defaultMediaOptions, mediaOutputHint } from '@shared/utils/media'
import AdvancedOptions from './addtask/AdvancedOptions.vue'
import DirectoryPopover from '@/components/common/DirectoryPopover.vue'
import BtFileSelector from '@/components/task/BtFileSelector.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; afterLeave: [] }>()

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const taskStore = useTaskStore()
const preferenceStore = usePreferenceStore()
const httpAuthStore = useHttpAuthStore()
const message = useAppMessage()
const { constraint, configFieldProps, areConfigFieldsValid } = usePreferenceNumericValidation()
/** Tracks whether the user manually edited the download directory in this session. */
const dirUserModified = ref(false)

const activeTab = ref<BatchItemKind>(ADD_TASK_TYPE.URI)
const sourceDirection = ref(1)
function switchTab(target: BatchItemKind): void {
  if (target === activeTab.value) return
  sourceDirection.value = target === ADD_TASK_TYPE.TORRENT ? 1 : -1
  activeTab.value = target
}

function activateTab(value: string): void {
  if (value === ADD_TASK_TYPE.URI || value === ADD_TASK_TYPE.TORRENT) switchTab(value)
}
const showAdvanced = ref(false)
const submitting = ref(false)
const submitError = ref('')
const linksInvalid = computed(() => hasInvalidDownloadLinks(form.value.uris))
const selectedBatchIndex = ref(0)
const userAgentManuallyEdited = ref(false)
const defaultTaskProxyMode = () => getDefaultTaskProxyMode(preferenceStore.config.proxy)
const defaultTaskProxyServer = () => getDefaultTaskProxyServer(preferenceStore.config.proxy)
const defaultTaskProxyUsername = () => getDefaultTaskProxyUsername(preferenceStore.config.proxy)
const defaultTaskProxyPassword = () => getDefaultTaskProxyPassword(preferenceStore.config.proxy)

function syncDefaultTaskProxy() {
  form.value.proxyMode = defaultTaskProxyMode()
  form.value.customProxy = defaultTaskProxyServer()
  form.value.customProxyUsername = defaultTaskProxyUsername()
  form.value.customProxyPassword = defaultTaskProxyPassword()
  form.value.appProxy = preferenceStore.config.proxy
}

function syncPendingExternalMetadata() {
  form.value.referer = appStore.pendingReferer
  form.value.cookie = appStore.pendingCookie
  form.value.out = ''
  form.value.userAgent = appStore.pendingUserAgent
  form.value.requestHeaders = appStore.pendingRequestHeaders
  applyResolvedUserAgent()
}

const form = ref<AddTaskForm>({
  media: defaultMediaOptions(preferenceStore.config),
  uris: '',
  out: '',
  dir: preferenceStore.config.dir || '',
  streamMaxConnections: preferenceStore.config.streamMaxConnections,
  userAgent: '',
  authorization: '',
  httpAuthUsername: '',
  httpAuthPassword: '',
  saveHttpAuth: true,
  referer: '',
  cookie: '',
  proxyMode: defaultTaskProxyMode(),
  customProxy: defaultTaskProxyServer(),
  customProxyUsername: defaultTaskProxyUsername(),
  customProxyPassword: defaultTaskProxyPassword(),
  appProxy: preferenceStore.config.proxy,
  requestHeaders: [],
  uriRequestContexts: {},
})

const firstRegularUri = computed(
  () =>
    form.value.uris
      .split(/\r?\n/)
      .map((uri) => uri.trim())
      .find((uri) => uri && !isMagnetUri(uri)) ?? '',
)
const matchedUserAgentRule = computed(() =>
  findMatchingUserAgentRule({
    url: firstRegularUri.value,
    referer: form.value.referer,
    profiles: preferenceStore.config.userAgentProfiles,
    rules: preferenceStore.config.userAgentRules,
  }),
)
const userAgentSourceText = computed(() => {
  if (userAgentManuallyEdited.value) return t('task.ua-source-manual')
  const match = matchedUserAgentRule.value
  if (match && form.value.userAgent === match.profile.value)
    return t('task.ua-source-rule', { host: match.rule.hostPattern })
  if (appStore.pendingUserAgent && form.value.userAgent === appStore.pendingUserAgent)
    return t('task.ua-source-extension')
  return ''
})

function applyResolvedUserAgent() {
  if (userAgentManuallyEdited.value) return
  const resolved = resolveUserAgent({
    manualUserAgent: '',
    pluginUserAgent: appStore.pendingUserAgent,
    defaultUserAgent: preferenceStore.config.userAgent,
    url: firstRegularUri.value,
    referer: form.value.referer,
    profiles: preferenceStore.config.userAgentProfiles,
    rules: preferenceStore.config.userAgentRules,
  })
  form.value.userAgent = resolved.userAgent
}

// ── Computed batch accessors ────────────────────────────────────────

const batch = computed(() => appStore.pendingBatch)
const hasBatch = computed(() => batch.value.length > 0)
const fileItems = computed(() => batch.value.filter((i) => i.kind !== 'uri'))
const selectedItem = computed(() => fileItems.value[selectedBatchIndex.value] ?? null)
const selectedTorrentFiles = computed<BtFileSelectionItem[]>(() =>
  (selectedItem.value?.torrentMeta?.files ?? []).map((file) => {
    const pathParts = file.path.split(/[/\\]/)
    return {
      index: Number(file.index),
      name: pathParts[pathParts.length - 1] || file.path,
      path: file.path,
      length: Number(file.length),
    }
  }),
)
const selectedFileIndices = computed<number[]>({
  get: () => selectedItem.value?.selectedFileIndices ?? [],
  set: (indices) => {
    if (selectedItem.value) selectedItem.value.selectedFileIndices = indices
  },
})
const torrentItemsReady = computed(() =>
  fileItems.value.every((item) => item.inspectionState === 'ready' && Boolean(item.selectedFileIndices?.length)),
)
const uriOptionsValid = computed(
  () => !form.value.uris.trim() || areConfigFieldsValid({ streamMaxConnections: form.value.streamMaxConnections }),
)
const canSubmit = computed(
  () =>
    (normalizeUriLines(form.value.uris).length > 0 || fileItems.value.length > 0) &&
    !linksInvalid.value &&
    uriOptionsValid.value &&
    torrentItemsReady.value,
)

// Sync download settings with the latest preference every time the dialog
// opens. AddTask is kept mounted (`:show` not `v-if`), so form values would
// otherwise be stale if the user changes defaults in preferences.
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      form.value.media = defaultMediaOptions(preferenceStore.config)
      // When classification is enabled, clear the dir so user sees it's optional;
      // otherwise sync from preferences as usual.
      if (preferenceStore.config.fileCategoryEnabled) {
        form.value.dir = ''
      } else {
        form.value.dir = preferenceStore.config.dir || form.value.dir
      }
      form.value.streamMaxConnections = preferenceStore.config.streamMaxConnections
      syncDefaultTaskProxy()
      // Reset the manual-override flag each time the dialog opens
      dirUserModified.value = false

      syncPendingExternalMetadata()
    }
  },
)

watch(
  () => preferenceStore.config.proxy,
  () => {
    if (props.show) syncDefaultTaskProxy()
  },
  { deep: true },
)

watch(
  [
    firstRegularUri,
    () => form.value.referer,
    () => preferenceStore.config.userAgent,
    () => preferenceStore.config.userAgentProfiles,
    () => preferenceStore.config.userAgentRules,
  ],
  () => {
    if (props.show) applyResolvedUserAgent()
  },
  { deep: true },
)

/** Whether file classification is currently enabled in preferences. */
const categoryEnabled = computed(() => preferenceStore.config.fileCategoryEnabled)

/** Dynamic label: switches between original 'Save to' and 'Custom Path' based on classification state. */
const dirLabel = computed(() => (categoryEnabled.value ? t('task.task-custom-dir') : t('task.task-dir')))

function resolveCategoryMatches(): Map<string, { label: string; directory: string }> {
  const uris = normalizeUriLines(form.value.uris).filter((uri) => !isMagnetUri(uri))
  const outs = uris.length > 1 && form.value.out ? buildOuts(uris, form.value.out) : []
  const matched = new Map<string, { label: string; directory: string }>()

  for (const [index, uri] of uris.entries()) {
    const context = form.value.uriRequestContexts?.[uri]
    const category = resolveDownloadCategory(
      mediaOutputHint(
        uri,
        outs[index] || form.value.out || extractDecodedFilename(uri),
        form.value.media?.mode,
        form.value.media?.format,
      ),
      preferenceStore.config.fileCategories,
      {
        urls: [uri, context?.finalUrl ?? '', context?.url ?? '', context?.referer ?? ''],
      },
    )
    if (!category) continue
    const label = category.builtIn ? t(`preferences.${category.label}`) : category.label
    matched.set(category.directory, { label, directory: category.directory })
  }

  return matched
}

function resolveSelectedTorrentCategory(): { label: string; directory: string } | undefined {
  const item = selectedItem.value
  if (!item?.torrentMeta) return undefined

  const selectedIndices = new Set(item.selectedFileIndices ?? [])
  const category = resolveFileSetCategory(
    item.torrentMeta.files
      .filter((file) => selectedIndices.has(Number(file.index)) && Number(file.length) > 0)
      .map((file) => ({ path: file.path })),
    preferenceStore.config.fileCategories,
    { urls: [item.source] },
  )
  if (!category) return undefined

  return {
    label: category.builtIn ? t(`preferences.${category.label}`) : category.label,
    directory: category.directory,
  }
}

const categoryMatches = computed(() => {
  if (!categoryEnabled.value || dirUserModified.value) return new Map<string, { label: string; directory: string }>()
  if (activeTab.value === ADD_TASK_TYPE.TORRENT) {
    const category = resolveSelectedTorrentCategory()
    return category ? new Map([[category.directory, category]]) : new Map()
  }
  return resolveCategoryMatches()
})

const categoryMatchPreview = computed(() => {
  const matched = categoryMatches.value
  if (matched.size !== 1) return undefined
  return matched.values().next().value
})

const displayedDir = computed(() => {
  if (dirUserModified.value) return form.value.dir
  return categoryMatchPreview.value?.directory ?? form.value.dir
})

const categoryPreviewText = computed(() => {
  if (!categoryEnabled.value) return ''
  if (dirUserModified.value) return t('task.category-hint-overridden')

  if (activeTab.value === ADD_TASK_TYPE.TORRENT) {
    if (!selectedItem.value) return t('task.category-hint-active')
    const matched = categoryMatchPreview.value
    return matched ? t('task.category-match-single', { category: matched.label }) : t('task.category-match-none')
  }

  const uris = normalizeUriLines(form.value.uris).filter((uri) => !isMagnetUri(uri))
  if (uris.length === 0) return t('task.category-hint-active')

  const matched = categoryMatchPreview.value
  if (matched) return t('task.category-match-single', { category: matched.label })

  const matchedSize = categoryMatches.value.size
  if (matchedSize === 0) return t('task.category-match-none')
  if (matchedSize > 1) return t('task.category-match-multiple')
  return t('task.category-match-none')
})

/** Handles user manually editing the dir field. */
function onDirInput(value: string) {
  form.value.dir = value
  // Empty = user hasn't specified a custom path (auto-classification will handle it).
  // Non-empty = explicit user override, classification rules will be skipped.
  dirUserModified.value = value.trim().length > 0
}

// ── Lifecycle ───────────────────────────────────────────────────────

onMounted(async () => {
  if (!form.value.dir) {
    try {
      const resolvedDir = await resolveUserVisibleDownloadDir({ configuredDir: preferenceStore.config.dir })
      form.value.dir = resolvedDir.path
      logger.info('AddTask.dir', `resolved source=${resolvedDir.source} fallback=${resolvedDir.usedFallback}`)
    } catch (e) {
      logger.debug('AddTask.dir', e)
      form.value.dir = '~/Downloads'
    }
  }
})

// External input takes precedence over a clipboard read, even after URI entries
// have been drained into the form. Asynchronous inspection never selects a tab.
let batchReceived = false
let draftGeneration = 0

watch(
  () => props.show,
  async (visible) => {
    const generation = ++draftGeneration
    if (!visible) {
      batchReceived = false
      return
    }
    selectedBatchIndex.value = 0

    if (hasBatch.value) {
      batchReceived = true
      // Flush URI batch items into the editable textarea via normalized merge
      const uriItems = batch.value.filter((i) => i.kind === 'uri')
      if (uriItems.length > 0) {
        form.value.uris = mergeRawUriLines(
          form.value.uris,
          uriItems.map((i) => i.payload),
        )
        form.value.uriRequestContexts = Object.fromEntries(
          uriItems.flatMap((i) => (i.browserContext ? [[i.payload, i.browserContext]] : [])),
        )
        appStore.pendingBatch = batch.value.filter((i) => i.kind !== 'uri')
      }
      // Auto-switch to Torrent tab when file items are present
      if (fileItems.value.length > 0) {
        switchTab(ADD_TASK_TYPE.TORRENT)
      } else {
        switchTab(ADD_TASK_TYPE.URI)
      }
      await localResolveUnresolvedItems()
    } else {
      // Keep the tab selected by a newly arrived batch.
      if (!batchReceived) switchTab(ADD_TASK_TYPE.URI)
      // No batch — check clipboard for URIs
      try {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
        const text = await readText()
        if (generation !== draftGeneration || !props.show || batchReceived) return
        if (text && detectResource(text, preferenceStore.config.clipboard)) {
          form.value.uris = text.trim()
        }
      } catch (e) {
        logger.debug('AddTask.readClipboard', e)
      }
    }
  },
)

// Watch for new batch items added while dialog is already open (drag-drop, deep link).
// Replace (not merge) the textarea — batch content takes priority over any clipboard
// auto-fill that the show watcher may have already written.
watch(
  () => batch.value.length,
  async (newLen, oldLen) => {
    if (!props.show || newLen <= oldLen) return
    batchReceived = true
    // Snapshot newly arrived items before any drain/resolve mutates the batch.
    const newlyArrived = batch.value.slice(oldLen)
    const uriItems = batch.value.filter((i) => i.kind === 'uri')
    if (uriItems.length > 0) {
      form.value.uris = mergeRawUriLines(
        '',
        uriItems.map((i) => i.payload),
      )
      form.value.uriRequestContexts = Object.fromEntries(
        uriItems.flatMap((i) => (i.browserContext ? [[i.payload, i.browserContext]] : [])),
      )
      syncPendingExternalMetadata()
      appStore.pendingBatch = batch.value.filter((i) => i.kind !== 'uri')
    }
    // Select the incoming source before starting its asynchronous inspection.
    const hasNewFiles = newlyArrived.some((i) => i.kind !== 'uri')
    const hasNewUris = newlyArrived.some((i) => i.kind === 'uri')
    if (hasNewFiles) {
      switchTab(ADD_TASK_TYPE.TORRENT)
    } else if (hasNewUris) {
      switchTab(ADD_TASK_TYPE.URI)
    }
    // Resolve file metadata asynchronously (doesn't affect tab choice).
    await localResolveUnresolvedItems()
  },
)

// ── File resolution (delegated to useAddTaskFileOps) ────────────────

async function localResolveUnresolvedItems() {
  await resolveUnresolvedItems(batch.value, t, getDownloadProxy(preferenceStore.config.proxy))
}

async function chooseTorrentFile() {
  await chooseTorrentFileImpl({
    t,
    batch,
    fileItems,
    selectedBatchIndex,
    setPendingBatch: (items) => {
      appStore.pendingBatch = items
    },
    showWarning: (msg) => message.warning(msg),
  })
}

async function retryTorrent(item: BatchItem) {
  await resolveTorrentItem(item, t, getDownloadProxy(preferenceStore.config.proxy))
}

async function chooseDirectory() {
  try {
    const selected = await openDialog({ directory: true })
    if (typeof selected === 'string') {
      form.value.dir = selected
      // Only mark as user-override when classification is active
      dirUserModified.value = categoryEnabled.value && selected.trim().length > 0
    }
  } catch (e) {
    logger.debug('AddTask.chooseDirectory', e)
  }
}

function onDirectorySelect(dir: string) {
  form.value.dir = dir
  dirUserModified.value = categoryEnabled.value && dir.trim().length > 0
}

function onUserAgentInput(value: string) {
  userAgentManuallyEdited.value = true
  form.value.userAgent = value
}

function selectUserAgentProfile(profile: UserAgentProfile) {
  userAgentManuallyEdited.value = true
  form.value.userAgent = profile.value
  preferenceStore.recordRecentUserAgentProfile(profile.id)
}

async function removeBatchItem(item: BatchItem) {
  if (submitting.value) return
  try {
    if (item.browserContext?.requestId) await invoke('cancel_download_request', { id: item.browserContext.requestId })
  } catch (error) {
    message.error(getErrorMessage(error))
    return
  }
  appStore.pendingBatch = batch.value.filter((i) => i !== item)
  selectedBatchIndex.value = Math.min(selectedBatchIndex.value, Math.max(0, fileItems.value.length - 1))
}

// ── Submit ───────────────────────────────────────────────────────────

async function handleClose(userDismiss = true) {
  if (submitting.value && userDismiss) return
  {
    const ids = new Set(
      batch.value.flatMap((item) => (item.browserContext?.requestId ? [item.browserContext.requestId] : [])),
    )
    try {
      await Promise.all([...ids].map((id) => invoke('cancel_download_request', { id })))
    } catch (error) {
      message.error(getErrorMessage(error))
      return
    }
  }
  emit('close')
}

function handleAfterLeave() {
  if (props.show) return
  submitError.value = ''
  appStore.finishAddTaskClose()
  emit('afterLeave')
  Object.assign(form.value, {
    uris: '',
    out: '',
    userAgent: '',
    authorization: '',
    httpAuthUsername: '',
    httpAuthPassword: '',
    saveHttpAuth: true,
    referer: '',
    cookie: '',
    customProxyUsername: '',
    customProxyPassword: '',
    requestHeaders: [],
    uriRequestContexts: {},
  })
  syncDefaultTaskProxy()
  userAgentManuallyEdited.value = false
  submitting.value = false
  selectedBatchIndex.value = 0
}

async function handleSubmit() {
  if (submitting.value || !canSubmit.value) return
  submitting.value = true
  submitError.value = ''

  try {
    // Validate custom proxy before building options
    if (form.value.proxyMode === 'manual' && form.value.customProxy) {
      if (!isValidAria2ProxyUrl(form.value.customProxy)) {
        message.error(t('task.proxy-unsupported-protocol'), { closable: true })
        submitting.value = false
        return
      }
    }

    // When dir field is empty (user left it blank for auto-classification),
    // fall back to the global default dir so aria2 always has a valid path.
    const effectiveForm = {
      ...form.value,
      dir: form.value.dir.trim() || preferenceStore.config.dir,
      appProxy: preferenceStore.config.proxy,
      defaultUserAgent: preferenceStore.config.userAgent,
      userAgentProfiles: preferenceStore.config.userAgentProfiles,
      userAgentRules: preferenceStore.config.userAgentRules,
    }
    const options = buildEngineOptions(effectiveForm)
    const fileCategory = {
      enabled: preferenceStore.config.fileCategoryEnabled && !dirUserModified.value,
      categories: preferenceStore.config.fileCategories,
    }
    let manualResult: ManualUriSubmitResult = { submittedTaskNames: [], magnetGids: [], magnetFailures: [] }

    if (hasBatch.value) {
      await submitBatchItems(batch.value, options, taskStore, fileCategory)
    }
    if (form.value.uris.trim()) {
      manualResult = await submitManualUris(effectiveForm, taskStore, fileCategory)
    }

    const failedCount = batch.value.filter((i) => i.status === 'failed').length + manualResult.magnetFailures.length
    if (failedCount > 0) {
      message.warning(`${failedCount} ${t('task.failed') || 'failed'}`, { closable: true })
    } else {
      // ── Collect task names BEFORE handleClose clears form state ──
      const taskNames: string[] = []
      for (const item of batch.value) {
        if (item.status === 'submitted') {
          taskNames.push(item.displayName)
        }
      }
      taskNames.push(...manualResult.submittedTaskNames)
      const allUris = normalizeUriLines(form.value.uris)
      const magnetUris = allUris.filter(isMagnetUri)
      for (let i = 0; i < manualResult.magnetGids.length; i++) {
        const dn = magnetUris[i] ? extractMagnetDisplayName(magnetUris[i]) : ''
        taskNames.push(dn || t('task.magnet-task'))
      }

      if (effectiveForm.saveHttpAuth && effectiveForm.httpAuthUsername.trim()) {
        const firstHttpUri = normalizeUriLines(effectiveForm.uris).find((uri) => /^https?:\/\//i.test(uri))
        if (firstHttpUri) {
          try {
            await httpAuthStore.saveCredential({
              url: firstHttpUri,
              username: effectiveForm.httpAuthUsername,
              password: effectiveForm.httpAuthPassword,
            })
            message.success(t('task.task-http-auth-saved'))
          } catch (err) {
            logger.warn('AddTask.httpAuth', `credential save failed: ${err}`)
          }
        }
      }

      await handleClose(false)

      // ── Record directory for the recent-folders popover ────────
      const effectiveDir = form.value.dir.trim() || preferenceStore.config.dir
      if (effectiveDir) {
        preferenceStore.recordHistoryDirectory(effectiveDir)
      }

      // ── Start notification (aggregated) ────────────────────────
      handleTaskStart(taskNames, {
        messageInfo: message.info,
        t,
      })

      if (preferenceStore.config.newTaskShowDownloading !== false) {
        router.push({ path: '/task/all' }).catch(() => {})
      }
    }
  } catch (e: unknown) {
    const category = classifySubmitError(e)
    const errMsg = getErrorMessage(e, {
      fallback: t('task.error-unknown'),
      labels: { Aria2: t('task.error-aria2-next') },
    })
    submitError.value = errMsg
    logger.error('AddTask.submit', e)
    if (category === 'engine-not-ready') {
      message.error(t('app.engine-not-ready'), { closable: true })
    } else if (category === 'duplicate') {
      message.warning(errMsg, { closable: true })
    } else {
      message.error(errMsg, { closable: true })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    :show="props.show"
    height="640px"
    :title="t('task.new-task-title')"
    :busy="submitting"
    :auto-focus="true"
    @close="handleClose"
    @after-leave="handleAfterLeave"
  >
    <NForm :show-feedback="false" label-placement="top" :disabled="submitting" class="download-form">
      <NTabs
        :value="activeTab"
        type="line"
        animated
        pane-wrapper-class="task-source-panes"
        :pane-wrapper-style="{ '--task-source-direction': sourceDirection }"
        @update:value="activateTab"
      >
        <!-- ── URI Tab ──────────────────────────────────────── -->
        <NTabPane
          :name="ADD_TASK_TYPE.URI"
          :tab="t('task.uri-task')"
          display-directive="show"
          :inert="activeTab !== ADD_TASK_TYPE.URI"
        >
          <div class="tab-pane-content">
            <NFormItem
              :label="t('task.download-links')"
              :show-feedback="linksInvalid"
              :validation-status="linksInvalid ? 'error' : undefined"
              :feedback="linksInvalid ? t('task.invalid-links') : undefined"
            >
              <NInput
                v-model:value="form.uris"
                class="uri-input"
                type="textarea"
                :rows="3"
                :input-props="{ 'aria-label': t('task.download-links'), 'aria-invalid': linksInvalid }"
                :placeholder="t('task.uri-task-tips') || 'One URL per line'"
              />
            </NFormItem>
          </div>
        </NTabPane>

        <!-- ── Torrent Tab ─────────────────────────────────── -->
        <NTabPane
          :name="ADD_TASK_TYPE.TORRENT"
          :tab="t('task.torrent-task')"
          display-directive="show"
          :inert="activeTab !== ADD_TASK_TYPE.TORRENT"
        >
          <div class="tab-pane-content">
            <!-- Torrent panel: animated batch list + file detail -->
            <div v-if="fileItems.length > 0" class="torrent-panel">
              <!-- The same keyed items remain mounted during their leave transition. -->
              <TransitionGroup
                tag="div"
                name="torrent-item"
                class="batch-list"
                @before-leave="(element) => element.setAttribute('inert', '')"
                @before-enter="(element) => element.removeAttribute('inert')"
                @leave-cancelled="(element) => element.removeAttribute('inert')"
              >
                <div
                  v-for="(item, idx) in fileItems"
                  :key="item.id"
                  class="batch-item"
                  :class="{ 'batch-item-selected': idx === selectedBatchIndex }"
                >
                  <button
                    type="button"
                    class="batch-item-select"
                    :aria-pressed="idx === selectedBatchIndex"
                    :title="item.displayName"
                    @click="selectedBatchIndex = idx"
                  >
                    <NIcon :size="18"><DocumentOutline /></NIcon>
                    <span class="batch-item-copy">
                      <span class="batch-item-name">{{ item.displayName }}</span>
                      <span v-if="item.inspectionState === 'failed'" class="batch-item-error">{{ item.error }}</span>
                    </span>
                  </button>
                  <div class="batch-item-status">
                    <Transition
                      name="fade"
                      @before-leave="(element) => element.setAttribute('inert', '')"
                      @before-enter="(element) => element.removeAttribute('inert')"
                      @leave-cancelled="(element) => element.removeAttribute('inert')"
                    >
                      <span
                        v-if="item.inspectionState === 'reading' || item.inspectionState === 'inspecting'"
                        key="loading"
                        class="batch-item-indicator"
                        role="status"
                        :aria-label="`${item.displayName}: ${t('about.loading')}`"
                        :title="t('about.loading')"
                      >
                        <NSpin :size="16" />
                      </span>
                      <NButton
                        v-else-if="item.inspectionState === 'failed'"
                        key="retry"
                        quaternary
                        size="small"
                        :disabled="submitting"
                        :aria-label="`${t('app.retry')}: ${item.displayName}`"
                        :title="t('app.retry')"
                        @click="retryTorrent(item)"
                      >
                        <template #icon
                          ><NIcon :size="16"><RefreshOutline /></NIcon
                        ></template>
                      </NButton>
                    </Transition>
                  </div>
                  <NButton
                    quaternary
                    size="small"
                    class="batch-item-remove"
                    :aria-label="`${t('task.delete-task')}: ${item.displayName}`"
                    @click="removeBatchItem(item)"
                  >
                    <template #icon
                      ><NIcon :size="16"><CloseOutline /></NIcon
                    ></template>
                  </NButton>
                </div>
              </TransitionGroup>

              <!-- Add more files button -->
              <NButton size="small" quaternary class="add-torrent-button" @click="chooseTorrentFile">
                <template #icon>
                  <NIcon><CloudUploadOutline /></NIcon>
                </template>
                {{ t('task.add-torrent') }}
              </NButton>

              <div class="torrent-inspection">
                <Transition
                  name="fade"
                  @before-leave="(element) => element.setAttribute('inert', '')"
                  @before-enter="(element) => element.removeAttribute('inert')"
                  @leave-cancelled="(element) => element.removeAttribute('inert')"
                >
                  <div
                    v-if="selectedItem?.inspectionState === 'ready' && selectedItem.torrentMeta"
                    :key="selectedItem.id"
                    class="torrent-inspection-result"
                  >
                    <BtFileSelector
                      v-model:selected-indices="selectedFileIndices"
                      :files="selectedTorrentFiles"
                      :max-height="200"
                    />
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Upload zone: shown when no torrents loaded -->
            <button v-if="fileItems.length === 0" type="button" class="torrent-upload-zone" @click="chooseTorrentFile">
              <NIcon :size="36" :depth="3"><CloudUploadOutline /></NIcon>
              <span class="torrent-upload-text">
                {{ t('task.select-torrent') }}
              </span>
            </button>
          </div>
        </NTabPane>
      </NTabs>

      <!-- ── Download settings: always visible ──────────────── -->
      <div class="download-settings">
        <NFormItem :label="dirLabel">
          <div style="width: 100%">
            <NInputGroup>
              <NInput
                :value="displayedDir"
                style="flex: 1"
                :placeholder="categoryEnabled ? t('task.category-dir-placeholder') : ''"
                @update:value="onDirInput"
              />
              <NButton :aria-label="t('task.choose-folder')" @click="chooseDirectory">
                <template #icon>
                  <NIcon><FolderOpenOutline /></NIcon>
                </template>
              </NButton>
              <DirectoryPopover @select="onDirectorySelect" />
            </NInputGroup>
            <NCollapseTransition :show="!!categoryPreviewText">
              <p class="field-hint">{{ categoryPreviewText }}</p>
            </NCollapseTransition>
          </div>
        </NFormItem>
        <NFormItem :label="t('task.task-out')">
          <NInput v-model:value="form.out" :placeholder="t('task.task-out-tips')" :autofocus="false" />
        </NFormItem>
        <div
          class="task-advanced"
          :class="{ 'task-advanced--visible': activeTab === ADD_TASK_TYPE.URI }"
          :inert="activeTab !== ADD_TASK_TYPE.URI"
        >
          <div class="task-advanced-content">
            <AdvancedOptions
              v-model:show="showAdvanced"
              v-model:authorization="form.authorization"
              v-model:http-auth-username="form.httpAuthUsername"
              v-model:http-auth-password="form.httpAuthPassword"
              v-model:save-http-auth="form.saveHttpAuth"
              v-model:referer="form.referer"
              v-model:cookie="form.cookie"
              v-model:proxy-mode="form.proxyMode"
              v-model:custom-proxy="form.customProxy"
              v-model:custom-proxy-username="form.customProxyUsername"
              v-model:custom-proxy-password="form.customProxyPassword"
              :source-url="firstRegularUri"
              :user-agent="form.userAgent"
              :user-agent-source="userAgentSourceText"
              :user-agent-profiles="preferenceStore.config.userAgentProfiles"
              :user-agent-rules="preferenceStore.config.userAgentRules"
              :recent-user-agent-profile-ids="preferenceStore.config.recentUserAgentProfileIds"
              :media-mode="form.media?.mode"
              @update:media-mode="
                (mode) => {
                  if (form.media) form.media.mode = mode
                }
              "
              @update:user-agent="onUserAgentInput"
              @select-user-agent-profile="selectUserAgentProfile"
            >
              <NFormItem
                :label="t('task.task-connections')"
                v-bind="configFieldProps('streamMaxConnections', form.streamMaxConnections)"
              >
                <NInputNumber
                  v-model:value="form.streamMaxConnections"
                  :min="constraint('streamMaxConnections').min"
                  :max="constraint('streamMaxConnections').max"
                  style="width: 120px"
                />
              </NFormItem>
            </AdvancedOptions>
          </div>
        </div>
      </div>
    </NForm>
    <NAlert v-if="submitError" type="error" role="alert">{{ submitError }}</NAlert>
    <template #footer>
      <NButton @click="() => handleClose()">{{ t('app.cancel') }}</NButton>
      <NButton
        data-testid="submit-button"
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        {{ t('task.magnet-start-download') }}
      </NButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.download-form :deep(.task-source-panes) {
  --task-source-step: 32px;
}
.download-form :deep(.task-source-panes:dir(rtl)) {
  --task-source-step: -32px;
}
/* Naive UI owns the transition lifecycle and height. Its public pane styles
   supply direction for both clicks and external inputs without instance writes. */
.download-form :deep(.task-source-panes .n-tab-pane:is(.next-transition-enter-from, .prev-transition-enter-from)) {
  transform: translateX(calc(var(--task-source-step) * var(--task-source-direction)));
}
.download-form :deep(.task-source-panes .n-tab-pane:is(.next-transition-leave-to, .prev-transition-leave-to)) {
  transform: translateX(calc(-1 * var(--task-source-step) * var(--task-source-direction)));
}
.task-advanced {
  /* Preserve form state; NCollapseTransition unmounts its hidden subtree. */
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.task-advanced--visible {
  grid-template-rows: 1fr;
  opacity: 1;
}
.task-advanced-content {
  min-height: 0;
  overflow: hidden;
}
.tab-pane-content {
  min-height: 144px;
  padding-top: 12px;
}
.uri-input :deep(textarea) {
  overflow-wrap: anywhere;
}
.field-hint {
  font-size: 13px;
  color: var(--m3-on-surface-variant);
  line-height: 20px;
  margin-top: 8px;
}
.torrent-panel {
  display: grid;
  gap: 12px;
  padding-block: 8px;
}
.batch-list {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 2px;
}
.batch-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-inline-end: 4px;
  border-radius: 6px;
  transition: background-color 120ms ease;
}
.batch-item-selected {
  background: var(--selection-bg);
}
.batch-item-select {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  min-height: 40px;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--m3-on-surface);
  text-align: start;
  cursor: pointer;
}
.batch-item-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.batch-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.batch-item-error {
  color: var(--m3-error);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.batch-item-status {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
}
.batch-item-status > * {
  grid-area: 1 / 1;
}
.batch-item-status :deep(.n-button) {
  width: 28px;
  padding-inline: 0;
}
.batch-item-status :deep(.fade-leave-active) {
  pointer-events: none;
}
.batch-item-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}
.batch-item-select:focus-visible {
  outline-offset: -2px;
}
.batch-item-remove:focus-visible {
  outline-offset: -2px;
}
.add-torrent-button {
  justify-self: start;
}
.torrent-item-move,
.torrent-item-enter-active,
.torrent-item-leave-active {
  transition:
    transform 180ms ease,
    opacity 140ms ease;
}
.torrent-item-enter-from,
.torrent-item-leave-to {
  opacity: 0;
}
.torrent-item-leave-active {
  position: absolute;
  inset-inline: 2px;
  pointer-events: none;
}
.torrent-inspection {
  display: grid;
}
.torrent-inspection:empty {
  display: none;
}
.torrent-inspection > * {
  grid-area: 1 / 1;
  min-width: 0;
}

.torrent-upload-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 138px;
  border: 1px dashed var(--m3-outline-variant);
  border-radius: 6px;
  color: var(--m3-on-surface-variant);
}
.torrent-upload-zone:hover {
  border-color: var(--m3-primary);
}
.download-settings {
  padding-top: 20px;
}
.download-form :deep(.n-form-item) {
  margin-block-end: 22px;
}
.download-form :deep(.n-form-item-label) {
  font-weight: 500;
  padding-block: 0 6px;
}
.download-form :deep(.n-form-item-feedback-wrapper) {
  min-height: 0;
}
.download-form :deep(.n-input-group) {
  align-items: stretch;
}
.download-form :deep(.n-input-group > .n-button) {
  height: auto;
  min-height: 36px;
}
.add-torrent-button {
  margin-block: 8px;
}
</style>
