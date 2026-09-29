<script setup lang="ts">
/**
 * @fileoverview One TaskItem card: TaskDragHandle, TaskItemActions, the status
 * slot, progress bar and info row, painted from a task view (sim/tasks.ts).
 */
import { ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { IconName } from '@/ui/icons'
import type { Badge, InfoRight, TaskView } from '@/sim/tasks'

const props = defineProps<{ task: TaskView; focus?: boolean }>()

const RIGHT: [keyof InfoRight, IconName | null][] = [
  ['remaining', null],
  ['up', 'arrow-up-outline'],
  ['down', 'arrow-down-outline'],
  ['seeders', 'magnet-outline'],
  ['conns', 'git-network-outline'],
]

// The status row collapses with its last badge still inside, so it never empties before closing.
const badge = ref<Badge | null>(props.task.badge)
watch(
  () => props.task.badge,
  (next) => {
    if (next) badge.value = next
  },
)

const value = (key: keyof InfoRight) => props.task.right?.[key]
const shown = (key: keyof InfoRight) => {
  const v = value(key)
  return v != null && v !== ''
}
</script>

<template>
  <div class="rbw-slot" :data-task="task.id">
    <article class="rbw-card" :class="{ 'is-sharing': task.sharing, 'is-focus': focus }">
      <span class="rbw-drag" aria-hidden="true"><i /></span>
      <div class="rbw-body">
        <div class="rbw-head">
          <span class="rbw-name" :title="task.name">{{ task.name }}</span>
          <span class="rbw-actions">
            <i v-for="a in task.actions" :key="a"><AppIcon :name="a" /></i>
          </span>
        </div>
        <div class="rbw-status" :class="{ 'is-on': task.badge }">
          <div>
            <span v-if="badge" class="rbw-badge" :data-tone="badge.tone">
              <span class="rbw-badge-ic"><AppIcon :name="badge.icon" /></span>
              <span>{{ badge.text }}</span>
            </span>
          </div>
        </div>
        <div
          class="rbw-bar"
          :class="{ 'is-none': task.progress == null, 'is-active': task.active }"
          :data-tone="task.tone"
          :style="{ '--p': (task.progress ?? 0).toFixed(4) }"
        >
          <i />
        </div>
        <div class="rbw-info">
          <span class="rbw-left">{{ task.left }}</span>
          <span class="rbw-right">
            <span v-for="[key, icon] in RIGHT" :key="key" :data-r="key" :class="{ 'is-on': shown(key) }">
              <AppIcon v-if="icon" :name="icon" />
              <em>{{ shown(key) ? value(key) : '' }}</em>
            </span>
          </span>
        </div>
      </div>
    </article>
  </div>
</template>
