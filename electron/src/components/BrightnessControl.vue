<template>
  <div
    ref="controlRef"
    class="relative cursor-grab active:cursor-grabbing"
    @mousedown="handlePointerStart"
    @touchstart.prevent="handlePointerStart"
  >
    <!-- Circular progress background -->
    <svg :width="size" :height="size" class="transform rotate-120 opacity-70">
      <!-- Background arc (350°) -->
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        :stroke-width="strokeWidth"
        :stroke-dasharray="`${circumference * knobArcRatio} ${circumference}`"
        stroke-linecap="round"
      />
      <!-- Progress circle -->
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="Array.isArray(color) ? `rgb(${color.join(',')})` : color"
        :stroke-width="strokeWidth"
        :stroke-dasharray="`${circumference * knobArcRatio} ${circumference}`"
        :stroke-dashoffset="strokeDashoffset"
        stroke-linecap="round"
        class="transition-all duration-100"
      />
    </svg>
    
    <!-- Center content -->
    <div class="absolute opacity-80 inset-0 flex items-center justify-center text-white" v-html="icon"></div>
    
    <!-- Connector line -->
    <svg
      v-if="connectorHeight && connectorWidth && connectorDirection"
      class="absolute pointer-events-none"
      :style="connectorSvgStyle"
      :width="Math.abs(connectorWidth)"
      :height="Math.abs(connectorHeight)"
      :viewBox="connectorViewBox"
    >
      <polyline
        :points="connectorPoints"
        fill="none"
        :stroke="Array.isArray(color) ? `rgb(${color.join(',')})` : color"
        stroke-width="2"
        opacity="0.5"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';

interface Props {
  brightness: number; // 0-100
  icon: string;
  color?: string | number[];
  size?: number;
  strokeWidth?: number;
  connectorHeight?: number;
  connectorWidth?: number;
  connectorDirection?: 'up-left' | 'down-left' | 'up-right' | 'down-right';
}

interface Emits {
  (event: 'update:brightness', value: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  size: 80,
  strokeWidth: 8,
  color: '#ffffff',
});

const emit = defineEmits<Emits>();

const isDragging = ref(false);
const startPosition = ref<{ x: number; y: number } | null>(null);
const startBrightness = ref(0);

const radius = computed(() => (props.size - props.strokeWidth) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

// Knob spans from 30° to 330° (300° total range)
const knobArcDegrees = 300;
const knobArcRatio = knobArcDegrees / 360;

const strokeDashoffset = computed(() => {
  // Map 0-100% brightness to the 300° arc
  const progress = props.brightness / 100;
  const arcLength = circumference.value * knobArcRatio;
  // At 0%: offset should be full arc length (nothing visible)
  // At 100%: offset should be 0 (full arc visible)
  return arcLength * (1 - progress);
});

// Connector line calculations
const connectorDirection = computed(() => props.connectorDirection);
const connectorHeight = computed(() => props.connectorHeight || 0);
const connectorWidth = computed(() => props.connectorWidth || 0);

const connectorSvgStyle = computed(() => {
  const dir = connectorDirection.value;
  if (!dir) return {};
  
  const style: Record<string, string> = {};
  const halfSize = props.size / 2;
  
  if (dir.includes('up')) {
    style.bottom = `${props.size + 10}px`;
  } else {
    style.top = `${props.size + 10}px`;
  }
  
  if (dir.includes('left')) {
    style.right = `${halfSize}px`;
  } else {
    style.left = `${halfSize}px`;
  }
  
  return style;
});

const connectorViewBox = computed(() => {
  const dir = connectorDirection.value;
  if (!dir) return '0 0 0 0';
  
  const width = Math.abs(connectorWidth.value);
  const height = Math.abs(connectorHeight.value);
  
  if (dir.includes('left')) {
    // For left directions, viewBox needs to show negative x
    return `-${width} 0 ${width} ${height}`;
  } else {
    // For right directions, standard viewBox
    return `0 0 ${width} ${height}`;
  }
});

const connectorPoints = computed(() => {
  const dir = connectorDirection.value;
  if (!dir) return '';
  
  const width = Math.abs(connectorWidth.value);
  const height = Math.abs(connectorHeight.value);
  
  // Create elbow connector with 3 points: start, corner, end
  // Vertical segment is now at x=0 (centered due to SVG offset)
  let x1 = 0, y1 = 0;
  let x2 = 0, y2 = 0;
  let x3 = 0, y3 = 0;
  
  if (dir === 'up-right') {
    // Start at bottom center, go up, then right (horizontal at top)
    x1 = 0; y1 = height;        // Start: bottom center
    x2 = 0; y2 = 0;             // Corner: top center
    x3 = width; y3 = 0;         // End: top right
  } else if (dir === 'up-left') {
    // Start at bottom center, go up, then left (horizontal at top)
    x1 = 0; y1 = height;        // Start: bottom center
    x2 = 0; y2 = 0;             // Corner: top center
    x3 = -width; y3 = 0;        // End: top left (negative x)
  } else if (dir === 'down-right') {
    // Start at top center, go down, then right (horizontal at bottom)
    x1 = 0; y1 = 0;             // Start: top center
    x2 = 0; y2 = height;        // Corner: bottom center
    x3 = width; y3 = height;    // End: bottom right
  } else if (dir === 'down-left') {
    // Start at top center, go down, then left (horizontal at bottom)
    x1 = 0; y1 = 0;             // Start: top center
    x2 = 0; y2 = height;        // Corner: bottom center
    x3 = -width; y3 = height;   // End: bottom left (negative x)
  }
  
  return `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
});

/**
 * Handle pointer start (mouse or touch)
 */
function handlePointerStart(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  isDragging.value = true;
  startBrightness.value = props.brightness;
  
  if (event instanceof MouseEvent) {
    startPosition.value = { x: event.clientX, y: event.clientY };
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerEnd);
  } else {
    if (event.touches.length > 0) {
      startPosition.value = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerEnd);
  }
}

/**
 * Handle pointer move
 */
function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isDragging.value || !startPosition.value) return;

  event.preventDefault();
  
  let currentX: number, currentY: number;
  if (event instanceof MouseEvent) {
    currentX = event.clientX;
    currentY = event.clientY;
  } else {
    if (event.touches.length === 0) return;
    currentX = event.touches[0].clientX;
    currentY = event.touches[0].clientY;
  }

  // Calculate delta from start position
  const deltaX = currentX - startPosition.value.x;
  const deltaY = startPosition.value.y - currentY; // Inverted: up is positive
  
  // Combine horizontal and vertical movement (prioritize the larger delta)
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  
  // Scale delta to brightness change (1 pixel = 0.5% brightness)
  const brightnessChange = delta * 0.5;
  
  // Calculate new brightness
  const newBrightness = Math.max(0, Math.min(100, startBrightness.value + brightnessChange));
  
  emit('update:brightness', newBrightness);
}

/**
 * Handle pointer end
 */
function handlePointerEnd(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  isDragging.value = false;
  startPosition.value = null;

  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);
});
</script>
