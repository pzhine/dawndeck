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
const effectiveScreenBrightness = ref(appStore.screenBrightness); // The actual brightness to display
let lastActivityTime = 0; // Will be initialized in onMounted
let sleepCheckInterval: NodeJS.Timeout | null = null;

// Watch for changes to the store's screen brightness and update effective brightness when awake
watch(
  () => appStore.screenBrightness,
  (newBrightness) => {
    if (!isScreenAsleep.value) {
      effectiveScreenBrightness.value = newBrightness;
    }
  }
);

// Computed property to get text brightness as a CSS filter value
const brightnessFilter = computed(() => {
  // On Linux (production), hardware controls brightness directly - skip CSS filter
  // In dev mode (macOS), use CSS filter to simulate screen brightness
  if (!appStore.config.dev.mockBrightness) {
    return 'brightness(1)'; // No CSS brightness adjustment on Linux
  }
  
  // Simulate screen brightness on desktop
  // When screen is at 0% (asleep), CSS brightness should be 0
  // When screen is at 100%, CSS brightness should be 1
  // Apply square root curve for more natural feel at lower brightness
  const normalizedInput = effectiveScreenBrightness.value / 100; // Convert to 0-1 range
  
  if (normalizedInput === 0) {
    return 'brightness(0)'; // Fully black when asleep
  }
  
  const sqrtValue = Math.sqrt(normalizedInput); // Apply square root formula (√x)
  const brightnessValue = 0.8 + sqrtValue * 0.2; // Map to 0.8-1.0 range for visible brightness
  console.log(`Brightness Filter Value: ${brightnessValue} (screen brightness: ${effectiveScreenBrightness.value}%)`);
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
  // Set effective brightness to 0 without touching the store
  effectiveScreenBrightness.value = 0;
  
  // Apply hardware brightness on Linux (if not mocked)
  if (!appStore.config.dev.mockBrightness) {
    window.ipcRenderer.invoke('set-screen-brightness', 0);
  }
}

function wakeScreen() {
  if (!isScreenAsleep.value) return; // Already awake
  
  console.log('Screen waking up');
  isScreenAsleep.value = false;
  // Restore effective brightness from the store's saved value
  effectiveScreenBrightness.value = appStore.screenBrightness;
  
  // Apply hardware brightness on Linux (if not mocked)
  if (!appStore.config.dev.mockBrightness) {
    window.ipcRenderer.invoke('set-screen-brightness', appStore.screenBrightness);
  }
}

function checkScreenSleep() {
  if (isScreenAsleep.value) return; // Don't check if already asleep
  if (!appStore.screenSleepEnabled) return; // Don't sleep if disabled
  
  const timeoutMs = (appStore.screenSleepTimeout || 30) * 1000;
  const timeSinceActivity = Date.now() - lastActivityTime;
  
  if (timeSinceActivity >= timeoutMs) {
    sleepScreen();
  }
}

// Handle user activity (tap/click anywhere on the screen)
function handleUserActivity(event: Event) {
  // If screen is asleep, prevent the event from propagating to other handlers
  if (isScreenAsleep.value) {
    event.stopImmediatePropagation(); // Prevent all other handlers from firing
    event.preventDefault(); // Prevent default browser behavior
    resetActivityTimer(); // Wake the screen
    return; // Don't process any further
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
  
  // Initialize activity timer now that UI is ready
  lastActivityTime = Date.now();
  
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
