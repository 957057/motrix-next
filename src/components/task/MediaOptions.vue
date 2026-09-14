<script setup lang="ts">
/** @fileoverview Contextual controls for a natively inspected media presentation. */
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NFormItem, NSelect, NInputNumber, NRadioGroup, NRadioButton, NRadio, NCollapseTransition } from 'naive-ui'
import type { Aria2MediaTrack } from '@shared/types'
import { mediaTrackLabel, type MediaOptions } from '@shared/utils/media'

const model = defineModel<MediaOptions>({ required: true })
const props = defineProps<{ tracks: Aria2MediaTrack[]; live: boolean; disabled?: boolean }>()
const { t, locale } = useI18n()
const hasVideo = computed(() => props.tracks.some((track) => ['video', 'muxed'].includes(track.type)))
const hasAudio = computed(() => props.tracks.some((track) => ['audio', 'muxed'].includes(track.type)))
const hasSubtitles = computed(() => props.tracks.some((track) => track.type === 'subtitle'))
const content = computed({
  get: () => (model.value.video === 'none' ? 'audio' : model.value.audio === 'none' ? 'video' : 'both'),
  set: (value: string) => {
    model.value.video = value === 'audio' ? 'none' : 'best'
    model.value.audio = value === 'video' ? 'none' : 'best'
  },
})
const contentOptions = computed(() => [
  { value: 'both', label: t('media.video-audio') },
  { value: 'audio', label: t('media.audio-only') },
  { value: 'video', label: t('media.video-only') },
])
const selectedVideo = computed(() =>
  model.value.video === 'none'
    ? undefined
    : (props.tracks.find((track) => track.id === model.value.video) ??
      props.tracks.find((track) => track.selected === 'true' && ['video', 'muxed'].includes(track.type))),
)
watch(selectedVideo, (video) => {
  if (model.value.audio === 'none' || model.value.audio === 'best') return
  const audio = props.tracks.find((track) => track.id === model.value.audio)
  if ((video?.type === 'muxed' && audio?.id !== video.id) || (video?.type === 'video' && audio?.type === 'muxed'))
    model.value.audio = 'best'
})
function videoHeight(id: string) {
  return props.tracks.find((track) => track.id === id)?.height
}

function choices(type: 'video' | 'audio' | 'subtitle') {
  return [
    ...(type === 'subtitle' ? [{ value: 'none', label: t('media.none') }] : []),
    { value: 'best', label: t('media.best') },
    ...props.tracks
      .filter((track) => {
        if (type === 'audio' && selectedVideo.value?.type === 'muxed') return track.id === selectedVideo.value.id
        return (
          track.type === type ||
          (track.type === 'muxed' && (type === 'video' || (type === 'audio' && model.value.video === 'none')))
        )
      })
      .map((track) => ({ value: track.id, label: mediaTrackLabel(track, locale.value) })),
  ]
}
watch(
  () => props.tracks,
  () => {
    if (!hasVideo.value) model.value.video = 'none'
    if (!hasAudio.value) model.value.audio = 'none'
    if (!hasSubtitles.value) model.value.subtitles = 'none'
  },
  { immediate: true },
)
const durationPresets = [0, 900, 1800, 3600]
const customDuration = ref(!durationPresets.includes(model.value.recordTime))
const durationPreset = computed({
  get: () => (customDuration.value ? -1 : model.value.recordTime),
  set: (value: number) => {
    customDuration.value = value === -1
    model.value.recordTime = value === -1 ? model.value.recordTime || 60 : value
  },
})
const durationOptions = computed(() => [
  { value: 0, label: t('media.unlimited') },
  ...durationPresets
    .filter((seconds) => seconds > 0)
    .map((seconds) => ({
      value: seconds,
      label: new Intl.NumberFormat(locale.value, {
        style: 'unit',
        unit: seconds >= 3600 ? 'hour' : 'minute',
        unitDisplay: 'short',
      }).format(seconds >= 3600 ? seconds / 3600 : seconds / 60),
    })),
  { value: -1, label: t('media.custom') },
])
</script>

<template>
  <div class="media-fields">
    <NFormItem
      v-if="hasVideo && hasAudio"
      key="content"
      class="media-field-wide"
      :label="t('media.content')"
      :show-feedback="false"
    >
      <NRadioGroup v-model:value="content" :disabled="disabled"
        ><NRadioButton v-for="option in contentOptions" :key="option.value" :value="option.value">{{
          option.label
        }}</NRadioButton></NRadioGroup
      >
    </NFormItem>
    <NCollapseTransition :show="hasVideo && model.video !== 'none'"
      ><NFormItem key="video" :label="t('media.video')" :show-feedback="false">
        <NRadioGroup v-model:value="model.video" class="video-options" :disabled="disabled"
          ><NRadio v-for="option in choices('video')" :key="option.value" :value="option.value" class="video-option"
            ><span class="video-choice"
              ><strong>{{
                Number(videoHeight(option.value)) > 0 ? `${videoHeight(option.value)}p` : option.label
              }}</strong
              ><small v-if="Number(videoHeight(option.value)) > 0">{{ option.label }}</small></span
            ></NRadio
          ></NRadioGroup
        >
      </NFormItem></NCollapseTransition
    >
    <NCollapseTransition :show="hasAudio && model.audio !== 'none'"
      ><NFormItem key="audio" :label="t('media.audio')" :show-feedback="false">
        <NSelect v-model:value="model.audio" :options="choices('audio')" filterable :disabled="disabled" /> </NFormItem
    ></NCollapseTransition>
    <NCollapseTransition :show="hasSubtitles"
      ><NFormItem key="subtitles" :label="t('media.subtitles')" :show-feedback="false">
        <NSelect
          v-model:value="model.subtitles"
          :options="choices('subtitle')"
          filterable
          :disabled="disabled"
        /> </NFormItem
    ></NCollapseTransition>
    <NFormItem key="format" :label="t('media.format')" :show-feedback="false">
      <NRadioGroup v-model:value="model.format" :disabled="disabled"
        ><NRadioButton value="mp4">MP4</NRadioButton><NRadioButton value="mkv">MKV</NRadioButton></NRadioGroup
      >
    </NFormItem>
    <NFormItem
      v-if="live"
      key="duration"
      class="media-field-wide"
      :label="t('media.record-time')"
      :show-feedback="false"
    >
      <div class="media-duration">
        <NSelect v-model:value="durationPreset" :options="durationOptions" :disabled="disabled" />
        <NInputNumber
          v-if="customDuration"
          v-model:value="model.recordTime"
          :min="1"
          :max="31536000"
          :precision="0"
          :disabled="disabled"
        >
          <template #suffix>{{ t('app.second') }}</template>
        </NInputNumber>
      </div>
    </NFormItem>
  </div>
</template>

<style scoped>
.media-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.media-fields :deep(.n-form-item) {
  margin: 0;
}
.video-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  max-height: 260px;
  overflow: auto;
}
.video-option {
  margin: 0;
  padding: 14px 0;
  width: 100%;
  border-bottom: 1px solid var(--divider);
}
.media-duration {
  display: flex;
  gap: 12px;
  width: 100%;
}
.media-duration > * {
  flex: 1;
}
.video-choice {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.video-choice strong {
  font-size: 14px;
  font-weight: 500;
}
.video-choice small {
  font-size: 13px;
  line-height: 20px;
  color: var(--m3-on-surface-variant);
}
</style>
