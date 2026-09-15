<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  isNavigationFailure,
  NavigationFailureType,
  useRoute,
  useRouter,
  type RouteLocationNormalized,
} from 'vue-router'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { NSelect, NIcon } from 'naive-ui'
import { LayoutGroup, motion } from 'motion-v'
import { Search } from '@lucide/vue'
import { settingsCatalog } from '@shared/settingsCatalog'
import { usePlatform } from '@/composables/usePlatform'
import { useAppStore } from '@/stores/app'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { platform } = usePlatform()
const app = useAppStore()
const searchOptions = computed(() =>
  settingsCatalog
    .filter(
      (item) => (!item.platforms || item.platforms.includes(platform.value)) && (!item.updates || app.updatesAvailable),
    )
    .map((item) => ({ label: `${t(item.key)} · ${t('preferences.' + item.category)}`, value: item.key })),
)
function goToSetting(key: string | null) {
  const item = settingsCatalog.find((item) => item.key === key)
  if (item) void router.push({ path: `/preference/${item.category}`, hash: `#setting-${item.key}` })
}
const categories = ['general', 'downloads', 'network', 'bt', 'ed2k', 'connections', 'advanced']
const pendingNavigation = shallowRef<RouteLocationNormalized | null>(null)
const activePath = computed(() => pendingNavigation.value?.path ?? route.path)
function isActive(category: string) {
  return activePath.value.endsWith(category) || (category === 'general' && activePath.value === '/preference')
}

const removeBeforeGuard = router.beforeEach(async (to, from) => {
  if (to.path === from.path || !to.path.startsWith('/preference/')) return
  pendingNavigation.value = to
  // Paint navigation feedback before loading and mounting the next form.
  await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
})
const removeAfterGuard = router.afterEach((to, _from, failure) => {
  if (pendingNavigation.value === to || isNavigationFailure(failure, NavigationFailureType.duplicated)) {
    pendingNavigation.value = null
  }
})
const removeErrorHandler = router.onError((_error, to) => {
  if (pendingNavigation.value === to) pendingNavigation.value = null
})
onScopeDispose(() => {
  removeBeforeGuard()
  removeAfterGuard()
  removeErrorHandler()
})
</script>
<template>
  <section class="preference-view">
    <header class="rb-page-header settings-header">
      <h1 class="rb-page-title">{{ t('app.preferences') }}</h1>
      <NSelect
        class="settings-search"
        :value="null"
        filterable
        clearable
        :options="searchOptions"
        :placeholder="t('preferences.search-settings')"
        :aria-label="t('preferences.search-settings')"
        @update:value="goToSetting"
        ><template #arrow
          ><NIcon :size="15"><Search /></NIcon></template
      ></NSelect>
    </header>
    <LayoutGroup id="settings-tabs">
      <nav class="settings-tabs rb-segments" :aria-label="t('app.preferences')">
        <RouterLink
          v-for="category in categories"
          :key="category"
          :to="`/preference/${category}`"
          class="rb-segment"
          :class="{ 'is-active': isActive(category) }"
          :aria-current="route.path.endsWith(category) ? 'page' : undefined"
        >
          <motion.span
            v-if="isActive(category)"
            layout-id="settings-tab"
            class="rb-segment__indicator"
            aria-hidden="true"
          />
          <span>{{ t(`preferences.${category}`) }}</span>
        </RouterLink>
      </nav>
    </LayoutGroup>
    <div class="panel-body" :aria-busy="!!pendingNavigation" :inert="!!pendingNavigation">
      <router-view v-slot="{ Component }"
        ><Transition
          name="view"
          @before-leave="(el) => el.setAttribute('inert', '')"
          @before-enter="(el) => el.removeAttribute('inert')"
          @leave-cancelled="(el) => el.removeAttribute('inert')"
          ><component :is="Component" /></Transition
      ></router-view>
    </div>
  </section>
</template>
<style scoped>
.preference-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-header {
  justify-content: space-between;
}

.settings-search {
  width: min(340px, 48%);
}

.settings-tabs {
  margin: 0 var(--rb-page-inline) 6px;
  flex-shrink: 0;
  align-self: flex-start;
  max-width: calc(100% - var(--rb-page-inline) * 2);
}

.settings-tabs a {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.panel-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 719px) {
  .settings-header {
    padding: 4px 16px 14px;
  }

  .settings-tabs {
    margin-inline: 16px;
    max-width: calc(100% - 32px);
  }
}
</style>
