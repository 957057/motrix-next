<script setup lang="ts">
import { NIcon, NModal, NButton, NCheckbox, NProgress } from 'naive-ui'
import { Menu } from '@lucide/vue'
import { useDesktopRuntime } from '@/composables/useDesktopRuntime'
import { useTaskViewStore } from '@/stores/taskView'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import WindowControls from '@/components/layout/WindowControls.vue'
import EngineRecoveryDialog from '@/components/layout/EngineRecoveryDialog.vue'
import AboutDialog from '@/components/about/AboutDialog.vue'
import AddTask from '@/components/task/AddTask.vue'
import UpdateDialog from '@/components/preference/UpdateDialog.vue'
import TaskSelectionHost from '@/components/task/TaskSelectionHost.vue'
const taskView = useTaskViewStore()
const {
  t,
  appStore,
  engineStore,
  isMac,
  showAbout,
  showExitDialog,
  isMaximized,
  currentPlatform,
  onMaximizeToggled,
  addTaskClosing,
  updateDialogRef,
  onExitDialogAfterLeave,
  handleExitCancel,
  rememberChoice,
  handleMinimizeToTray,
  handleExitConfirm,
  showShutdownCountdown,
  shutdownCountdown,
  skipShutdownOnce,
  disableShutdownAndCancel,
} = useDesktopRuntime()
</script>

<template>
  <div id="container" :class="{ 'native-frame': isMac }">
    <Transition name="fade">
      <div v-if="engineStore.isBusy" class="engine-banner" aria-hidden="true">
        <div class="engine-progress" />
      </div>
    </Transition>
    <AppSidebar @show-about="showAbout = true" />
    <div class="workspace">
      <div class="window-drag-area" data-tauri-drag-region>
        <button
          class="navigation-toggle icon-button"
          :aria-label="t('app.task-list')"
          @click="taskView.navigationOpen = true"
        >
          <NIcon :size="20"><Menu /></NIcon>
        </button>
      </div>
      <main class="content">
        <router-view v-slot="{ Component }">
          <Transition
            name="view"
            @before-leave="(el) => el.setAttribute('inert', '')"
            @before-enter="(el) => el.removeAttribute('inert')"
            @leave-cancelled="(el) => el.removeAttribute('inert')"
            @after-enter="(el) => el.removeAttribute('inert')"
          >
            <component :is="Component" />
          </Transition>
        </router-view>
      </main>
      <StatusBar />
    </div>
    <WindowControls
      class="window-controls"
      :is-maximized="isMaximized"
      :platform="currentPlatform"
      @close="showExitDialog = true"
      @maximize-toggled="onMaximizeToggled"
    />
    <AboutDialog :show="showAbout" @close="showAbout = false" />
    <AddTask
      :show="appStore.addTaskVisible"
      @close="appStore.hideAddTaskDialog()"
      @after-leave="addTaskClosing = false"
    />
    <UpdateDialog ref="updateDialogRef" />
    <EngineRecoveryDialog />
    <TaskSelectionHost
      :blocked="appStore.addTaskVisible || addTaskClosing || showAbout || showExitDialog || engineStore.isBusy"
    />

    <NModal
      :show="showExitDialog"
      preset="dialog"
      type="default"
      :title="t('app.close-action-title')"
      :closable="true"
      :mask-closable="true"
      :show-icon="false"
      transform-origin="center"
      @after-leave="onExitDialogAfterLeave"
      @update:show="
        (v: boolean) => {
          if (!v) handleExitCancel()
        }
      "
    >
      <span>{{ t('app.close-action-message') }}</span>
      <div class="remember-choice">
        <NCheckbox v-model:checked="rememberChoice">{{ t('app.remember-close-choice') }}</NCheckbox>
      </div>
      <template #action>
        <NButton quaternary @click="handleExitCancel">{{ t('app.cancel') }}</NButton>
        <NButton @click="handleMinimizeToTray">{{ t('app.minimize-to-tray') }}</NButton>
        <NButton type="primary" @click="handleExitConfirm">{{ t('app.quit-app') }}</NButton>
      </template>
    </NModal>

    <NModal
      :show="showShutdownCountdown"
      preset="dialog"
      type="warning"
      :title="t('app.shutdown-countdown-title')"
      :closable="false"
      :mask-closable="false"
      transform-origin="center"
      :positive-text="t('app.shutdown-skip-once')"
      :negative-text="t('app.shutdown-disable')"
      @positive-click="skipShutdownOnce"
      @negative-click="disableShutdownAndCancel"
    >
      <span>{{ t('app.shutdown-countdown-message', { seconds: shutdownCountdown }) }}</span>
      <NProgress
        type="line"
        :percentage="(shutdownCountdown / 60) * 100"
        :show-indicator="false"
        style="margin-top: 14px"
      />
    </NModal>
  </div>
</template>

<style scoped>
#container {
  display: flex;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--rb-sidebar);
}

.workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--rb-canvas);
  border-inline-start: 1px solid var(--rb-hairline);
}

.window-drag-area {
  height: 28px;
  flex-shrink: 0;
}

.navigation-toggle {
  display: none;
  position: absolute;
  top: 6px;
  inset-inline-start: 12px;
  z-index: 10;
}

.content {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.window-controls {
  z-index: 100;
}

.remember-choice {
  margin-block: 14px 4px;
}

.engine-banner {
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  z-index: 200;
  pointer-events: none;
  overflow: hidden;
}

.engine-progress {
  height: 100%;
  width: 40%;
  background: var(--rb-gradient);
  border-radius: 999px;
  animation: engine-sweep 1.6s var(--rb-ease) infinite;
}

@keyframes engine-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(350%);
  }
}

@media (max-width: 719px) {
  .navigation-toggle {
    display: inline-flex;
  }

  .window-drag-area {
    height: 44px;
  }

  .workspace {
    border-inline-start: 0;
  }
}
</style>
