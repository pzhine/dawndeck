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
    @mouseleave="handleMouseUp"
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
          class="round-item-wrapper flex justify-center items-center py-1 w-full origin-center border-b border-white/20 cursor-pointer transition-transform"
          :style="{ background: isObject(item) && item.gradient ? item.gradient : undefined }"
          @click="handleItemClick(item)"
        >
          <div 
            class="round-item-content flex items-center w-[90%] text-[1.2rem] leading-relaxed"
            :class="[
              hasAnyValues ? 'justify-between' : 'justify-center',
              isObject(item) && item.customClass ? item.customClass : '',
              isObject(item) && item.gradient ? 'text-white font-semibold drop-shadow-lg' : ''
            ]"
          >
            <span class="truncate">{{ isObject(item) ? item.label : item }}</span>
            <!-- Knob for knob items -->
            <div 
              v-if="isObject(item) && item.knob" 
              class="flex items-center gap-3 ml-2.5"
              @click.stop
            >
              <span v-if="item.value !== undefined" class="value-text opacity-80 min-w-[3rem] text-right">
                {{ item.value }}
              </span>
              <KnobControl
                :value="typeof item.knob.value === 'number' ? item.knob.value : 0"
                :min="item.knob.min || 0"
                :max="item.knob.max || 100"
                :icon="item.knob.icon || ''"
                :color="item.knob.color || '#ffffff'"
                :size="item.knob.size || 50"
                :stroke-width="item.knob.strokeWidth || 6"
                :step-function="item.knob.stepFunction"
                :progress-function="item.knob.progressFunction"
                @update:value="(value: number) => item.knob?.onChange?.(value)"
              />
            </div>
            <!-- Slider for range items -->
            <div 
              v-else-if="isObject(item) && item.range" 
              class="flex items-center gap-2 ml-2.5"
              @click.stop
            >
              <div
                :ref="(el) => setSliderRef(el as HTMLElement, index)"
                class="slider-container relative h-8 w-40 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                @mousedown="(e) => handleSliderInteraction(e, item, index)"
                @mousemove="(e) => handleSliderInteraction(e, item, index)"
                @touchstart.prevent="(e) => handleSliderInteraction(e, item, index)"
                @touchmove.prevent="(e) => handleSliderInteraction(e, item, index)"
              >
                <div 
                  class="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-75"
                  :style="{ width: getSliderPercentage(item) + '%' }"
                ></div>
              </div>
              <!-- <span class="value-text opacity-80 min-w-[3rem] text-right">
                {{ item.value }}
              </span> -->
            </div>
            <!-- Regular value display -->
            <span v-else-if="isObject(item) && 'value' in item" class="value-text ml-2.5 opacity-80">
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
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import KnobControl from './KnobControl.vue';


// Define item type
export type ListItem =
  | string
  | {
      label: string;
      value?: any;
      onSelect?: () => void;
      customClass?: string;
      gradient?: string; // CSS gradient string for background
      range?: [number, number]; // [min, max] for slider
      onChange?: (value: number) => void; // Called when slider value changes
      knob?: {
        value: number;
        min?: number;
        max?: number;
        icon?: string;
        color?: string | number[];
        size?: number;
        strokeWidth?: number;
        stepFunction?: (currentValue: number, delta: number) => number;
        progressFunction?: (value: number, min: number, max: number) => number;
        onChange?: (value: number) => void;
      };
    };

const props = defineProps<{
  items?: ListItem[];
  title?: string;
  showTitle?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', item: ListItem): void;
  (e: 'back'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const slotContainerRef = ref<HTMLElement | null>(null);
const spacerHeight = ref(300);
const sliderRefs = ref<Map<number, HTMLElement>>(new Map());

const setSliderRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    sliderRefs.value.set(index, el);
  } else {
    sliderRefs.value.delete(index);
  }
};

// Scroll state
const scrollTop = ref(0);
const maxScroll = ref(0);
const velocity = ref(0);
const isDragging = ref(false);
const lastTouchY = ref(0);
const startTouchY = ref(0); // To detect clicks vs drags
const startTouchX = ref(0); // To detect horizontal swipes
let animationFrameId: number | null = null;

// Helper to check if item is object
const isObject = (item: any): item is Extract<ListItem, object> => {
  return typeof item === 'object' && item !== null;
};

// Check if any items have values
const hasAnyValues = computed(() => {
  if (!props.items) return false;
  return props.items.some(item => isObject(item) && 'value' in item && item.value !== undefined);
});

// Get slider percentage for range items
const getSliderPercentage = (item: Extract<ListItem, object>): number => {
  if (!item.range || typeof item.value !== 'number') return 0;
  const [min, max] = item.range;
  return ((item.value - min) / (max - min)) * 100;
};

// Handle slider interaction
const handleSliderInteraction = (event: MouseEvent | TouchEvent, item: Extract<ListItem, object>, index: number) => {
  event.stopPropagation();
  if (!item.range || !item.onChange) return;
  
  const sliderEl = sliderRefs.value.get(index);
  if (!sliderEl) return;
  
  const rect = sliderEl.getBoundingClientRect();
  let clientX;
  
  if (window.MouseEvent && event instanceof MouseEvent) {
    clientX = event.clientX;
    // Only handle if primary button is pressed for mousemove
    if (event.type === 'mousemove' && event.buttons !== 1) return;
  } else {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
    } else {
      return;
    }
  }
  
  const x = clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
  const [min, max] = item.range;
  const value = Math.round(min + (percentage / 100) * (max - min));
  
  item.onChange(value);
};

