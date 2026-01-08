<template>
  <div 
    class="fixed top-1/2 -translate-y-1/2 bg-gray-900 border-2 border-gray-800 rounded-full z-[1000] cursor-pointer shadow-lg"
    :style="buttonStyle"
    @mousedown.prevent="handleMouseDown" 
  >
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{
  backRoute?: string;
}>();

const router = useRouter();

// Configuration
const CIRCLE_DIAMETER = 400;
const VISIBLE_WIDTH = 25; // 15% of 300px
const TRIGGER_THRESHOLD = 150;
const EDGE_THRESHOLD = 50;

// State
const isDragging = ref(false);
const dragOffset = ref(0);
const startX = ref(0);
const hasTriggered = ref(false);
const screenTimer = ref<NodeJS.Timeout | null>(null);
const shouldGoHome = ref(false);
const HOME_TIMEOUT = 15000; // 15 seconds

// Computed Styles
const buttonStyle = computed(() => {
  // Calculate left position:
  // Start at negative offset so only VISIBLE_WIDTH is on screen
  const baseLeft = -(CIRCLE_DIAMETER - VISIBLE_WIDTH);
  const currentLeft = baseLeft + dragOffset.value;
  
  return {
    width: `${CIRCLE_DIAMETER}px`,
    height: `${CIRCLE_DIAMETER}px`,
    left: `${currentLeft}px`,
    transition: isDragging.value ? 'none' : 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.2s',
    backgroundColor: dragOffset.value > TRIGGER_THRESHOLD * 0.5 ? 'gray-900' : 'gray-800',
    opacity: 0.7
  };
});

const executeBack = () => {
    const queryBackRoute = router.currentRoute.value.query.backRoute as string;
    
    console.log('Execute Back Called', { 
      shouldGoHome: shouldGoHome.value, 
      history: window.history.length, 
      backRouteProp: props.backRoute,
      backRouteQuery: queryBackRoute
    });
    
    // Explicit route override (Query param takes precedence, then prop)
    const overrideRoute = queryBackRoute || props.backRoute;
    
    if (overrideRoute) {
      console.log('Using backRoute override:', overrideRoute);
      // 'true' is a special flag meaning "Use history back, but ignore timeout"
      if (overrideRoute === 'true') {
        router.back();
      } else {
        router.push(overrideRoute);
      }
      return;
    }

    // If user has been on this screen for long enough, go home.
    if (shouldGoHome.value) {
      console.log('Going Home due to timeout');
      router.push('/');
      return;
    }

    // Check if we should skip intermediate history entry
    const skipIntermediate = (window as any).__skipIntermediateHistory;
    
    if (skipIntermediate) {
      // Clear the flag
      (window as any).__skipIntermediateHistory = false;
      // Go back 2 steps to skip the automatic redirect
      if (window.history.length > 2) {
        window.history.go(-2);
      } else {
        router.push('/');
      }
    } else if (window.history.length <= 1) {
      // Go to home if there's no history to go back to
      router.push('/');
    } else {
      router.back();
    }
}

const resetScreenTimer = () => {
  // Clear any existing timer
  if (screenTimer.value) {
    clearTimeout(screenTimer.value);
    screenTimer.value = null;
  }
  
  // Reset state
  shouldGoHome.value = false;
  
  // Don't set timer if we are already home
  if (router.currentRoute.value.path === '/') return;

  // Start new timer
  console.log('Starting Screen Timer for Home Redirect');
  screenTimer.value = setTimeout(() => {
    console.log('Screen Timer Triggered - Next back goes Home');
    shouldGoHome.value = true;
  }, HOME_TIMEOUT);
}

// Touch Handlers
const handleTouchStart = (e: TouchEvent) => {
  // Only start if near the left edge
  if (e.touches[0].clientX <= EDGE_THRESHOLD) {
    isDragging.value = true;
    hasTriggered.value = false;
    startX.value = e.touches[0].clientX;
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value || hasTriggered.value) return; // Stop updates if triggered
  
  const currentX = e.touches[0].clientX;
  const delta = currentX - startX.value;
  
  // Only allow dragging right, clamped at threshold
  if (delta > 0) {
    dragOffset.value = Math.min(delta, TRIGGER_THRESHOLD);
    
    // Trigger as soon as threshold is reached
    if (dragOffset.value >= TRIGGER_THRESHOLD && !hasTriggered.value) {
      hasTriggered.value = true;
      executeBack();
    }
  }
};

const handleTouchEnd = () => {
  // Reset
  isDragging.value = false;
  dragOffset.value = 0;
  hasTriggered.value = false;
};

let unregisterRouterHook: (() => void) | null = null;

onMounted(() => {
  window.addEventListener('touchstart', handleTouchStart);
  window.addEventListener('touchmove', handleTouchMove);
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchEnd);
  
  resetScreenTimer();
  
  // Reset on route change to prevent stuck state
  // We use a local variable to store the cleanup function
  unregisterRouterHook = router.afterEach(() => {
    isDragging.value = false;
    dragOffset.value = 0;
    hasTriggered.value = false;
    
    resetScreenTimer();
  });
});

onUnmounted(() => {
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleTouchEnd);
  window.removeEventListener('touchcancel', handleTouchEnd);
  
  if (screenTimer.value) {
      clearTimeout(screenTimer.value);
      screenTimer.value = null;
  }
  
  if (unregisterRouterHook) {
    unregisterRouterHook();
  }
});

// Mouse Handlers (for testing/desktop)
const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  hasTriggered.value = false;
  startX.value = e.clientX;
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const delta = e.clientX - startX.value;
  
  if (delta > 0) {
    dragOffset.value = Math.min(delta, TRIGGER_THRESHOLD);
    
    // Trigger as soon as threshold is reached
    if (dragOffset.value >= TRIGGER_THRESHOLD && !hasTriggered.value) {
      hasTriggered.value = true;
      executeBack();
    }
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
  dragOffset.value = 0;
  hasTriggered.value = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
};
</script>
