<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NFormItem } from 'naive-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  label?: string
  hint?: string
  fieldHint?: string
  actions?: boolean
  continuation?: boolean
  settingKey?: string
}>()
const route = useRoute()
const labelId = useId()
const item = ref<InstanceType<typeof NFormItem> | null>(null)
watch(
  () => [route.hash, item.value] as const,
  async () => {
    if (!props.settingKey || route.hash !== `#setting-${props.settingKey}`) return
    await nextTick()
    if (route.hash !== `#setting-${props.settingKey}`) return
    const element = item.value?.$el as HTMLElement | undefined
    element?.scrollIntoView({ block: 'center' })
    element?.querySelector<HTMLElement>('input, button, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)
</script>

<template>
  <NFormItem
    :id="settingKey ? `setting-${settingKey}` : undefined"
    ref="item"
    v-bind="$attrs"
    class="setting-row"
    :class="{
      'setting-row--actions': actions,
      'setting-row--wide': !continuation && !$slots.label && (!label?.trim() || $attrs['show-label'] === false),
    }"
    :label="label"
    :show-label="Boolean(label?.trim() || $slots.label) && $attrs['show-label'] !== false"
    :label-props="{ id: labelId }"
    label-placement="left"
    label-align="left"
    :show-feedback="Boolean($attrs.feedback || $attrs.rule || $slots.feedback)"
    role="group"
    :aria-describedby="fieldHint ? `${labelId}-hint` : undefined"
    :aria-labelledby="label || $slots.label ? labelId : undefined"
  >
    <template v-if="label || $slots.label" #label>
      <slot name="label">
        <span class="setting-label">{{ label }}</span>
        <span v-if="hint" class="setting-hint">{{ hint }}</span>
      </slot>
    </template>
    <div v-if="fieldHint" class="setting-field">
      <slot :description="`${labelId}-hint`" />
      <p :id="`${labelId}-hint`" class="setting-field-hint">{{ fieldHint }}</p>
    </div>
    <slot v-else :description="undefined" />
    <template v-if="$slots.feedback" #feedback><slot name="feedback" /></template>
  </NFormItem>
</template>
