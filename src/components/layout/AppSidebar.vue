<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NIcon, NDrawer, NDrawerContent } from 'naive-ui'
import { LayoutGroup, motion } from 'motion-v'
import { Layers, Download, CircleCheck, CircleAlert, Settings, Info } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { usePreferenceStore } from '@/stores/preference'
import { useTaskStore } from '@/stores/task'
import { useTaskViewStore } from '@/stores/taskView'
import logo from '@/assets/rayburst.svg'

const emit = defineEmits<{ 'show-about': [] }>()
const { t } = useI18n()
const route = useRoute()
const tasks = useTaskStore()
const preferences = usePreferenceStore()
const view = useTaskViewStore()
const narrow = useMediaQuery('(max-width: 719px)')
const links = computed(() => [
  { path: '/task/all', label: t('task.scope-all'), icon: Layers, count: undefined },
  { path: '/task/progress', label: t('task.scope-progress'), icon: Download, count: tasks.taskCounts.progress },
  { path: '/task/completed', label: t('task.scope-completed'), icon: CircleCheck, count: tasks.taskCounts.completed },
  { path: '/task/failed', label: t('workspace.needs-action'), icon: CircleAlert, count: tasks.taskCounts.failed },
])
const settingsActive = computed(() => route.path.startsWith('/preference'))
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
    :width="260"
    placement="left"
    @update:show="view.navigationOpen = $event"
  >
    <component :is="narrow ? NDrawerContent : 'div'" class="sidebar-content" :native-scrollbar="false">
      <div class="sidebar-inner" data-tauri-drag-region>
        <RouterLink to="/task/all" class="brand" aria-label="Rayburst" @click="view.navigationOpen = false">
          <img :src="logo" width="30" height="30" alt="" />
          <span class="brand-name">Rayburst</span>
        </RouterLink>
        <LayoutGroup id="sidebar-navigation">
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
              <motion.span
                v-if="route.path === link.path"
                layout-id="nav-active"
                class="nav-active"
                aria-hidden="true"
              />
              <NIcon :size="18" class="nav-icon"><component :is="link.icon" /></NIcon>
              <span class="nav-label">{{ link.label }}</span>
              <span v-if="preferences.config.sidebarTaskCounts && link.count" class="nav-count">{{ link.count }}</span>
            </RouterLink>
          </nav>
          <nav class="secondary-navigation" :aria-label="t('app.preferences')">
            <RouterLink
              to="/preference/general"
              class="nav-link"
              :class="{ active: settingsActive }"
              :title="t('app.preferences')"
              @click="view.navigationOpen = false"
            >
              <motion.span v-if="settingsActive" layout-id="nav-active" class="nav-active" aria-hidden="true" />
              <NIcon :size="18" class="nav-icon"><Settings /></NIcon>
              <span class="nav-label">{{ t('app.preferences') }}</span>
            </RouterLink>
            <button class="nav-link" :title="t('app.about')" @click="showAbout">
              <NIcon :size="18" class="nav-icon"><Info /></NIcon>
              <span class="nav-label">{{ t('app.about') }}</span>
            </button>
          </nav>
        </LayoutGroup>
      </div>
    </component>
  </component>
</template>

<style scoped>
.app-sidebar {
  width: var(--rb-sidebar-width);
  flex-shrink: 0;
  background: var(--rb-sidebar);
}

.sidebar-content,
.sidebar-inner {
  height: 100%;
  min-height: 0;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  padding: 0 12px 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--rb-titlebar-height);
  margin-top: 4px;
  margin-bottom: 8px;
  flex-shrink: 0;
  padding: 0 8px;
  color: var(--rb-text);
  text-decoration: none;
  -webkit-app-region: no-drag;
}

.native-frame .brand {
  padding-inline-start: 74px;
}

.brand img {
  flex: none;
  filter: drop-shadow(0 2px 6px var(--rb-glow));
}

.brand-name {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.025em;
}

.primary-navigation {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.secondary-navigation {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--rb-hairline);
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  width: 100%;
  border-radius: var(--rb-radius-control);
  color: var(--rb-text-muted);
  background: transparent;
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  text-align: start;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: color var(--rb-motion-feedback) var(--rb-ease);
}

.nav-link:hover {
  color: var(--rb-text);
}

.nav-link:hover:not(.active)::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--rb-hover);
}

.nav-link.active {
  color: var(--rb-accent-text);
}

.nav-active {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--rb-raised);
  box-shadow: var(--rb-shadow-raised);
}

.nav-active::before {
  content: '';
  position: absolute;
  inset-block: 9px;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--rb-gradient);
}

.nav-icon,
.nav-label,
.nav-count {
  position: relative;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  min-width: 0;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
  text-align: center;
  color: var(--rb-text-muted);
  background: var(--rb-fill-strong);
}

.nav-link.active .nav-count {
  color: var(--rb-accent-text);
  background: var(--rb-accent-soft);
}

@media (min-width: 720px) and (max-width: 959px) {
  .app-sidebar {
    width: var(--rb-rail-width);
  }

  .sidebar-inner {
    padding-inline: 10px;
  }

  .brand {
    padding: 0;
    justify-content: center;
  }

  .native-frame .brand {
    padding-inline-start: 0;
    margin-top: 28px;
  }

  .brand-name,
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
    height: 40px;
  }

  .sidebar-inner {
    overflow-y: auto;
  }

  .primary-navigation {
    flex-shrink: 0;
  }
}
</style>
