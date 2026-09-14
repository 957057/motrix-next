<script setup lang="ts">
import { Reorder, useDragControls } from 'motion-v'
import { useReducedMotion } from '@/composables/useReducedMotion'
defineProps<{ value: unknown }>()
const controls = useDragControls()
const reduceMotion = useReducedMotion()
</script>
<template>
  <Reorder.Item
    as="div"
    :value="value"
    :drag-controls="controls"
    :drag-listener="false"
    :drag-elastic="0"
    :drag-momentum="false"
    layout="position"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :exit="{ opacity: 0 }"
    :transition="{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }"
  >
    <slot :start="(event: PointerEvent) => controls.start(event)" />
  </Reorder.Item>
</template>
