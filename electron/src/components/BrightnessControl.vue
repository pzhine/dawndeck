<template>
  <KnobControl
    :value="brightness"
    :min="0"
    :max="100"
    :icon="icon"
    :color="color"
    :size="size"
    :stroke-width="strokeWidth"
    :connector-height="connectorHeight"
    :connector-width="connectorWidth"
    :connector-direction="connectorDirection"
    @update:value="(value) => $emit('update:brightness', value)"
  />
</template>

<script setup lang="ts">
import KnobControl from './KnobControl.vue';

interface Props {
  brightness: number; // 0-100
  icon: string;
  color?: string | number[];
  size?: number;
  strokeWidth?: number;
  connectorHeight?: number;
  connectorWidth?: number;
  connectorDirection?: 'up-left' | 'down-left' | 'up-right' | 'down-right';
}

interface Emits {
  (event: 'update:brightness', value: number): void;
}

withDefaults(defineProps<Props>(), {
  size: 80,
  strokeWidth: 8,
  color: '#ffffff',
});

defineEmits<Emits>();
</script>
