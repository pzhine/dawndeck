<template>
  <div 
    class="w-full h-full overflow-hidden relative touch-none" 
    ref="containerRef"
    @wheel="handleWheel"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
  >
    <div class="w-full will-change-transform" ref="contentRef">
      <div class="scroll-spacer" :style="{ height: spacerHeight + 'px' }"></div>
      
      <!-- Title Item -->
      <div 
        v-if="showTitle && title"
        class="round-item-wrapper flex justify-center items-center py-3 w-full origin-center border-b border-white/20"
      >
        <div class="round-item-content flex justify-center items-center w-[90%] text-[1.2rem] text-center text-white font-bold tracking-wider">
          {{ title }}
        </div>
      </div>

      <!-- Mode 1: Render items prop -->
      <template v-if="items && items.length > 0">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="round-item-wrapper flex justify-center items-center py-3 w-full origin-center border-b border-white/20"
          @click="handleItemClick(item)"
        >
          <div 
            class="round-item-content flex justify-between items-center w-[90%] text-[1.2rem] text-center"
            :class="isObject(item) && item.customClass ? item.customClass : ''"
          >
            <span class="truncate">{{ isObject(item) ? item.label : item }}</span>
            <span v-if="isObject(item) && 'value' in item" class="value-text ml-2.5 opacity-80">
              {{ item.value }}
            </span>
          </div>
        </div>
      </template>

      <!-- Mode 2: Render slot content -->
      <div v-else ref="slotContainerRef" class="slot-container">
        <slot></slot>
      </div>

      <div class="scroll-spacer" :style="{ height: spacerHeight + 'px' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useGestures } from '../utils/gestures';
import type { ListItem } from './InteractiveList.vue';

const props = withDefaults(defineProps<{
  items?: ListItem[];
  title?: string;
  showTitle?: boolean;
  showBackButton?: boolean;
  backButtonLabel?: string;
  swipeScrollCount?: number; // Number of items to scroll per swipe
}>(), {
  swipeScrollCount: 2,
});

