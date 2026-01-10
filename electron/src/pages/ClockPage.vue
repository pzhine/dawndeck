<template>
  <RadialMenu :items="menuItems" :skip-positions="[]" :on-show="onMenuShow">
    <div tabindex="0" ref="clockContainer" class="page-container">
      <div :class="['clock-wrapper', { dimmed: isDimmed }]">
        <ClockComponent ref="clockComponent" />
      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { isGlobalSoundPlaying, getBluetoothStatus } from '../services/audioService';
import ClockComponent from '../components/ClockComponent.vue';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useAppStore } from '../stores/appState';
import feather from 'feather-icons';

const router = useRouter();
const appStore = useAppStore();
const inactivityTimer = ref<number | null>(null);
const isDimmed = ref(false);
const isBTPlaying = ref(false);

const lampIcon = feather.icons['sun'].toSvg();
const musicIcon = feather.icons['music'].toSvg();
const projectorIcon = feather.icons['sunrise'].toSvg();
const alarmIcon = feather.icons['bell'].toSvg();
const sleepIcon = feather.icons['moon'].toSvg();
const settingsIcon = feather.icons['settings'].toSvg();

const mute = () => {
  appStore.setVolume(0);
  appStore.setLampBrightness(0);
  appStore.setProjectorBrightness(0);
};

const menuItems = computed<MenuItem[]>(() => [
  { label: 'Lamp', icon: lampIcon, route: '/ambience-control' },
  { label: 'Sounds & Music', icon: musicIcon, route: '/media-player', active: isGlobalSoundPlaying() || isBTPlaying.value },
  { label: 'Projector', icon: projectorIcon, route: '/projector-control', active: appStore.projectorActive },
  { label: 'Alarm', icon: alarmIcon, route: '/alarm', active: appStore.alarmActive },
  { label: 'Sleep', icon: sleepIcon, action: mute },
  { label: 'Settings', icon: settingsIcon, route: '/wifi' },
]);

// Navigation function
const goToMenu = (event: MouseEvent) => {
  if (event.button !== 2) return; // Only handle right-click
  event.preventDefault();
  event.stopPropagation();
  router.push('/menu');
};

// Handle wheel event for volume or brightness control
const handleWheelEvent = (event: WheelEvent) => {
  event.preventDefault();

  // Determine mode based on whether sound is playing
  const mode = isGlobalSoundPlaying() ? 'volume' : 'lampBrightness';

  // Navigate to LevelControl page with appropriate mode
  router.push(`/level/${mode}`);
};

// Handle any tap/click on the screen to restore brightness
const handleTap = (event: MouseEvent) => {
  // If it's a right-click, let goToMenu handle it
  if (event.button === 2) return;

  // Otherwise, restore brightness if dimmed
  if (isDimmed.value) {
    restoreBrightness();
  }
};

// Dim the clock brightness to 15%
const dimBrightness = () => {
  isDimmed.value = true;
};

// Restore the clock brightness to 100%
const restoreBrightness = () => {
  isDimmed.value = false;
};

const onMenuShow = async () => {
  isBTPlaying.value = await getBluetoothStatus();
};

onMounted(() => {
  window.addEventListener('mousedown', goToMenu);
  window.addEventListener('mousedown', handleTap);
  window.addEventListener('wheel', handleWheelEvent, { passive: false });
});

onUnmounted(() => {
  window.removeEventListener('mousedown', goToMenu);
  window.removeEventListener('mousedown', handleTap);
  window.removeEventListener('wheel', handleWheelEvent);

  // Clean up the timer if it exists
  if (inactivityTimer.value !== null) {
    window.clearTimeout(inactivityTimer.value);
    inactivityTimer.value = null;
  }
});
</script>

<style scoped>
.clock-wrapper {
  /* Default state - full brightness and color */
  filter: brightness(1) saturate(1);
  transition: filter 0.5s ease-in-out;
}

.clock-wrapper.dimmed {
  /* Dimmed state - 15% brightness and greyscale */
  filter: brightness(0.23) saturate(0);
  transition: filter 10s ease-out;
}
</style>
