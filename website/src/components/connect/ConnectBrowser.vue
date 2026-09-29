<script setup lang="ts">
/**
 * @fileoverview A browser playing a video, with Rayburst Connect's popup
 * (entrypoints/popup: PopupHeader, MediaPanel, MediaSelection): the extension
 * icon counts what the page plays; the Sniffer lists the stream, the original
 * file and the subtitles; the stream's download opens Media options, which
 * probes the stream, then shows the form; MKV is chosen, Download is pressed,
 * the form gives way to "Confirming download…" and the success alert.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useCanvas } from '@/motion/useCanvas'
import type { IconName } from '@/ui/icons'
import connectLogo from '@/assets/img/connect.svg'
import { CUE } from './timeline'

const props = defineProps<{ time: number }>()
const { t } = useI18n()

const ROWS: { name: string; kind: IconName; meta: () => string; actions: IconName[] }[] = [
  {
    name: 'aurora-fjord-4k.m3u8',
    kind: 'film-outline',
    meta: () => 'HLS',
    actions: ['copy-outline', 'options-outline', 'play-circle-outline', 'download-outline'],
  },
  {
    name: 'aurora-preview.mp4',
    kind: 'document-outline',
    meta: () => `${t('cx.fileKind')} · 12.4 MB`,
    actions: ['copy-outline', 'play-circle-outline', 'download-outline'],
  },
  {
    name: 'aurora-fjord.en.vtt',
    kind: 'text-outline',
    meta: () => `${t('cx.subsKind')} · 18 KB`,
    actions: ['copy-outline', 'download-outline'],
  },
]

const time = computed(() => props.time)
const played = computed(() => 72 + time.value)
const at = (cue: number) => time.value >= cue
const open = computed(() => at(CUE.openClick) && time.value < CUE.close)
const selecting = computed(() => at(CUE.rowClick + 0.05))
const formOn = computed(() => at(CUE.probeEnd) && time.value < CUE.dlClick + 0.1)
const confirming = computed(() => at(CUE.dlClick + 0.1) && time.value < CUE.submitted)
const probing = computed(() => selecting.value && (time.value < CUE.probeEnd || confirming.value))
const mkv = computed(() => at(CUE.mkvClick))
const rowHot = computed(() => time.value >= CUE.rowClick - 0.6 && time.value < CUE.rowClick + 0.2)
const dlHot = computed(() => time.value >= CUE.rowClick - 0.3 && time.value < CUE.rowClick + 0.2)
const pressing = computed(() => time.value >= CUE.dlClick - 0.05 && time.value < CUE.dlClick + 0.12)

// ── The page's video: aurora curtains over a fjord ─────────────────────
const video = ref<HTMLCanvasElement | null>(null)
const { frame } = useCanvas(video, 1.5)
const RIDGE = [0.78, 0.62, 0.7, 0.55, 0.66, 0.74, 0.6, 0.72, 0.8]

function drawAurora(t0: number) {
  const f = frame()
  if (!f) return
  const { ctx, w, h } = f
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#050a1c')
  sky.addColorStop(0.7, '#0b1a33')
  sky.addColorStop(1, '#0d1f2c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'
  for (let band = 0; band < 3; band++) {
    const hue = band === 1 ? '120,110,255' : '80,240,170'
    for (let x = 0; x <= w; x += 6) {
      const u = x / w
      const y =
        h * (0.2 + 0.1 * band) +
        Math.sin(u * 5 + t0 * 0.5 + band * 1.7) * h * 0.08 +
        Math.sin(u * 13 - t0 * 0.9) * h * 0.02
      const len = h * (0.28 + 0.12 * Math.sin(u * 7 + t0 * 0.7 + band))
      const a = 0.06 + 0.05 * Math.sin(u * 9 + t0 * 1.3 + band * 2)
      const g = ctx.createLinearGradient(0, y, 0, y + len)
      g.addColorStop(0, `rgba(${hue},0)`)
      g.addColorStop(0.35, `rgba(${hue},${a})`)
      g.addColorStop(1, `rgba(${hue},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x, y, 6, len)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#04070e'
  ctx.beginPath()
  ctx.moveTo(0, h)
  RIDGE.forEach((r, i) => ctx.lineTo((i / (RIDGE.length - 1)) * w, h * r))
  ctx.lineTo(w, h)
  ctx.fill()
  ctx.fillStyle = 'rgba(80,240,170,0.05)'
  ctx.fillRect(0, h * 0.86, w, h * 0.14)
}
watch(time, drawAurora, { flush: 'post' })

// Cursor targets, read by the section.
const root = ref<HTMLElement | null>(null)
const ext = ref<HTMLElement | null>(null)
const rowDl = ref<HTMLElement[]>([])
const mkvEl = ref<HTMLElement | null>(null)
const dl = ref<HTMLElement | null>(null)
const done = ref<HTMLElement | null>(null)
defineExpose({
  frame: () => root.value,
  ext: () => ext.value,
  rowDownload: () => rowDl.value[0] ?? null,
  mkv: () => mkvEl.value,
  download: () => dl.value,
  done: () => done.value,
})
</script>

<template>
  <div ref="root" class="bw">
    <div class="bw-bar">
      <span class="bw-dots"><i /><i /><i /></span>
      <span class="bw-url"><AppIcon name="lock-closed-outline" />aurora.example/fjord-4k</span>
      <span ref="ext" class="bw-ext" :class="{ 'is-on': open }">
        <img :src="connectLogo" alt="" width="20" height="20" />
        <b :class="{ 'is-on': at(CUE.badge) }">3</b>
      </span>
    </div>
    <div class="bw-page">
      <div class="bw-video">
        <canvas ref="video" />
        <div class="bw-video-bar">
          <AppIcon name="pause-outline" />
          <span class="mono"
            >{{ Math.floor(played / 60) }}:{{ String(Math.floor(played % 60)).padStart(2, '0') }} / 3:12</span
          >
          <i><b :style="{ width: `${(played / 192) * 100}%` }" /></i>
          <AppIcon name="expand-outline" />
        </div>
      </div>
      <div class="bw-title">{{ t('connect.pageTitle') }}</div>
      <div class="bw-channel">{{ t('connect.channel') }}</div>
      <div class="bw-lines"><i /><i /><i /></div>

      <div class="pp" :class="{ 'is-open': open }">
        <div class="pp-head">
          <img :src="connectLogo" alt="" width="24" height="24" />
          <span class="pp-ok">{{ t('cx.connected') }}</span>
          <span class="pp-switch"
            ><span>{{ t('cx.intercepting') }}</span
            ><i
          /></span>
          <AppIcon name="settings-outline" />
        </div>
        <div class="pp-tabs">
          <span>{{ t('cx.downloads') }}</span>
          <span class="is-on"
            ><span>{{ t('cx.sniffer') }}</span
            ><b>3</b></span
          >
        </div>
        <div class="pp-body">
          <div class="pp-view pp-cat" :class="{ 'is-off': selecting }">
            <div class="pp-row0">
              <span class="pp-select"
                ><span>{{ t('cx.current') }}</span
                ><AppIcon name="chevron-down-outline"
              /></span>
              <span class="pp-filter">{{ t('cx.filter') }}</span>
            </div>
            <div class="pp-row0">
              <span class="pp-select pp-grow"
                ><span>{{ t('cx.all') }}</span
                ><AppIcon name="chevron-down-outline"
              /></span>
              <span class="pp-select pp-grow"
                ><span>{{ t('cx.time') }}</span
                ><AppIcon name="chevron-down-outline"
              /></span>
            </div>
            <div
              v-for="(r, i) in ROWS"
              :key="r.name"
              class="pp-res"
              :class="{ 'is-on': at(CUE.rows + i * 0.15), 'is-hot': i === 0 && rowHot }"
            >
              <span class="pp-res-kind"><AppIcon :name="r.kind" /></span>
              <span class="pp-res-main">
                <span class="pp-res-name">{{ r.name }}</span>
                <span class="pp-res-meta">{{ r.meta() }}</span>
              </span>
              <span class="pp-res-act">
                <template v-for="a in r.actions" :key="a">
                  <i v-if="i === 0 && a === 'download-outline'" ref="rowDl" :class="{ 'is-hot': dlHot }"
                    ><AppIcon :name="a"
                  /></i>
                  <i v-else><AppIcon :name="a" /></i>
                </template>
              </span>
            </div>
          </div>
          <div class="pp-view pp-sel" :class="{ 'is-off': !selecting }">
            <div class="pp-back">
              <AppIcon name="chevron-back-outline" /><span>{{ t('cx.back') }}</span>
            </div>
            <div class="pp-item-name">aurora-fjord-4k.m3u8</div>
            <div class="pp-item-meta">HLS · {{ t('cx.sizeUnknown') }}</div>
            <div v-show="probing" class="pp-probe">
              <i class="spin" /><span>{{ t(confirming ? 'cx.confirming' : 'cx.loading') }}</span>
            </div>
            <div class="pp-form" :class="{ 'is-on': formOn }">
              <div>
                <div class="pp-field">
                  <span>{{ t('cx.video') }}</span>
                  <span class="pp-select">2160p · 60 fps · hvc1<AppIcon name="chevron-down-outline" /></span>
                </div>
                <div class="pp-field">
                  <span>{{ t('cx.audio') }}</span>
                  <span class="pp-select">en · AAC · 2.0<AppIcon name="chevron-down-outline" /></span>
                </div>
                <div class="pp-field">
                  <span>{{ t('cx.subs') }}</span>
                  <span class="pp-select"
                    ><span>{{ t('film.language') }} (en)</span><AppIcon name="chevron-down-outline"
                  /></span>
                </div>
                <div class="pp-field">
                  <span>{{ t('cx.format') }}</span>
                  <span class="pp-seg">
                    <span :class="{ 'is-on': !mkv }">MP4</span>
                    <span ref="mkvEl" :class="{ 'is-on': mkv }">MKV</span>
                  </span>
                </div>
                <div class="pp-field">
                  <span>{{ t('cx.start') }}</span
                  ><span class="pp-select">0</span>
                </div>
                <div class="pp-field">
                  <span>{{ t('cx.end') }}</span
                  ><span class="pp-select">0</span>
                </div>
                <div class="pp-actions">
                  <span class="pp-btn">{{ t('cx.cancel') }}</span>
                  <span ref="dl" class="pp-btn is-primary" :class="{ 'is-press': pressing }">{{
                    t('cx.download')
                  }}</span>
                </div>
              </div>
            </div>
            <div v-show="at(CUE.submitted)" ref="done" class="pp-done">
              <AppIcon name="checkmark-circle-outline" /><span>{{ t('cx.submitted') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./browser.css"></style>
