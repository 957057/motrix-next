<script setup lang="ts">
/** @fileoverview Tinted tile that identifies a task by file kind at a glance. */
import { computed, type Component } from 'vue'
import { Film, Music, Image, Package, FileText, AppWindow, Magnet, Radio, Folder, File } from '@lucide/vue'
import type { FileKind } from '@shared/utils/fileKind'

const props = withDefaults(defineProps<{ kind: FileKind; size?: number }>(), { size: 36 })

const ICONS: Record<FileKind, Component> = {
  video: Film,
  audio: Music,
  image: Image,
  archive: Package,
  document: FileText,
  software: AppWindow,
  torrent: Magnet,
  stream: Radio,
  folder: Folder,
  file: File,
}

const icon = computed(() => ICONS[props.kind])
const iconSize = computed(() => Math.round(props.size * 0.5))
</script>

<template>
  <span
    class="file-tile"
    :data-kind="kind"
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.3)}px` }"
    aria-hidden="true"
  >
    <component :is="icon" :size="iconSize" :stroke-width="1.75" />
  </span>
</template>

<style scoped>
.file-tile {
  --tile: var(--rb-text-muted);
  display: inline-grid;
  place-items: center;
  flex: none;
  color: var(--tile);
  background: color-mix(in srgb, var(--tile) 13%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tile) 12%, transparent);
}

.file-tile[data-kind='video'] {
  --tile: var(--rb-accent);
}

.file-tile[data-kind='stream'] {
  --tile: #e0447c;
}

.file-tile[data-kind='audio'] {
  --tile: #d9418f;
}

.file-tile[data-kind='image'] {
  --tile: #0f9d8a;
}

.file-tile[data-kind='archive'] {
  --tile: #c27a12;
}

.file-tile[data-kind='document'] {
  --tile: #2f7be0;
}

.file-tile[data-kind='software'] {
  --tile: #5b6b8c;
}

.file-tile[data-kind='torrent'] {
  --tile: #1f9e58;
}

.file-tile[data-kind='folder'] {
  --tile: #a4770f;
}

.dark .file-tile[data-kind='stream'] {
  --tile: #ff8ab0;
}

.dark .file-tile[data-kind='audio'] {
  --tile: #ff8dc4;
}

.dark .file-tile[data-kind='image'] {
  --tile: #4fd9c4;
}

.dark .file-tile[data-kind='archive'] {
  --tile: #f2b356;
}

.dark .file-tile[data-kind='document'] {
  --tile: #7db8ff;
}

.dark .file-tile[data-kind='software'] {
  --tile: #a7b6d6;
}

.dark .file-tile[data-kind='torrent'] {
  --tile: #6fd695;
}

.dark .file-tile[data-kind='folder'] {
  --tile: #e9c15d;
}
</style>
