<template>
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <LightControl
      :circle-colors="circleColors"
      :colors="projectorColors"
      :position="projectorPosition"
      :active="projectorActive"
      :brightness="brightness"
      @update:colors="handleColorsUpdate"
      @update:brightness="handleBrightnessUpdate"
    />
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/appState';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import LightControl from '../components/LightControl.vue';
import feather from 'feather-icons';

const appStore = useAppStore();

// Projector active state
const projectorActive = computed(() => appStore.projectorActive ?? true);

const monitorIcon = feather.icons['sunrise'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Projector', 
    icon: monitorIcon, 
    action: toggleProjectorActive,
    active: projectorActive.value
  },
]);

// Brightness multiplier (0-100%) - synced with store
const brightness = computed(() => appStore.projectorBrightness);

// Projector colors as array [color0, color1, color2]
const projectorColors = computed<[number, number, number]>(() => {
  const colors = appStore.projectorColors || { color0: 0, color1: 0, color2: 0 };
  return [colors.color0, colors.color1, colors.color2];
});

// Projector position
const projectorPosition = computed(() => appStore.projectorPosition);

// Circle colors for the UI as array [color0, color1, color2]
// color0 (purple), color1 (orange), color2 (blue)
const circleColors: [string, string, string] = ['#9d09ff', '#ff8409', '#0058f0'];

/**
 * Toggle projector active state
 */
function toggleProjectorActive() {
  appStore.toggleProjectorActive();
}

/**
 * Handle color updates from LightControl
 */
function handleColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setProjectorColors({
    color0: colors[0],
    color1: colors[1],
    color2: colors[2],
  }, position);
  console.log('Updated projector colors (base):', colors);
}

/**
 * Handle brightness updates from LightControl
 */
function handleBrightnessUpdate(value: number) {
  appStore.setProjectorBrightness(value);
}
</script>
