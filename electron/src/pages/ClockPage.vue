<template>
  <div 
    tabindex="0" 
    ref="clockContainer"
    class="clock-page-container"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mousemove="handleMouseMove"
  >
    <div :class="['clock-wrapper', { dimmed: isDimmed }]">
      <ClockComponent ref="clockComponent" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { isGlobalSoundPlaying } from '../services/audioService';
import ClockComponent from '../components/ClockComponent.vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { useGestures } from '../utils/gestures';

const router = useRouter();
const clockContainer = ref<HTMLDivElement | null>(null);
const inactivityTimer = ref<number | null>(null);
const isDimmed = ref(false);

// Setup gesture handlers
const gestureHandlers = useGestures({
  onDoubleTap: () => {
    // Add a small delay before navigation to ensure the gesture is fully processed
    // and won't leak to the next page
    setTimeout(() => {
      router.push('/menu');
    }, 100);
  },
  onTap: () => {
    // Restore brightness if dimmed
    if (isDimmed.value) {
      restoreBrightness();
    }
    // Reset inactivity timer
    resetInactivityTimer();
  },
});

// Gesture event handlers
const handleTouchStart = gestureHandlers.onTouchstart;
const handleTouchEnd = gestureHandlers.onTouchend;
const handleTouchMove = gestureHandlers.onTouchmove;
const handleMouseDown = gestureHandlers.onMousedown;
const handleMouseUp = gestureHandlers.onMouseup;
const handleMouseMove = gestureHandlers.onMousemove;

// Navigation function (keep for right-click compatibility)
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

// Start the inactivity timer
const startInactivityTimer = () => {
  // Clear any existing timer first
  if (inactivityTimer.value !== null) {
    window.clearTimeout(inactivityTimer.value);
  }

  // Set new timer - after 30 seconds, dim the clock
  inactivityTimer.value = window.setTimeout(() => {
    dimBrightness();
  }, 30000);
};

// Reset the inactivity timer
const resetInactivityTimer = () => {
  startInactivityTimer();
};

// Dim the clock brightness to 15%
const dimBrightness = () => {
  isDimmed.value = true;
};

// Restore the clock brightness to 100%
const restoreBrightness = () => {
  isDimmed.value = false;
};

onMounted(() => {
  window.addEventListener('contextmenu', goToMenu);
  window.addEventListener('wheel', handleWheelEvent, { passive: false });

  // Start the inactivity timer
  startInactivityTimer();
});

onUnmounted(() => {
  window.removeEventListener('contextmenu', goToMenu);
  window.removeEventListener('wheel', handleWheelEvent);

  // Clean up the timer if it exists
  if (inactivityTimer.value !== null) {
    window.clearTimeout(inactivityTimer.value);
    inactivityTimer.value = null;
  }
});
</script>

<style scoped>
.clock-page-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

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