const emit = defineEmits<{
  (e: 'select', item: ListItem): void;
  (e: 'back'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const slotContainerRef = ref<HTMLElement | null>(null);
const spacerHeight = ref(300);

// Scroll state
const scrollTop = ref(0);
const maxScroll = ref(0);
const velocity = ref(0);
const targetScrollTop = ref(0); // Target for animated scrolling
let animationFrameId: number | null = null;

// Item height tracking for discrete scrolling
const itemHeight = ref(0);

// Track swipe state for immediate visual feedback
const isSwipeInProgress = ref(false);
const swipeStartY = ref(0);
const currentSwipeDelta = ref(0);

// Helper to check if item is object
const isObject = (item: any): item is Extract<ListItem, object> => {
  return typeof item === 'object' && item !== null;
};

const handleItemClick = (item: ListItem) => {
  // Don't trigger clicks while swiping
  if (isSwipeInProgress.value) return;
  
  if (isObject(item) && item.onSelect) {
    item.onSelect();
  }
  emit('select', item);
};

const updateLayout = () => {
  if (!containerRef.value || !contentRef.value) return;
  
  const containerHeight = containerRef.value.clientHeight;
  
  // Set spacer to 35% of container height (top of the stable zone)
  // The stable zone is the middle 50%, so it starts at 35% and ends at 75%
  spacerHeight.value = containerHeight * 0.35; 
  
  // Calculate average item height for discrete scrolling
  const wrappers = contentRef.value.querySelectorAll('.round-item-wrapper');
  if (wrappers.length > 0) {
    const firstItem = wrappers[0] as HTMLElement;
    itemHeight.value = firstItem.offsetHeight;
  }
  
  // Recalculate max scroll
  // We need to wait for spacer update to affect scrollHeight
  nextTick(() => {
    if (!containerRef.value || !contentRef.value) return;
    // Total scrollable distance is content height minus container height
    // But since we use spacers, the content is taller.
    // We want to scroll from top (0) to bottom.
    maxScroll.value = Math.max(0, contentRef.value.scrollHeight - containerHeight);

    // Force update transforms after layout change
    // Use setTimeout to ensure DOM has fully updated and painted
    setTimeout(() => {
      applyTransforms();
    }, 50);
  });
};

// --- Gesture Handlers ---

const scrollByItems = (count: number) => {
  if (!itemHeight.value) return;
  
  // Calculate target scroll position
  const scrollDelta = count * itemHeight.value;
  targetScrollTop.value = scrollTop.value + scrollDelta;
  
  // Clamp to valid range
  targetScrollTop.value = Math.max(0, Math.min(targetScrollTop.value, maxScroll.value));
  
  // Start animation if not already running
  if (!animationFrameId) {
    animationLoop();
  }
};

// Track touch state for immediate feedback
let touchStartY = 0;
let touchStartTime = 0;

const gestureHandlers = useGestures({
  onSwipeUp: () => {
    // Swipe up = scroll down (show items below)
    isSwipeInProgress.value = false;
    currentSwipeDelta.value = 0;
    scrollByItems(props.swipeScrollCount);
  },
  onSwipeDown: () => {
    // Swipe down = scroll up (show items above)
    isSwipeInProgress.value = false;
    currentSwipeDelta.value = 0;
    scrollByItems(-props.swipeScrollCount);
  },
  onSwipeRight: () => {
    isSwipeInProgress.value = false;
    currentSwipeDelta.value = 0;
    emit('back');
  },
}, {
  swipeThreshold: 50, // Back to reasonable threshold
  swipeVelocityThreshold: 0.3, // Default velocity
  tapMaxDistance: 15, // Reasonable tap tolerance
});

// Custom touch handlers for immediate visual feedback
const handleTouchStart = (e: TouchEvent) => {
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  isSwipeInProgress.value = true;
  currentSwipeDelta.value = 0;
  gestureHandlers.onTouchstart(e);
};

const handleTouchMove = (e: TouchEvent) => {
  if (isSwipeInProgress.value) {
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY - currentY;
    
    // Provide immediate visual feedback by updating scroll position
    // Scale down the feedback (0.3x) so it doesn't interfere with final snap
    currentSwipeDelta.value = deltaY * 0.3;
    
    // Apply the preview scroll
    const previewScroll = scrollTop.value + currentSwipeDelta.value;
    if (contentRef.value) {
      contentRef.value.style.transform = `translateY(${-previewScroll}px)`;
    }
  }
  gestureHandlers.onTouchmove(e);
};

const handleTouchEnd = (e: TouchEvent) => {
  // Reset preview
  isSwipeInProgress.value = false;
  currentSwipeDelta.value = 0;
  
  // Let gesture handler process the swipe
  gestureHandlers.onTouchend(e);
};

// Mouse handlers for development
const handleMouseDown = (e: MouseEvent) => {
  touchStartY = e.clientY;
  touchStartTime = Date.now();
  isSwipeInProgress.value = true;
  currentSwipeDelta.value = 0;
  gestureHandlers.onMousedown(e);
};

const handleMouseMove = (e: MouseEvent) => {
  if (isSwipeInProgress.value) {
    const currentY = e.clientY;
    const deltaY = touchStartY - currentY;
    currentSwipeDelta.value = deltaY * 0.3;
    
    const previewScroll = scrollTop.value + currentSwipeDelta.value;
    if (contentRef.value) {
      contentRef.value.style.transform = `translateY(${-previewScroll}px)`;
    }
  }
  gestureHandlers.onMousemove(e);
};

const handleMouseUp = (e: MouseEvent) => {
  isSwipeInProgress.value = false;
  currentSwipeDelta.value = 0;
  gestureHandlers.onMouseup(e);
};

// --- Physics & Scroll Logic ---

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  velocity.value += e.deltaY * 0.5; // Accumulate velocity
  // Wake up loop if needed
  if (!animationFrameId) {
    animationLoop();
  }
};

const animationLoop = () => {
  // Smooth scroll to target position
  const diff = targetScrollTop.value - scrollTop.value;
  
  if (Math.abs(diff) > 0.5) {
    // Ease towards target (exponential smoothing)
    scrollTop.value += diff * 0.15;
  } else {
    // Snap to target when close enough
    scrollTop.value = targetScrollTop.value;
  }
  
  // Apply friction to velocity (for wheel scrolling)
  velocity.value *= 0.92;
  if (Math.abs(velocity.value) < 0.1) {
    velocity.value = 0;
  } else {
    targetScrollTop.value += velocity.value;
    // Clamp target
    targetScrollTop.value = Math.max(0, Math.min(targetScrollTop.value, maxScroll.value));
  }

  // Apply transform to content wrapper (unless we're showing swipe preview)
  if (contentRef.value && !isSwipeInProgress.value) {
    contentRef.value.style.transform = `translateY(${-scrollTop.value}px)`;
  }

  // Apply item transforms
  applyTransforms();

  // Continue animation if there's movement
  if (Math.abs(diff) > 0.5 || Math.abs(velocity.value) > 0.1) {
    animationFrameId = requestAnimationFrame(animationLoop);
  } else {
    animationFrameId = null;
  }
};

const applyTransforms = () => {
  if (!containerRef.value || !contentRef.value) return;

  const container = containerRef.value;
  const containerRect = container.getBoundingClientRect();
  const containerCenter = containerRect.top + containerRect.height / 2;
  const radius = containerRect.height / 2;

  // Get all item elements directly from DOM
  let elements: HTMLElement[] = [];
  // Try to find items by class first (Mode 1)
  const wrappers = contentRef.value.querySelectorAll('.round-item-wrapper');
  if (wrappers.length > 0) {
    elements = Array.from(wrappers) as HTMLElement[];
  } else if (slotContainerRef.value) {
    // Fallback for slot mode (Mode 2)
    elements = Array.from(slotContainerRef.value.children) as HTMLElement[];
  }

  elements.forEach((el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(containerCenter - itemCenter);
    
    // Calculate scale and opacity based on distance from center
    // Stable zone: middle 50% of screen height (distance < 0.5 * radius)
    const stableThreshold = radius * 0.5;
    let transformFactor = 0;
    
    if (distanceFromCenter > stableThreshold) {
      // Map the remaining distance (from 0.5R to R) to 0..1
      const distOverThreshold = distanceFromCenter - stableThreshold;
      const transformZoneSize = radius - stableThreshold;
      transformFactor = Math.min(distOverThreshold / transformZoneSize, 1);
    }
    
    // Opacity: 1.0 in stable zone, fading out in transform zone
    const opacity = 1 - Math.pow(transformFactor, 3);

    // Apply opacity
    el.style.opacity = `${Math.max(0, opacity)}`;

    // Scale: 1.0 in stable zone, tapering to ~0.85 at edges
    const scale = 1 - (transformFactor * 0.15);
    el.style.transform = `scale(${scale})`;

    // Ensure content width is fixed
    const content = el.querySelector('.round-item-content') as HTMLElement;
    if (content) {
      content.style.width = '90%';
    }
  });
};

// Resize observer to handle container size changes
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateLayout();
  
  // Initialize target scroll position
  targetScrollTop.value = scrollTop.value;
  
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateLayout();
    });
    resizeObserver.observe(containerRef.value);
  }
  
  // If using slots, we might need to watch for DOM changes
  if (!props.items && slotContainerRef.value) {
    const mutationObserver = new MutationObserver(() => {
      updateLayout();
    });
    mutationObserver.observe(slotContainerRef.value, { childList: true, subtree: true });
  }
  
  // Start loop once to set initial state
  animationLoop();
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

watch(() => props.items, () => {
  nextTick(() => {
    updateLayout();
    animationLoop();
  });
}, { deep: true });

</script>

<style scoped>
/* Remove border from the last item */
.round-item-wrapper:last-child .round-item-content {
  border-bottom: none;
}

.slot-container > * {
  transform-origin: center center;
}
</style>