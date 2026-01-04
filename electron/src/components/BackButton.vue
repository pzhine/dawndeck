<template>
  <div 
    class="fixed top-1/2 -translate-y-1/2 bg-gray-900 border-2 border-gray-800 rounded-full z-[1000] cursor-pointer shadow-lg"
    :style="buttonStyle"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
    @mousedown.prevent="handleMouseDown" 
  >
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Configuration
const CIRCLE_DIAMETER = 400;
const VISIBLE_WIDTH = 25; // 15% of 300px
const TRIGGER_THRESHOLD = 150;

// State
const isDragging = ref(false);
const dragOffset = ref(0);
const startX = ref(0);
const hasTriggered = ref(false);

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
    opacity: 0.5
  };
});

// Touch Handlers
const handleTouchStart = (e: TouchEvent) => {
  isDragging.value = true;
  hasTriggered.value = false;
  startX.value = e.touches[0].clientX;
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  const currentX = e.touches[0].clientX;
  const delta = currentX - startX.value;
  
  // Only allow dragging right, clamped at threshold
  if (delta > 0) {
    dragOffset.value = Math.min(delta, TRIGGER_THRESHOLD);
    
    // Trigger as soon as threshold is reached
    if (dragOffset.value >= TRIGGER_THRESHOLD && !hasTriggered.value) {
      hasTriggered.value = true;
      router.back();
    }
  }
};

const handleTouchEnd = () => {
  // Reset
  isDragging.value = false;
  dragOffset.value = 0;
  hasTriggered.value = false;
};

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
      router.back();
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
