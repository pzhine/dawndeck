<template>
  <div 
    class="relative w-full overflow-hidden touch-none select-none"
    style="height: 300px"
    ref="containerRef"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
    @wheel="handleWheel"
  >
    <!-- Active Highlight Area (Center) -->
    <!-- <div class="absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none z-10 h-[60px] border-y border-white/20"></div> -->
    
    <!-- Items -->
    <div class="relative w-full h-full">
      <div 
        v-for="item in visibleItems" 
        :key="item.key"
        class="absolute left-0 w-full h-[100px] flex justify-center items-center will-change-transform"
        :style="{ 
          transform: `translateY(${item.y}px) scale(${item.scale})`, 
          opacity: item.opacity,
          color: 'inherit',
          'font-size': '200px',
          'line-height': '220px',
          'font-weight': 'normal',
          'font-family': '\'DS-Digital\', sans-serif',
        }"
      >
        <span class="text-6xl">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  items: (string | number)[];
  modelValue: string | number;
  formatLabel?: (value: string | number) => string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

const ITEM_HEIGHT = 100;
const CONTAINER_HEIGHT = 300;
const VISIBLE_COUNT = 7; // Number of items to render around center

const containerRef = ref<HTMLElement | null>(null);

// State
// scrollTop represents the position in "pixels" of the virtual scrolling list
// 0 means index 0 is centered.
const scrollTop = ref(0);
const isDragging = ref(false);
const velocity = ref(0);
const lastY = ref(0);
let animationFrameId: number | null = null;
let lastTimestamp = 0;

// Initialize scrollTop based on modelValue
onMounted(() => {
  const index = props.items.indexOf(props.modelValue);
  if (index !== -1) {
    scrollTop.value = index * ITEM_HEIGHT;
  }
  animationLoop(0);
});

// Watch for external model changes
watch(() => props.modelValue, (newVal) => {
  if (!isDragging.value && Math.abs(velocity.value) < 0.1) {
    const index = props.items.indexOf(newVal);
    if (index !== -1) {
      // Find shortest path considering looping
      const len = props.items.length;
      const currentScrollIndex = scrollTop.value / ITEM_HEIGHT;
      const normalizedCurrent = ((currentScrollIndex % len) + len) % len;
      
      let diff = index - normalizedCurrent;
      if (Math.abs(diff) > len / 2) {
        // Wrap around
        diff = diff > 0 ? diff - len : diff + len;
      }
      
      // Animate to new position
      // For now just snap, or we could implement smooth scroll to target
      // scrollTop.value += diff * ITEM_HEIGHT; // This might be abrupt
    }
  }
});

const visibleItems = computed(() => {
  const items = [];
  const totalItems = props.items.length;
  const centerY = CONTAINER_HEIGHT / 2;
  
  // Center index in the virtual space
  const centerIndex = scrollTop.value / ITEM_HEIGHT;
  const baseIndex = Math.floor(centerIndex);
  
  // Render range
  const range = Math.ceil(VISIBLE_COUNT / 2);
  
  for (let i = baseIndex - range; i <= baseIndex + range; i++) {
    // Math to wrap index for data lookup
    const wrappedIndex = ((i % totalItems) + totalItems) % totalItems;
    const itemValue = props.items[wrappedIndex];
    const label = props.formatLabel ? props.formatLabel(itemValue) : String(itemValue).padStart(2, '0');
    
    // Position calculation
    // When scrollTop matches i*ITEM_HEIGHT, this item should be at center
    // Item center should be at: centerY + (i * ITEM_HEIGHT - scrollTop)
    // Convert to top-left position for div: center is + ITEM_HEIGHT/2 down
    // The div itself is ITEM_HEIGHT tall.
    // CSS translateY is relative to the parent top-left.
    // Parent is top:0.
    // We want the item's CENTER to be at calculated Y.
    // itemTop = (centerY) + (offset_from_center) - (itemHeight/2)
    
    const offsetFromCenterPixels = (i * ITEM_HEIGHT) - scrollTop.value;
    const y = centerY + offsetFromCenterPixels - (ITEM_HEIGHT / 2);
    
    // Visual transforms based on distance from center
    const distance = Math.abs(offsetFromCenterPixels);
    const maxDistance = CONTAINER_HEIGHT / 2;
    
    // Scale and opacity logic similar to RoundScrollContainer
    // "Stable zone" is roughly 1 item height? or just strictly distance based
    let scale = 1;
    let opacity = 1;
    
    const normalizedDist = Math.min(distance / maxDistance, 1);
    
    // Custom easing
    scale = 1 - (normalizedDist * 0.4); // 1.0 -> 0.6
    opacity = 1 - Math.pow(normalizedDist, 1.5); // Fade out
    
    opacity = Math.max(0.1, opacity); // Min opacity
    
    items.push({
      key: i, // Use virtual index as key to maintain DOM elements
      value: props.items[wrappedIndex],
      label,
      y,
      scale,
      opacity,
      isActive: Math.abs(offsetFromCenterPixels) < ITEM_HEIGHT / 2,
      rawIndex: wrappedIndex
    });
  }
  
  return items;
});

// -- Interaction Logic --

const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    scrollTop.value += e.deltaY;
    velocity.value = 0; // Cancel any inertial scroll
    
    // Snap logic is handled in loop if not active
};

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  lastY.value = e.clientY;
  velocity.value = 0;
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const delta = lastY.value - e.clientY; // Drag up increases scrollTop
  scrollTop.value += delta;
  velocity.value = delta; // Simple instantaneous velocity
  lastY.value = e.clientY;
};

const handleMouseUp = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
};

const handleTouchStart = (e: TouchEvent) => {
  isDragging.value = true;
  lastY.value = e.touches[0].clientY;
  velocity.value = 0;
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd);
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  e.preventDefault(); // Prevent page scroll
  const delta = lastY.value - e.touches[0].clientY;
  scrollTop.value += delta;
  
  // Track velocity (simple)
  velocity.value = delta;
  
  lastY.value = e.touches[0].clientY;
};

const handleTouchEnd = () => {
  isDragging.value = false;
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleTouchEnd);
};

// Physics Loop
const animationLoop = (timestamp: number) => {
  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  
  if (!isDragging.value) {
    // Intertia / Friction
    velocity.value *= 0.95; // Friction
    
    scrollTop.value += velocity.value;
    
    // Snap to nearest item if velocity is low
    if (Math.abs(velocity.value) < 0.5) {
      velocity.value = 0;
      
      const nearestItemIndex = Math.round(scrollTop.value / ITEM_HEIGHT);
      const targetScroll = nearestItemIndex * ITEM_HEIGHT;
      
      // Smooth snap
      const snapDiff = targetScroll - scrollTop.value;
      scrollTop.value += snapDiff * 0.1; // Ease to target
    }
  }

  // Check for value change continuously (while dragging or animating)
  const nearestItemIndex = Math.round(scrollTop.value / ITEM_HEIGHT);
  const totalItems = props.items.length;
  // Handle wrapping for negative or large positive indices
  const wrappedIndex = ((nearestItemIndex % totalItems) + totalItems) % totalItems;
  const newVal = props.items[wrappedIndex];
  
  // Emit if changed (debouncing handled by Vue usually, but we emit every frame if different)
  // Since we are rounding, this will be stable for a range of scrollTop.
  if (newVal !== props.modelValue) {
    emit('update:modelValue', newVal);
  }
  
  animationFrameId = requestAnimationFrame(animationLoop);
};

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleTouchEnd);
});

</script>
