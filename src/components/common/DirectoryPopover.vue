<script setup lang="ts">
/** @fileoverview Shared directory quick-pick popover backed by preference directory history. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferenceStore } from '@/stores/preference'
import { NPopover, NButton, NIcon, NEllipsis, NEmpty } from 'naive-ui'
import { Clock, Star, Trash2 } from '@lucide/vue'

const emit = defineEmits<{ select: [dir: string] }>()

const { t } = useI18n()
const preferenceStore = usePreferenceStore()
const popoverVisible = ref(false)

const favorites = computed(() => preferenceStore.config.favoriteDirectories ?? [])
const recents = computed(() => preferenceStore.config.historyDirectories ?? [])
const hasItems = computed(() => favorites.value.length + recents.value.length > 0)

function onSelect(dir: string) {
  emit('select', dir)
  popoverVisible.value = false
}

function onToggleFavorite(dir: string, isFavorite: boolean) {
  if (isFavorite) {
    preferenceStore.cancelFavoriteDirectory(dir)
  } else {
    preferenceStore.favoriteDirectory(dir)
  }
}

function onRemove(dir: string) {
  preferenceStore.removeDirectory(dir)
}

function shortLabel(dir: string): string {
  const segments = dir.replace(/\\/g, '/').replace(/\/+$/, '').split('/')
  return segments.length >= 2 ? segments.slice(-2).join('/') : segments[segments.length - 1] || dir
}
</script>

<template>
  <NPopover
    v-model:show="popoverVisible"
    trigger="click"
    placement="bottom-end"
    :width="340"
    content-class="dir-popover-content"
  >
    <template #trigger>
      <NButton :aria-label="t('task.recent-folders')">
        <template #icon>
          <NIcon><Clock /></NIcon>
        </template>
      </NButton>
    </template>

    <template v-if="hasItems">
      <TransitionGroup name="list" tag="div" class="directory-list">
        <div v-if="favorites.length > 0" key="favorites-heading" class="dir-popover-heading">
          {{ t('task.favorite-folders') }}
        </div>
        <div
          v-for="dir in favorites"
          :key="'fav-' + dir"
          class="dir-popover-item"
          :title="dir"
          role="button"
          tabindex="0"
          @keydown.enter.self.prevent="onSelect(dir)"
          @keydown.space.self.prevent="onSelect(dir)"
          @click="onSelect(dir)"
        >
          <NEllipsis class="dir-popover-label" :tooltip="false">
            {{ shortLabel(dir) }}
          </NEllipsis>
          <div class="dir-popover-actions">
            <NButton
              text
              size="tiny"
              class="dir-popover-action"
              :aria-label="t('task.favorite-folders')"
              @click.stop="onToggleFavorite(dir, true)"
            >
              <template #icon>
                <NIcon color="var(--rb-accent)"><Star fill="currentColor" /></NIcon>
              </template>
            </NButton>
            <NButton
              text
              size="tiny"
              class="dir-popover-action"
              :aria-label="t('workspace.clear')"
              @click.stop="onRemove(dir)"
            >
              <template #icon>
                <NIcon><Trash2 /></NIcon>
              </template>
            </NButton>
          </div>
        </div>
      </TransitionGroup>

      <TransitionGroup name="list" tag="div" class="directory-list">
        <div
          v-if="recents.length > 0"
          key="recents-heading"
          class="dir-popover-heading"
          :class="{ 'dir-popover-heading--spaced': favorites.length > 0 }"
        >
          {{ t('task.recent-folders') }}
        </div>
        <div
          v-for="dir in recents"
          :key="'rec-' + dir"
          class="dir-popover-item"
          :title="dir"
          role="button"
          tabindex="0"
          @keydown.enter.self.prevent="onSelect(dir)"
          @keydown.space.self.prevent="onSelect(dir)"
          @click="onSelect(dir)"
        >
          <NEllipsis class="dir-popover-label" :tooltip="false">
            {{ shortLabel(dir) }}
          </NEllipsis>
          <div class="dir-popover-actions">
            <NButton
              text
              size="tiny"
              class="dir-popover-action"
              :aria-label="t('task.favorite-folders')"
              @click.stop="onToggleFavorite(dir, false)"
            >
              <template #icon>
                <NIcon><Star /></NIcon>
              </template>
            </NButton>
            <NButton
              text
              size="tiny"
              class="dir-popover-action"
              :aria-label="t('workspace.clear')"
              @click.stop="onRemove(dir)"
            >
              <template #icon>
                <NIcon><Trash2 /></NIcon>
              </template>
            </NButton>
          </div>
        </div>
      </TransitionGroup>
    </template>
    <NEmpty v-else class="dir-popover-empty" size="small" :description="t('task.dir-no-saved')" />
  </NPopover>
</template>

<style scoped>
.directory-list {
  position: relative;
}
.dir-popover-heading {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--rb-text-muted);
  padding: 4px 8px 4px;
  user-select: none;
}
.dir-popover-heading--spaced {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--rb-hairline);
}

.dir-popover-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 5px 8px;
  border-radius: var(--rb-radius-control);
  cursor: pointer;
  transition: background-color 0.15s;
}
.dir-popover-item:hover {
  background: var(--rb-hover);
}

.dir-popover-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
}

.dir-popover-actions {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.dir-popover-item:hover .dir-popover-actions {
  opacity: 1;
}

.dir-popover-action {
  padding: 2px !important;
}
</style>
