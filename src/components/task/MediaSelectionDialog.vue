<script setup lang="ts">
import AppDialog from '@/components/common/AppDialog.vue'
/** @fileoverview Native media selection, output options and retry. */
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NForm, NAlert, NSpin } from 'naive-ui'
import { useTaskStore } from '@/stores/task'
import { getOption, confirmMedia } from '@/api/aria2'
import {
  defaultMediaOptions,
  readMediaOptions,
  mediaDuration,
  mediaEngineOptions,
  canSelectMedia,
} from '@shared/utils/media'
import { getTaskName } from '@shared/utils/task'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { logger } from '@shared/logger'
import type { Aria2Task } from '@shared/types'
import MediaOptions from './MediaOptions.vue'

const props = defineProps<{ show: boolean; gid: string }>()
const emit = defineEmits<{ close: []; afterLeave: [] }>()
const { t } = useI18n()
const tasks = useTaskStore()
const task = ref<Aria2Task | null>(null)
const form = ref(defaultMediaOptions())
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const ready = ref(false)
let generation = 0
const media = computed(() => task.value?.media)
const title = computed(() =>
  media.value?.live === 'true' ? t('media.recording-options') : t('media.download-options'),
)
const output = computed(() => getTaskName(task.value))

async function load(gid: string) {
  const request = ++generation
  loading.value = true
  ready.value = false
  error.value = ''
  try {
    const current = await tasks.fetchTaskStatus(gid)
    if (request !== generation || !props.show) return
    if (!canSelectMedia(current)) {
      emit('close')
      return
    }
    task.value = current
    if (!current.media?.tracks.length) throw new Error('No media tracks are available')
    const options = await getOption({ gid })
    if (request !== generation || !props.show) return
    form.value = readMediaOptions(options, current.media.tracks)
    ready.value = true
  } catch (cause) {
    if (request === generation && props.show) error.value = getErrorMessage(cause)
    logger.warn('MediaSelection.load', getErrorMessage(cause))
  } finally {
    if (request === generation) loading.value = false
  }
}

watch(
  () => [props.gid, props.show] as const,
  ([gid, visible]) => {
    generation++
    if (gid && visible) {
      task.value = null
      submitting.value = false
      void load(gid)
    }
  },
  { immediate: true },
)

async function confirm() {
  if (!task.value || !ready.value || submitting.value) return
  const request = generation
  const gid = props.gid
  submitting.value = true
  error.value = ''
  const submittedOptions = { ...form.value }
  try {
    const current = await tasks.fetchTaskStatus(gid)
    if (request !== generation || !props.show) return
    if (!canSelectMedia(current)) {
      emit('close')
      return
    }
    const options = {
      ...mediaEngineOptions({ ...submittedOptions, pauseAfterProbe: 'false' }),
    }
    await confirmMedia(current.gid, options)
    await tasks.fetchList()
    if (request === generation) emit('close')
  } catch (cause) {
    if (request === generation) error.value = getErrorMessage(cause)
    logger.warn('MediaSelection.confirm', getErrorMessage(cause))
  } finally {
    if (request === generation) submitting.value = false
  }
}

function dismiss() {
  if (submitting.value) return
  emit('close')
}

onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <AppDialog
    :show="show"
    :title="title"
    size="regular"
    :busy="submitting"
    @close="dismiss"
    @after-leave="emit('afterLeave')"
  >
    <div class="selection-summary">
      <div class="selection-name" :title="output">{{ ready ? output : '' }}</div>
      <div class="selection-meta">
        {{ media ? (media.live === 'true' ? t('media.live') : mediaDuration(media.duration)) : '' }}
      </div>
    </div>
    <NAlert v-if="error" type="error" class="selection-error">{{ error }}</NAlert>
    <div class="selection-stage">
      <Transition name="selection-content">
        <div v-if="loading" key="loading" class="selection-loading" role="status" aria-busy="true">
          <NSpin size="small" /> {{ t('media.probing') }}
        </div>
        <NForm v-else-if="ready && media" key="media" label-placement="top" :disabled="submitting">
          <MediaOptions v-model="form" :tracks="media.tracks" :live="media.live === 'true'" :disabled="submitting" />
          <NAlert v-if="form.subtitles !== 'none' && form.format === 'mp4'" type="info">{{
            t('media.container-help')
          }}</NAlert>
          <NAlert v-if="task && Number(media.completedDuration) > 0" type="warning">{{
            t('media.selection-help')
          }}</NAlert>
        </NForm>
      </Transition>
    </div>
    <template #footer>
      <NButton :disabled="submitting" @click="dismiss">{{ t('task.magnet-choose-later') }}</NButton>
      <NButton v-if="error && !ready" :loading="loading" @click="load(gid)">{{ t('task.retry-task') }}</NButton>
      <NButton v-else type="primary" :loading="submitting" :disabled="!ready" @click="confirm">{{
        media?.live === 'true' ? t('media.start-recording') : t('task.magnet-start-download')
      }}</NButton>
    </template>
  </AppDialog>
</template>