const handleItemClick = (item: ListItem) => {
  // Prevent click if we were dragging
  if (Math.abs(lastTouchY.value - startTouchY.value) > 10) {
    return;
  }
  
  // Don't trigger onSelect for range items (slider only)
  if (isObject(item) && item.range) {
    return;
  }
  
  if (isObject(item) && item.onSelect) {
    item.onSelect();
  }
  emit('select', item);
};

const updateLayout = () => {
  if (!containerRef.value || !contentRef.value) return;
  
  const containerHeight = containerRef.value.clientHeight;
  
  // Set spacer to 25% of container height (top of the stable zone)
  // The stable zone is the middle 50%, so it starts at 25% and ends at 75%
  spacerHeight.value = containerHeight * 0.25; 
  
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

// --- Physics & Scroll Logic ---

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  velocity.value += e.deltaY * 0.5; // Accumulate velocity
  // Wake up loop if needed
  if (!animationFrameId) {
    animationLoop();
  }
};

const handleTouchStart = (e: TouchEvent) => {
  isDragging.value = true;
  velocity.value = 0;
  lastTouchY.value = e.touches[0].clientY;
  startTouchY.value = e.touches[0].clientY;
  startTouchX.value = e.touches[0].clientX;
  if (!animationFrameId) {
    animationLoop();
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  // e.preventDefault(); // Don't prevent default immediately to allow horizontal swipe detection?
  // Actually we need to prevent default to stop browser scrolling/navigation
  e.preventDefault();
  
  const currentY = e.touches[0].clientY;
  const delta = lastTouchY.value - currentY;
  lastTouchY.value = currentY;
  
  scrollTop.value += delta;
  
  // Rubber banding during drag
  if (scrollTop.value < 0) {
    // Apply resistance when pulling past top
    // We need to be careful not to compound the resistance too much on each move
    // A simple way is to just dampen the delta if we are already out of bounds
    // But since we are adding delta to scrollTop directly, let's just dampen the result
    // Actually, the standard way is: newPos = limit + (rawPos - limit) * resistance
    // But here we are incremental.
    // Let's just dampen the delta if we are out of bounds.
    // Revert the addition
    scrollTop.value -= delta;
    // Add dampened delta
    scrollTop.value += delta * 0.4;
  } else if (scrollTop.value > maxScroll.value) {
    scrollTop.value -= delta;
    scrollTop.value += delta * 0.4;
  }
};

const handleTouchEnd = (e: TouchEvent) => {
  isDragging.value = false;
};

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  velocity.value = 0;
  lastTouchY.value = e.clientY;
  startTouchY.value = e.clientY;
  startTouchX.value = e.clientX;
  if (!animationFrameId) {
    animationLoop();
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  e.preventDefault();
  const currentY = e.clientY;
  const delta = lastTouchY.value - currentY;
  lastTouchY.value = currentY;
  
  scrollTop.value += delta;
  
  // Rubber banding during drag
  if (scrollTop.value < 0) {
    scrollTop.value -= delta;
    scrollTop.value += delta * 0.4;
  } else if (scrollTop.value > maxScroll.value) {
    scrollTop.value -= delta;
    scrollTop.value += delta * 0.4;
  }
};

const handleMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return;
  isDragging.value = false;

  // Check for horizontal swipe (Back gesture)
  const endX = e.clientX;
  const diffX = endX - startTouchX.value;
  const diffY = Math.abs(e.clientY - startTouchY.value);
  
  if (diffX > 50 && diffX > diffY * 1.5) {
    emit('back');
  }
};

const animationLoop = () => {
  // Apply friction
  if (!isDragging.value) {
    velocity.value *= 0.92; // Friction
    if (Math.abs(velocity.value) < 0.1) {
      velocity.value = 0;
    }
    scrollTop.value += velocity.value;
    
    // Bounce/Clamp
    if (scrollTop.value < 0) {
      // Spring back to 0
      // Use a simple proportional control (P-controller) for spring physics
      // Move 20% of the distance to target per frame
      scrollTop.value = scrollTop.value * 0.8; 
      
      // Snap when close enough
      if (Math.abs(scrollTop.value) < 0.5) {
        scrollTop.value = 0;
        // Stop velocity if we snapped
        velocity.value = 0;
      }
    } else if (scrollTop.value > maxScroll.value) {
      // Spring back to maxScroll
      const overscroll = scrollTop.value - maxScroll.value;
      scrollTop.value = maxScroll.value + overscroll * 0.8;
      
      // Snap when close enough
      if (Math.abs(overscroll) < 0.5) {
        scrollTop.value = maxScroll.value;
        // Stop velocity if we snapped
        velocity.value = 0;
      }
    }
    
    // No hard clamp here, let the spring physics handle it
  }

  // Apply transform to content wrapper
  if (contentRef.value) {
    contentRef.value.style.transform = `translateY(${-scrollTop.value}px)`;
  }

  // Apply item transforms
  applyTransforms();

  if (Math.abs(velocity.value) > 0.1 || isDragging.value || scrollTop.value < 0 || scrollTop.value > maxScroll.value) {
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