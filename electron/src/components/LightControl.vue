<template>
  <div class="relative flex flex-col items-center justify-center w-full h-full">
    <div class="w-full aspect-square relative flex-shrink">
      <svg
        ref="svgRef"
        class="w-full h-full bg-black rounded-full cursor-crosshair touch-none absolute inset-0"
        style="filter: blur(30px)"
        viewBox="-150 -150 1100 1050"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        @mousedown="handlePointerStart"
        @touchstart="handlePointerStart"
      >
        <path
          d="M803 517C830.5 647.5 712.5 729.5 549 729.5C385.5 729.5 206.5 563.5 226 421.5C243.852 291.5 349 255.5 491 274.5C660.489 297.178 782.302 418.778 803 517Z"
          :fill="circleColors[2]"
          :fill-opacity="0.8 * (brightness / 100)"
        />
        <path
          d="M580 375.5C597 553.5 404.071 730 266 730C144.5 756 0 694.571 0 556.5C0 418.429 107.611 294.527 252.5 236C354 195 563 197.5 580 375.5Z"
          :fill="circleColors[1]"
          :fill-opacity="0.8 * (brightness / 100)"
        />
        <path
          d="M662 284C666.547 356 628.5 493.5 479 549C332 580.5 96 505.5 96 236C96 97.9288 222.929 0 361 0C499.071 0 651.931 124.562 662 284Z"
          :fill="circleColors[0]"
          :fill-opacity="0.8 * (brightness / 100)"
        />
      </svg>
      
      <!-- Debug overlay (not blurred) -->
      <svg
        v-if="DEBUG_MODE"
        class="w-full h-full rounded-full cursor-crosshair touch-none absolute inset-0 pointer-events-none"
        viewBox="-150 -150 1100 1050"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Debug: Pie slices -->
        <g opacity="0.8" stroke="white" stroke-width="2" fill="none">
          <!-- Color 2 slice: -60° to 60° (300° to 60°) -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((300 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((300 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((60 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((60 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors[2]"
            stroke-width="3"
          />
          <!-- Color 1 slice: 60° to 180° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((60 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((60 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors[1]"
            stroke-width="3"
          />
          <!-- Color 0 slice: 180° to 300° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((300 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((300 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors[0]"
            stroke-width="3"
          />
        </g>

        <!-- Debug: Tap circle -->
        <circle
          v-if="touchPosition"
          :cx="touchPosition.x"
          :cy="touchPosition.y"
          :r="tapCircleRadius"
          fill="none"
          stroke="cyan"
          stroke-width="3"
          opacity="0.8"
        />

        <!-- Touch indicator (small circle) -->
        <circle
          v-if="touchPosition"
          :cx="touchPosition.x"
          :cy="touchPosition.y"
          r="20"
          fill="white"
          opacity="0.8"
          stroke="black"
          stroke-width="2"
        />
      </svg>
      
      <!-- Persistent color indicator (non-debug mode) -->
      <svg
        v-if="!DEBUG_MODE && currentColorPosition"
        class="w-full h-full rounded-full absolute inset-0 pointer-events-none"
        viewBox="-150 -150 1100 1050"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          :cx="currentColorPosition.x"
          :cy="currentColorPosition.y"
          r="15"
          fill="white"
          opacity="0.6"
          stroke="black"
          stroke-width="2"
        />
      </svg>
    </div>

    <!-- Display current color values -->
    <div v-if="DEBUG_MODE" class="absolute bottom-8 flex justify-center gap-6 w-full text-gray-400 text-sm">
      <span>Color 0: {{ Math.round((ledValues[0] / 100) * 255) }}</span>
      <span>Color 1: {{ Math.round((ledValues[1] / 100) * 255) }}</span>
      <span>Color 2: {{ Math.round((ledValues[2] / 100) * 255) }}</span>
    </div>
    
    <!-- Debug rotation slider -->
    <div v-if="DEBUG_MODE" class="absolute bottom-20 flex flex-col items-center gap-2 w-full text-white text-sm">
      <label class="flex items-center gap-4">
        {{ rotationOffset }}°
        <input 
          type="range" 
          v-model.number="rotationOffset" 
          min="-180" 
          max="180" 
          step="1"
          class="w-64"
        />
      </label>
      <label class="flex items-center gap-4">
        {{ tapCircleRadius }}px
        <input 
          type="range" 
          v-model.number="tapCircleRadius" 
          min="50" 
          max="800" 
          step="10"
          class="w-64"
        />
      </label>
    </div>
    
    <!-- Brightness slider -->
    <!-- <div class="flex items-center justify-center gap-4 w-full px-8">
      <div class="w-5 h-6 pointer-events-none opacity-50">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
      </div>
      <div 
        ref="brightnessBarRef"
        class="w-30 h-12 flex items-center justify-center cursor-pointer"
        @mousedown="handleBrightnessInteraction"
        @mousemove="handleBrightnessInteraction"
        @touchstart.prevent="handleBrightnessInteraction"
        @touchmove.prevent="handleBrightnessInteraction"
        @click.stop
      >
        <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden pointer-events-none">
          <div 
            class="h-full bg-white transition-all duration-100 ease-out"
            :style="{ width: `${brightness}%` }"
          ></div>
        </div>
      </div>
      <div class="w-5 h-6 pointer-events-none opacity-70">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
      </div>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeUnmount, watch } from 'vue';

interface Props {
  circleColors: [string, string, string]; // Array of 3 color hex strings
  colors: [number, number, number]; // Array of 3 color values (0-255)
  position?: { x: number; y: number };
  active: boolean;
  brightness: number;
}

interface Emits {
  (e: 'update:colors', colors: [number, number, number], position: { x: number; y: number }): void;
  (e: 'update:brightness', value: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const svgRef = ref<SVGSVGElement | null>(null);
const touchPosition = ref<{ x: number; y: number } | null>(null);
const currentColorPosition = ref<{ x: number; y: number } | null>(null);
const isDragging = ref(false);
const brightnessBarRef = ref<HTMLElement | null>(null);

// Debug mode flag - set to true to enable rotation slider
const DEBUG_MODE = false;

// Rotation offset in degrees (clockwise)
const rotationOffset = ref(30);

// Tap circle radius in pixels
const tapCircleRadius = ref(190);

// LED color values (0-100 percentage)
// Index 0: Color at 180°-300° (bottom-left)
// Index 1: Color at 60°-180° (top-left) 
// Index 2: Color at 300°-60° (right)
const ledValues = reactive([0, 0, 0]);

// Calculate the center of the grouping (centroid of all three circles)
const groupingCenter = {
  x: (379 + 280 + 520) / 3,
  y: (260 + 480 + 500) / 3,
};

/**
 * Calculate LED values based on pie slice overlap
 * Returns [color0, color1, color2] percentages (0-100)
 */
function calculateColorWheelValues(x: number, y: number): [number, number, number] {
  const tapRadius = tapCircleRadius.value;
  
  function isInSector(px: number, py: number, startAngle: number, endAngle: number): boolean {
    const dx = px - groupingCenter.x;
    const dy = py - groupingCenter.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    if (startAngle > endAngle) {
      return angle >= startAngle || angle < endAngle;
    }
    return angle >= startAngle && angle < endAngle;
  }
  
  function isInTapCircle(px: number, py: number): boolean {
    const dx = px - x;
    const dy = py - y;
    return Math.sqrt(dx * dx + dy * dy) <= tapRadius;
  }
  
  const gridSize = 40;
  const step = (tapRadius * 2) / gridSize;
  
  let color0Count = 0; // 180°-300° sector
  let color1Count = 0; // 60°-180° sector
  let color2Count = 0; // 300°-60° sector
  let totalCount = 0;
  
  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const px = x - tapRadius + i * step;
      const py = y - tapRadius + j * step;
      
      if (isInTapCircle(px, py)) {
        totalCount++;
        
        const color2Start = (300 + rotationOffset.value) % 360;
        const color2End = (60 + rotationOffset.value) % 360;
        const color1Start = (60 + rotationOffset.value) % 360;
        const color1End = (180 + rotationOffset.value) % 360;
        const color0Start = (180 + rotationOffset.value) % 360;
        const color0End = (300 + rotationOffset.value) % 360;
        
        if (isInSector(px, py, color2Start, color2End)) {
          color2Count++;
        } else if (isInSector(px, py, color1Start, color1End)) {
          color1Count++;
        } else if (isInSector(px, py, color0Start, color0End)) {
          color0Count++;
        }
      }
    }
  }
  
  if (totalCount === 0) {
    return [0, 0, 0];
  }
  
  const color0 = (color0Count / totalCount) * 100;
  const color1 = (color1Count / totalCount) * 100;
  const color2 = (color2Count / totalCount) * 100;
  
  return [
    Math.round(color0),
    Math.round(color1),
    Math.round(color2)
  ];
}

/**
 * Convert SVG coordinates from event
 */
function getSVGCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if (!svgRef.value) return null;

  const svg = svgRef.value;
  const rect = svg.getBoundingClientRect();
  
  let clientX: number, clientY: number;
  if (event instanceof MouseEvent) {
    clientX = event.clientX;
    clientY = event.clientY;
  } else {
    if (event.touches.length === 0) return null;
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  }

  const x = ((clientX - rect.left) / rect.width) * 1100 - 150;
  const y = ((clientY - rect.top) / rect.height) * 1050 - 150;

  return { x, y };
}

/**
 * Update LED values based on touch position
 */
function updateLEDValues(x: number, y: number) {
  touchPosition.value = { x, y };

  const colorPercentages = calculateColorWheelValues(x, y);
  
  // Calculate distance from center to apply brightness multiplier
  const dx = x - groupingCenter.x;
  const dy = y - groupingCenter.y;
  const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  // Maximum reasonable distance (approximate radius of the interactive area)
  const maxDistance = tapCircleRadius.value * 1.5;
  
  // Calculate multiplier: 3x at center, 1x at edge
  // This makes center positions brighter across all LEDs
  const normalizedDistance = Math.min(distanceFromCenter / maxDistance, 1);
  const brightnessMultiplier = 1 + (1 - normalizedDistance) * 2;
  
  // Apply both the sector percentage and the brightness multiplier
  ledValues[0] = Math.min(100, colorPercentages[0] * brightnessMultiplier);
  ledValues[1] = Math.min(100, colorPercentages[1] * brightnessMultiplier);
  ledValues[2] = Math.min(100, colorPercentages[2] * brightnessMultiplier);

  currentColorPosition.value = { x, y };

  const color0Value = Math.round((ledValues[0] / 100) * 255);
  const color1Value = Math.round((ledValues[1] / 100) * 255);
  const color2Value = Math.round((ledValues[2] / 100) * 255);

  emit('update:colors', [
    color0Value,
    color1Value,
    color2Value
  ], currentColorPosition.value);
}

/**
 * Handle pointer start (mouse or touch)
 */
function handlePointerStart(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  
  const target = event.target as HTMLElement;
  
  if (target.closest('svg')?.classList.contains('pointer-events-none')) {
    return;
  }
  
  isDragging.value = true;

  const coords = getSVGCoordinates(event);
  if (coords) {
    updateLEDValues(coords.x, coords.y);
  }

  if (event instanceof MouseEvent) {
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerEnd);
  } else {
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerEnd);
  }
}

/**
 * Handle pointer move
 */
function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isDragging.value) return;

  event.preventDefault();
  const coords = getSVGCoordinates(event);
  if (coords) {
    updateLEDValues(coords.x, coords.y);
  }
}

/**
 * Handle pointer end
 */
function handlePointerEnd(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  isDragging.value = false;
  touchPosition.value = null;

  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);
}

/**
 * Handle brightness slider interaction
 */
function handleBrightnessInteraction(event: MouseEvent | TouchEvent) {
  event.stopPropagation();
  if (!brightnessBarRef.value) return;
  
  const rect = brightnessBarRef.value.getBoundingClientRect();
  let clientX;
  
  if (window.MouseEvent && event instanceof MouseEvent) {
    clientX = event.clientX;
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
  emit('update:brightness', percentage);
}

// Initialize LED values from props
watch(() => props.colors, (newColors) => {
  ledValues[0] = (newColors[0] / 255) * 100;
  ledValues[1] = (newColors[1] / 255) * 100;
  ledValues[2] = (newColors[2] / 255) * 100;
}, { immediate: true });

// Restore position from props
watch(() => props.position, (newPosition) => {
  if (newPosition) {
    currentColorPosition.value = newPosition;
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);
});
</script>
