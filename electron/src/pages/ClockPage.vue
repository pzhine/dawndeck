<template>
  <RadialMenu 
    :upper-items="upperMenuItems" 
    :lower-items="lowerMenuItems"
    :on-show="onMenuShow"
  >
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
const isSoundPlaying = ref(false);

const lampIcon = feather.icons['sun'].toSvg();
const musicIcon = feather.icons['volume-2'].toSvg();
const alarmIcon = feather.icons['bell'].toSvg();
const settingsIcon = feather.icons['settings'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Lights', 
    icon: lampIcon, 
    route: '/ambience-control',
    hold: true,
    active: appStore.lampActive || appStore.projectorActive,
    quickAction: async () => {
      // Toggle both lamp and projector
      await appStore.toggleLampActive();
      await appStore.toggleProjectorActive();
    }
  },
  { 
    label: 'Sounds', 
    icon: musicIcon, 
    route: '/media-player', 
    active: isSoundPlaying.value || isBTPlaying.value,
    hold: true,
    quickAction: async () => {
      // If sound or bluetooth is playing, pause/resume. Otherwise go to media player
      if (isGlobalSoundPlaying()) {
        const { pauseGlobalSound, resumeGlobalSound, isGlobalSoundPaused } = await import('../services/audioService');
        if (isGlobalSoundPaused()) {
          resumeGlobalSound();
        } else {
          pauseGlobalSound();
        }
        // Update state after a short delay to reflect the change
        setTimeout(() => {
          isSoundPlaying.value = isGlobalSoundPlaying();
        }, 100);
      } else if (isBTPlaying.value) {
        // Toggle bluetooth playback
        await (window as any).electronAPI?.bluetoothMedia?.sendCommand('pause');
        // Update state after a short delay
        setTimeout(async () => {
          isBTPlaying.value = await getBluetoothStatus();
        }, 100);
      } else {
        // No sound playing, go to media player
        router.push('/media-player');
      }
    }
  },
]);
const lowerMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Alarm', 
    icon: alarmIcon, 
    route: '/alarm', 
    active: appStore.alarmActive,
    hold: true,
    quickAction: () => {
      appStore.toggleAlarmActive();
    }
  },
  { label: 'Settings', icon: settingsIcon, route: '/settings' },
]);

// Navigation function
const goToMenu = (event: MouseEvent) => {
  if (event.button !== 2) return; // Only handle right-click
  event.preventDefault();
  event.stopPropagation();
  router.push('/menu');
};

const onMenuShow = async () => {
  isBTPlaying.value = await getBluetoothStatus();
  isSoundPlaying.value = isGlobalSoundPlaying();
};

onMounted(() => {
  window.addEventListener('mousedown', goToMenu);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', goToMenu);

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
