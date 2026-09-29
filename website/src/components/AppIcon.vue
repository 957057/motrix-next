<script setup lang="ts">
/** @fileoverview One Ionicons 5 glyph by name, sized by the surrounding font size. */
import { ICONS, type IconName } from '@/ui/icons'

defineProps<{ name: IconName }>()
</script>

<template>
  <component :is="ICONS[name]" class="ic" aria-hidden="true" focusable="false" />
</template>
