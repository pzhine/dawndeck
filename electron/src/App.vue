<template>
  <div class="app-container">
    <div class="round-display">
      <BackButton v-if="route.path !== '/'" />
      <router-view />
      <!-- <TimeoutRedirect
        :ms="45000"
        redirectRoute="/"
        resetOnActivity="wheel"
        :excludeRoutes="[
          'SunrisePlayer', 'sunrise-player',   
          'Wifi', 'wifi', 
          'WifiPassword', 'wifi-password', 
          'WifiConnect', 'wifi-connect',
          'TouchInputTester', 'touch-input-tester'
        ]"
      /> -->
      <UpdateIndicator />
      <BluetoothNotifications />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from './stores/appState';
import { computed, watch, onMounted, onUnmounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import UpdateIndicator from './components/UpdateIndicator.vue';
import BackButton from './components/BackButton.vue';
// import TimeoutRedirect from './components/TimeoutRedirect.vue';
import BluetoothNotifications from './components/BluetoothNotifications.vue';
import { setOnSoundEndedCallback, playGlobalSound, stopGlobalSound, isGlobalSoundPlaying } from './services/audioService';

const appStore = useAppStore();
const router = useRouter();
const route = useRoute();

// Screen sleep state
const isScreenAsleep = ref(false);
const awakeBrightness = ref(appStore.screenBrightness);
let lastActivityTime = Date.now();
let sleepCheckInterval: NodeJS.Timeout | null = null;

// Computed property to get text brightness as a CSS filter value
const brightnessFilter = computed(() => {
  // On Linux (production), hardware controls brightness directly - skip CSS filter
  // In dev mode (macOS), use CSS filter since we don't have hardware control
  if (!appStore.config.dev.mockSystemAudio) {
    return 'brightness(1)'; // No CSS brightness adjustment on Linux
  }
  
  // Convert brightness percentage to a curve that starts fast and decelerates
  // Map input range [0-100] to output range [0.5-1.0] with square root scaling
  const normalizedInput = appStore.screenBrightness / 100; // Convert to 0-1 range
  const sqrtValue = Math.sqrt(normalizedInput); // Apply square root formula (√x)
  const brightnessValue = 0.5 + sqrtValue * 0.5; // Map to 0.5-1.0 range
  console.log(`Brightness Filter Value: ${brightnessValue}`);
  return `brightness(${brightnessValue})`;
});

// Screen sleep functions
function resetActivityTimer() {
  lastActivityTime = Date.now();
  
  // If screen is asleep, wake it up
  if (isScreenAsleep.value) {
    wakeScreen();
  }
}

function sleepScreen() {
  if (isScreenAsleep.value) return; // Already asleep
  
  console.log('Screen going to sleep');
  isScreenAsleep.value = true;
  awakeBrightness.value = appStore.screenBrightness;
  appStore.setScreenBrightness(0);
}

function wakeScreen() {
  if (!isScreenAsleep.value) return; // Already awake
  
  console.log('Screen waking up');
  isScreenAsleep.value = false;
  appStore.setScreenBrightness(awakeBrightness.value);
}

function checkScreenSleep() {
  if (isScreenAsleep.value) return; // Don't check if already asleep
  
  const timeoutMs = appStore.screenSleepTimeout * 1000;
  const timeSinceActivity = Date.now() - lastActivityTime;
  
  if (timeSinceActivity >= timeoutMs) {
    sleepScreen();
  }
}

// Handle user activity (tap/click anywhere on the screen)
function handleUserActivity(event: Event) {
  // If screen is asleep, prevent the event from propagating to other handlers
  if (isScreenAsleep.value) {
    event.stopPropagation();
    event.preventDefault();
  }
  resetActivityTimer();
}

// Update CSS variable when text brightness changes
watch(
  () => brightnessFilter.value,
  (newValue) => {
    document.documentElement.style.setProperty('--brightness-filter', newValue);
  },
  { immediate: true }
);

// Listen for navigation events from main process
const handleNavigate = (_event: any, pageName: string) => {
  console.log('Navigating to:', pageName);
  router.push({ name: pageName });
};

// Handle BT media playback starting
const handleBTPlaybackStarted = () => {
  console.log('BT media playback started, stopping global sound and navigating to MediaPlayer');
  
  // Stop global sound if playing
  if (isGlobalSoundPlaying()) {
    stopGlobalSound();
    // Emit event to notify components that sound state changed
    window.dispatchEvent(new CustomEvent('sound-changed'));
  }
  
  // Navigate to MediaPlayer if not already there
  if (route.name !== 'MediaPlayer') {
    // Set flag to tell BackButton to skip intermediate history entry
    (window as any).__skipIntermediateHistory = true;
    router.push({ name: 'MediaPlayer' });
  }
};

// Set initial value on mount
onMounted(() => {
  document.documentElement.style.setProperty(
    '--brightness-filter',
    brightnessFilter.value
  );
  
  // Set up screen sleep timer (check every second)
  sleepCheckInterval = setInterval(checkScreenSleep, 1000);
  
  // Add global event listeners for user activity
  document.addEventListener('click', handleUserActivity, true);
  document.addEventListener('touchstart', handleUserActivity, true);
  document.addEventListener('wheel', handleUserActivity, true);
  
  // Set up global auto-advance callback for playlist
  setOnSoundEndedCallback(() => {
    console.log('Sound ended, auto-advancing to next track');
    const nextSound = appStore.moveToNextSound();
    if (nextSound) {
      const context = nextSound._context || {};
      const previewUrl = nextSound.previews ? nextSound.previews['preview-hq-mp3'] : nextSound.previewUrl;
      
      playGlobalSound(
        {
          id: nextSound.id.toString(),
          name: nextSound.name,
          previewUrl: previewUrl,
          duration: nextSound.duration,
          currentTime: 0,
          category: context.category || '',
          country: context.country || '',
          soundId: nextSound.id,
        },
        false // don't loop
      );
      
      // Emit custom event for components to listen to
      window.dispatchEvent(new CustomEvent('sound-changed'));
    }
  });
  
  if (window.ipcRenderer) {
    window.ipcRenderer.on('navigate-to-page', handleNavigate);
    window.ipcRenderer.on('bluetooth-media:playback-started', handleBTPlaybackStarted);
  }
});

// Clean up listener on unmount
onUnmounted(() => {
  setOnSoundEndedCallback(null);
  
  // Clean up screen sleep timer and event listeners
  if (sleepCheckInterval) {
    clearInterval(sleepCheckInterval);
  }
  document.removeEventListener('click', handleUserActivity, true);
  document.removeEventListener('touchstart', handleUserActivity, true);
  document.removeEventListener('wheel', handleUserActivity, true);
  
  if (window.ipcRenderer) {
    window.ipcRenderer.off('navigate-to-page', handleNavigate);
    window.ipcRenderer.off('bluetooth-media:playback-started', handleBTPlaybackStarted);
  }
});
</script>

<style>
/* Global text and border brightness styles */
:root {
  --brightness-filter: brightness(0.8); /* Default brightness */
}

/* Apply brightness filter to all text */
body {
  color-scheme: dark;
}

/* Apply brightness filter to text and borders */
* {
  filter: var(--brightness-filter);
}
</style>
