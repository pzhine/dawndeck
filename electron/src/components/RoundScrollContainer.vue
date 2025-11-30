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
import { useFilteredScroll } from '../utils/filteredScroll';
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

// Track if we're in continuous scroll mode
const isScrolling = ref(false);

// Helper to check if item is object
const isObject = (item: any): item is Extract<ListItem, object> => {
  return typeof item === 'object' && item !== null;
};

const handleItemClick = (item: ListItem) => {
  // Don't trigger clicks while scrolling
  if (isScrolling.value) return;
  
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

// --- Scroll Handlers ---

// Track momentum for inertia scrolling
let lastScrollDelta = 0;
let lastScrollTime = 0;

// Continuous scroll with Kalman filtering
const scrollHandlers = useFilteredScroll({
  onScrollStart: () => {
    isScrolling.value = true;
    velocity.value = 0; // Stop any momentum
    lastScrollDelta = 0;
    lastScrollTime = Date.now();
  },
  onScroll: (deltaY: number) => {
    const currentTime = Date.now();
    
    // Apply velocity-based acceleration
    // Calculate scroll speed based on the magnitude of movement
    const speed = Math.abs(deltaY);
    
    // Acceleration curve: slow movements stay 1x, fast movements get up to 2.5x multiplier
    // This makes fast scrolling feel more responsive
    let multiplier = 1;
    if (speed > 5) {
      // Apply exponential curve for speeds above 5px
      multiplier = Math.min(1 + (speed - 5) / 10, 2.5);
    }
    
    const acceleratedDelta = deltaY * multiplier;
    
    // Track for momentum calculation
    lastScrollDelta = acceleratedDelta;
    lastScrollTime = currentTime;
    
    // Directly update scroll position (not target, for immediate response)
    scrollTop.value = scrollTop.value + acceleratedDelta;
    targetScrollTop.value = scrollTop.value;
    
    // Clamp to valid range
    scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
    targetScrollTop.value = scrollTop.value;
    
    // Start animation if not already running (for visual updates)
    if (!animationFrameId) {
      animationLoop();
    }
  },
  onScrollEnd: () => {
    isScrolling.value = false;
    
    // Apply momentum based on last scroll velocity
    const timeSinceLastScroll = Date.now() - lastScrollTime;
    
    // Only apply momentum if the last scroll was recent (within 150ms)
    if (timeSinceLastScroll < 150 && Math.abs(lastScrollDelta) > 1) {
      // Convert delta to velocity (scale based on speed for natural feel)
      // Faster movements get more momentum
      const momentumMultiplier = Math.min(Math.abs(lastScrollDelta) / 5, 3);
      velocity.value = lastScrollDelta * momentumMultiplier;
      
      // Start animation loop for momentum
      if (!animationFrameId) {
        animationLoop();
      }
    }
  },
}, {
  filterProcessNoise: 0.01,
  filterMeasurementNoise: 20, // Lower value = more smoothing, higher = more responsive
  scrollEndDelay: 100, // Shorter delay to capture momentum better
});

// Swipe right gesture for back navigation
const gestureHandlers = useGestures({
  onSwipeRight: () => {
    emit('back');
  },
});

// Combine both handler sets
const handleTouchStart = (e: TouchEvent) => {
  scrollHandlers.onTouchstart(e);
  gestureHandlers.onTouchstart(e);
};

const handleTouchMove = (e: TouchEvent) => {
  scrollHandlers.onTouchmove(e);
  gestureHandlers.onTouchmove(e);
};

const handleTouchEnd = (e: TouchEvent) => {
  scrollHandlers.onTouchend(e);
  gestureHandlers.onTouchend(e);
};

const handleMouseDown = (e: MouseEvent) => {
  scrollHandlers.onMousedown(e);
  gestureHandlers.onMousedown(e);
};

const handleMouseMove = (e: MouseEvent) => {
  scrollHandlers.onMousemove(e);
  gestureHandlers.onMousemove(e);
};

const handleMouseUp = (e: MouseEvent) => {
  scrollHandlers.onMouseup(e);
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
  // During touch scrolling, skip the smooth interpolation
  if (!isScrolling.value) {
    // Smooth scroll to target position only when not actively scrolling
    const diff = targetScrollTop.value - scrollTop.value;
    
    if (Math.abs(diff) > 0.5) {
      // Ease towards target (exponential smoothing)
      scrollTop.value += diff * 0.15;
    } else {
      // Snap to target when close enough
      scrollTop.value = targetScrollTop.value;
    }
  }
  
  // Apply friction to velocity (for momentum and wheel scrolling)
  if (!isScrolling.value && Math.abs(velocity.value) > 0.1) {
    velocity.value *= 0.92; // Friction
    scrollTop.value += velocity.value;
    targetScrollTop.value = scrollTop.value;
    
    // Clamp to valid range
    scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
    targetScrollTop.value = scrollTop.value;
  } else if (Math.abs(velocity.value) <= 0.1) {
    velocity.value = 0;
  }

  // Apply transform to content wrapper
  if (contentRef.value) {
    contentRef.value.style.transform = `translateY(${-scrollTop.value}px)`;
  }

  // Apply item transforms
  applyTransforms();

  // Continue animation if there's movement or active scrolling
  const diff = targetScrollTop.value - scrollTop.value;
  if (isScrolling.value || Math.abs(diff) > 0.5 || Math.abs(velocity.value) > 0.1) {
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