<script setup lang="ts">
/**
 * @fileoverview Torrent file selection (BtSelectionDialog, BtFileSelector):
 * untick what you don't need, then start. The dialog closes, and the loop
 * brings it back.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useScene } from '@/motion/useScene'
import { bytes, MB } from '@/sim/format'

const { t } = useI18n()
const FILES: { name: string; size: number; untick: number | null }[] = [
  { name: 'bbb_sunflower_2160p_60fps_normal.mp4', size: 642 * MB, untick: null },
  { name: 'bbb_sunflower_1080p_60fps_normal.mp4', size: 355.9 * MB, untick: 1.3 },
  { name: 'subtitles/en.srt', size: 42 * 1024, untick: null },
  { name: 'extras/making-of.mkv', size: 1.1 * 1024 * MB, untick: 2.1 },
]
const LOOP = 7

const box = ref<HTMLElement | null>(null)
const { time } = useScene(box, { loop: LOOP, still: 3 })
const rows = computed(() =>
  FILES.map((f) => ({
    ...f,
    on: f.untick == null || time.value < f.untick,
    hot: f.untick != null && time.value > f.untick - 0.35 && time.value < f.untick + 0.25,
  })),
)
const picked = computed(() => rows.value.filter((r) => r.on))
const total = computed(() => picked.value.reduce((n, r) => n + r.size, 0))
const pressing = computed(() => time.value > 3.1 && time.value < 3.4)
const sent = computed(() => time.value > 3.4 && time.value < LOOP - 0.4)
</script>

<template>
  <div ref="box" class="pick rbw" :class="{ 'is-sent': sent }" aria-hidden="true">
    <div class="pick-win">
      <div class="pick-head">
        <b>{{ t('ui.selectFiles') }}</b
        ><AppIcon name="close-outline" />
      </div>
      <div class="pick-name">Big Buck Bunny 4K</div>
      <div class="pick-table">
        <div class="pick-row pick-th" :class="{ 'is-some': picked.length < FILES.length }">
          <i class="pick-box"><AppIcon name="checkmark-outline" /></i>
          <span>{{ t('ui.fileNo') }}</span
          ><span>{{ t('ui.fileName') }}</span
          ><span>{{ t('ui.fileSize') }}</span>
        </div>
        <div v-for="(r, i) in rows" :key="r.name" class="pick-row" :class="{ 'is-off': !r.on, 'is-hot': r.hot }">
          <i class="pick-box"><AppIcon name="checkmark-outline" /></i>
          <span>{{ i + 1 }}</span
          ><span class="pick-file">{{ r.name }}</span
          ><span>{{ bytes(r.size) }}</span>
        </div>
      </div>
      <div class="pick-foot">
        <span class="pick-sum">
          <b class="mono">{{ picked.length }}/{{ FILES.length }}</b
          ><em>—</em><b class="mono">{{ bytes(total) }}</b>
        </span>
        <span class="pick-btns">
          <i>{{ t('ui.chooseLater') }}</i>
          <i class="is-primary" :class="{ 'is-press': pressing }">{{ t('ui.startDownload') }}</i>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./pick.css"></style>
