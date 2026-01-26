<template>
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <LightControl
      :circle-colors="circleColors"
      :colors="lampColors"
      :position="lampPosition"
      :active="lampActive"
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

// Lamp active state
const lampActive = computed(() => appStore.lampActive ?? true);

const sunIcon = feather.icons['sun'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Lamp', 
    icon: sunIcon, 
    action: toggleLampActive,
    active: lampActive.value
  },
]);

// Brightness multiplier (0-100%) - synced with store
const brightness = computed(() => appStore.lampBrightness);

// Lamp colors as array [color0, color1, color2]
// color0 (warmWhite), color1 (pink), color2 (orange)
const lampColors = computed<[number, number, number]>(() => {
  const colors = appStore.lampColors || { warmWhite: 0, pink: 0, orange: 0 };
  return [colors.warmWhite, colors.pink, colors.orange];
});

// Lamp position
const lampPosition = computed(() => appStore.lampPosition);

// Circle colors for the UI as array [color0, color1, color2]
// color0 (warmWhite), color1 (pink), color2 (orange)
const circleColors: [string, string, string] = ['#ffb86d', '#FF2A70', '#ff4b09'];

/**
 * Toggle lamp active state
 */
function toggleLampActive() {
  appStore.toggleLampActive();
}

/**
 * Handle color updates from LightControl
 */
function handleColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setLampColors({
    warmWhite: colors[0],
    pink: colors[1],
    orange: colors[2],
  }, position);
  console.log('Updated lamp colors (base):', colors);
}

/**
 * Handle brightness updates from LightControl
 */
function handleBrightnessUpdate(value: number) {
  appStore.setLampBrightness(value);
}
</script>


