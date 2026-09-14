/** Presentation state survives detail views and navigation without owning engine state. */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskViewStore = defineStore('taskView', () => {
  const query = ref('')
  const selecting = ref(false)
  const selected = ref<string[]>([])
  const expanded = ref<string | null>(null)
  const navigationOpen = ref(false)
  function toggleSelection(gid: string, checked: boolean) {
    selected.value = checked ? [...new Set([...selected.value, gid])] : selected.value.filter((id) => id !== gid)
  }
  function clearSelection() {
    selected.value = []
    selecting.value = false
  }
  return { query, selecting, selected, expanded, navigationOpen, toggleSelection, clearSelection }
})
