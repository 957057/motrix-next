<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NIcon, NDrawer, NDrawerContent } from 'naive-ui'
import {
  DownloadOutline,
  PlayCircleOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  SettingsOutline,
  InformationCircleOutline,
} from '@vicons/ionicons5'
import { usePreferenceStore } from '@/stores/preference'
import { useTaskStore } from '@/stores/task'
import { useTaskViewStore } from '@/stores/taskView'
import { useMediaQuery } from '@vueuse/core'

const emit = defineEmits<{ 'show-about': [] }>()
const { t } = useI18n()
const route = useRoute()
const tasks = useTaskStore()
const preferences = usePreferenceStore()
const view = useTaskViewStore()
const narrow = useMediaQuery('(max-width: 719px)')
const links = computed(() => [
  { path: '/task/all', label: t('task.scope-all'), icon: DownloadOutline, count: undefined },
  {
    path: '/task/progress',
    label: t('task.scope-progress'),
    icon: PlayCircleOutline,
    count: tasks.taskCounts.progress,
  },
  {
    path: '/task/completed',
    label: t('task.scope-completed'),
    icon: CheckmarkCircleOutline,
    count: tasks.taskCounts.completed,
  },
  {
    path: '/task/failed',
    label: t('workspace.needs-action'),
    icon: AlertCircleOutline,
    count: tasks.taskCounts.failed,
  },
])
function showAbout() {
  emit('show-about')
  view.navigationOpen = false
}
</script>

<template>
  <component
    :is="narrow ? NDrawer : 'aside'"
    class="app-sidebar"
    :show="view.navigationOpen"
    :width="240"
    placement="left"
    @update:show="view.navigationOpen = $event"
  >
    <component :is="narrow ? NDrawerContent : 'div'" class="sidebar-content" :native-scrollbar="false">
      <div class="sidebar-inner" data-tauri-drag-region>
        <RouterLink to="/task/all" class="brand" aria-label="Rayburst" @click="view.navigationOpen = false">
          <img src="@/assets/rayburst.svg" width="28" height="28" alt="" />
          <span>Rayburst</span>
        </RouterLink>
        <nav :aria-label="t('app.task-list')" class="primary-navigation">
          <RouterLink
            v-for="link in links"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            :class="{ active: route.path === link.path }"
            :aria-current="route.path === link.path ? 'page' : undefined"
            :title="link.label"
            @click="view.navigationOpen = false"
          >
            <NIcon :size="20"><component :is="link.icon" /></NIcon>
            <span class="nav-label">{{ link.label }}</span>
            <span v-if="preferences.config.sidebarTaskCounts && link.count" class="nav-count">{{ link.count }}</span>
          </RouterLink>
        </nav>
        <nav class="secondary-navigation" :aria-label="t('app.preferences')">
          <RouterLink
            to="/preference/general"
            class="nav-link"
            :class="{ active: route.path.startsWith('/preference') }"
            :title="t('app.preferences')"
            @click="view.navigationOpen = false"
          >
            <NIcon :size="20"><SettingsOutline /></NIcon><span class="nav-label">{{ t('app.preferences') }}</span>
          </RouterLink>
          <button class="nav-link" :title="t('app.about')" @click="showAbout">
            <NIcon :size="20"><InformationCircleOutline /></NIcon><span class="nav-label">{{ t('app.about') }}</span>
          </button>
        </nav>
      </div>
    </component>
  </component>
</template>

<style scoped>
.app-sidebar {
  width: 192px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
}
.sidebar-content,
.sidebar-inner {
  height: 100%;
  min-height: 0;
}
.sidebar-inner {
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
  box-sizing: border-box;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 76px;
  flex-shrink: 0;
  padding: 0 10px;
  color: var(--m3-on-surface);
  text-decoration: none;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.4px;
}
.primary-navigation {
  flex: 1;
  overflow: auto;
}
.secondary-navigation {
  padding-top: 12px;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 10px;
  width: 100%;
  box-sizing: border-box;
  margin: 2px 0;
  border: 0;
  border-radius: 6px;
  color: var(--m3-on-surface-variant);
  background: transparent;
  font: inherit;
  text-decoration: none;
  text-align: start;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}
.nav-link .n-icon {
  flex-shrink: 0;
}
.nav-link:hover {
  background: var(--interaction-hover);
}
.nav-link.active {
  background: var(--selection-bg);
  color: var(--m3-primary);
}
.nav-label {
  flex: 1;
  min-width: 0;
  line-height: 20px;
}
.nav-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
@media (min-width: 720px) and (max-width: 959px) {
  .app-sidebar {
    width: 56px;
  }
  .sidebar-inner {
    padding-inline: 8px;
  }
  .brand {
    padding: 0 6px;
  }
  .brand span,
  .nav-label,
  .nav-count {
    display: none;
  }
  .nav-link {
    justify-content: center;
    padding-inline: 0;
  }
}
@media (max-height: 420px) {
  .brand {
    height: 44px;
  }
  .sidebar-inner {
    overflow-y: auto;
  }
  .primary-navigation {
    flex-shrink: 0;
  }
}
</style>
