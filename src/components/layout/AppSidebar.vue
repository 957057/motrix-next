<script setup lang="ts">
/** Persistent task navigation and application destinations. */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import { InformationCircleOutline, SettingsOutline } from '@vicons/ionicons5'
import { useTaskStore } from '@/stores/task'
import { usePreferenceStore } from '@/stores/preference'
import SidebarCount from './SidebarCount.vue'
import { useTaskDestinations } from './navigation'

const emit = defineEmits<{ 'show-about': [] }>()
const { t } = useI18n()
const route = useRoute()
const taskDestinations = useTaskDestinations()
const tasks = useTaskStore()
const preferences = usePreferenceStore()
const isSettings = computed(() => route.matched.some((record) => record.name === 'preference'))
</script>

<template>
  <nav class="sidebar" :aria-label="t('app.task-list')">
    <div class="sidebar-scopes">
      <RouterLink
        v-for="item in taskDestinations"
        :key="item.key"
        :to="{ name: 'task', params: { status: item.key } }"
        class="sidebar-item"
        active-class="active"
        :aria-label="preferences.config.sidebarTaskCounts ? `${item.label} ${tasks.taskCounts[item.key]}` : item.label"
      >
        <NIcon :size="18" aria-hidden="true"><component :is="item.icon" /></NIcon>
        <span class="sidebar-label">{{ item.label }}</span>
        <Transition name="sidebar-count">
          <SidebarCount v-if="preferences.config.sidebarTaskCounts" :value="tasks.taskCounts[item.key]" />
        </Transition>
      </RouterLink>
    </div>
    <div class="sidebar-bottom">
      <button type="button" class="sidebar-item" @click="emit('show-about')">
        <NIcon :size="18" aria-hidden="true"><InformationCircleOutline /></NIcon>
        <span class="sidebar-label">{{ t('app.about') }}</span>
      </button>
      <RouterLink
        :to="{ name: 'preference-general' }"
        class="sidebar-item"
        :class="{ active: isSettings }"
        :aria-current="isSettings ? 'page' : undefined"
      >
        <NIcon :size="18" aria-hidden="true"><SettingsOutline /></NIcon>
        <span class="sidebar-label">{{ t('app.preferences') }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 16px;
  background: var(--sidebar-bg);
}
.sidebar-scopes {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.sidebar-bottom {
  flex-shrink: 0;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  color: var(--m3-on-surface-variant);
  text-align: left;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}
.sidebar-item :deep(.n-icon) {
  flex-shrink: 0;
}
.sidebar-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.sidebar-item:hover {
  background: var(--sidebar-hover-bg);
}
.sidebar-item.active {
  background: var(--sidebar-active-bg);
  color: var(--m3-on-surface);
}
.sidebar-item:focus-visible {
  outline: 2px solid var(--m3-primary);
  outline-offset: -2px;
}
.sidebar-count-enter-active,
.sidebar-count-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.sidebar-count-enter-from,
.sidebar-count-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
