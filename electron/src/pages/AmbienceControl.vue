<template>
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <div class="relative flex flex-col h-full w-full">
      <!-- Lamp Control -->
      <div class="h-1/2 flex flex-col relative top-7">
        <LightControl
            :circle-colors="lampCircleColors"
            :colors="lampColors"
            :position="lampPosition"
            :active="lampActive"
            :brightness="lampBrightness"
            @update:colors="handleLampColorsUpdate"
            @update:brightness="handleLampBrightnessUpdate"
          />
      </div>

      <!-- Projector Control -->
      <div class="h-1/2 flex flex-col  relative top-2">
        <LightControl
            :circle-colors="projectorCircleColors"
            :colors="projectorColors"
            :position="projectorPosition"
            :active="projectorActive"
            :brightness="projectorBrightness"
            @update:colors="handleProjectorColorsUpdate"
            @update:brightness="handleProjectorBrightnessUpdate"
          />

      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/appState';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import LightControl from '../components/LightControl.vue';
import feather from 'feather-icons';

const appStore = useAppStore();

// Active states
const lampActive = computed(() => appStore.lampActive ?? true);
const projectorActive = computed(() => appStore.projectorActive ?? true);

const sunIcon = feather.icons['sun'].toSvg();
const monitorIcon = feather.icons['monitor'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Lamp', 
    icon: sunIcon, 
    action: toggleLampActive,
    active: lampActive.value
  },
  { 
    label: 'Projector', 
    icon: monitorIcon, 
    action: toggleProjectorActive,
    active: projectorActive.value
  },
]);

// Lamp state
const lampBrightness = computed(() => appStore.lampBrightness);
const lampColors = computed<[number, number, number]>(() => {
  const colors = appStore.lampColors || { warmWhite: 0, pink: 0, orange: 0 };
  return [colors.warmWhite, colors.pink, colors.orange];
});
const lampPosition = computed(() => appStore.lampPosition);
const lampCircleColors: [string, string, string] = ['#ffb86d', '#FF2A70', '#ff4b09'];

// Projector state
const projectorBrightness = computed(() => appStore.projectorBrightness);
const projectorColors = computed<[number, number, number]>(() => {
  const colors = appStore.projectorColors || { color0: 0, color1: 0, color2: 0 };
  return [colors.color0, colors.color1, colors.color2];
});
const projectorPosition = computed(() => appStore.projectorPosition);
const projectorCircleColors: [string, string, string] = ['#9d09ff', '#ff8409', '#0058f0'];

/**
 * Toggle lamp active state
 */
function toggleLampActive() {
  appStore.toggleLampActive();
}

/**
 * Toggle projector active state
 */
function toggleProjectorActive() {
  appStore.toggleProjectorActive();
}

/**
 * Handle lamp color updates
 */
function handleLampColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setLampColors({
    warmWhite: colors[0],
    pink: colors[1],
    orange: colors[2],
  }, position);
}

/**
 * Handle lamp brightness updates
 */
function handleLampBrightnessUpdate(value: number) {
  appStore.setLampBrightness(value);
}

/**
 * Handle projector color updates
 */
function handleProjectorColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setProjectorColors({
    color0: colors[0],
    color1: colors[1],
    color2: colors[2],
  }, position);
}

/**
 * Handle projector brightness updates
 */
function handleProjectorBrightnessUpdate(value: number) {
  appStore.setProjectorBrightness(value);
}
</script>
