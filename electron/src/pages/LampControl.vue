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

// Lamp colors
const lampColors = computed(() => appStore.lampColors || { warmWhite: 0, pink: 0, orange: 0 });

// Lamp position
const lampPosition = computed(() => appStore.lampPosition);

// Circle colors for the UI
const circleColors = {
  warmWhite: '#ffb86d',
  pink: '#FF2A70',
  orange: '#ff4b09',
};

/**
 * Toggle lamp active state
 */
function toggleLampActive() {
  appStore.toggleLampActive();
}

/**
 * Handle color updates from LightControl
 */
function handleColorsUpdate(colors: { warmWhite: number; pink: number; orange: number }, position: { x: number; y: number }) {
  appStore.setLampColors(colors, position);
  console.log('Updated lamp colors (base):', colors);
}

/**
 * Handle brightness updates from LightControl
 */
function handleBrightnessUpdate(value: number) {
  appStore.setLampBrightness(value);
}
</script>


