<template>
  <div class="relative flex flex-col items-center justify-center h-full w-full">
    <div class="w-full aspect-square shrink-0 max-w-[620px] relative">
      <svg
        ref="svgRef"
        class="w-full h-full bg-black rounded-full cursor-crosshair touch-none absolute inset-0"
        style="filter: blur(70px)"
        viewBox="-150 -150 1100 1050"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        @mousedown="handlePointerStart"
        @touchstart="handlePointerStart"
      >
        <path
          d="M803 517C830.5 647.5 712.5 729.5 549 729.5C385.5 729.5 206.5 563.5 226 421.5C243.852 291.5 349 255.5 491 274.5C660.489 297.178 782.302 418.778 803 517Z"
          :fill="circleColors.orange"
          :fill-opacity="0.8 * (brightness / 100)"
        />
        <path
          d="M580 375.5C597 553.5 404.071 730 266 730C144.5 756 0 694.571 0 556.5C0 418.429 107.611 294.527 252.5 236C354 195 563 197.5 580 375.5Z"
          :fill="circleColors.pink"
          :fill-opacity="0.8 * (brightness / 100)"
        />
        <path
          d="M662 284C666.547 356 628.5 493.5 479 549C332 580.5 96 505.5 96 236C96 97.9288 222.929 0 361 0C499.071 0 651.931 124.562 662 284Z"
          :fill="circleColors.warmWhite"
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
          <!-- Orange slice: -60° to 60° (300° to 60°) -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((300 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((300 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((60 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((60 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors.orange"
            stroke-width="3"
          />
          <!-- Pink slice: 60° to 180° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((60 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((60 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors.pink"
            stroke-width="3"
          />
          <!-- White slice: 180° to 300° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((300 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((300 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            :stroke="circleColors.warmWhite"
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
      <span>White: {{ Math.round((ledValues.warmWhite / 100) * 255) }}</span>
      <span>Pink: {{ Math.round((ledValues.pink / 100) * 255) }}</span>
      <span>Orange: {{ Math.round((ledValues.orange / 100) * 255) }}</span>
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
    <div class="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 z-10 px-8">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue';

interface Props {
  circleColors: {
    warmWhite: string;
    pink: string;
    orange: string;
  };
  colors: {
    warmWhite: number;
    pink: number;
    orange: number;
  };
  position?: { x: number; y: number };
  active: boolean;
  brightness: number;
}

interface Emits {
  (e: 'update:colors', colors: { warmWhite: number; pink: number; orange: number }, position: { x: number; y: number }): void;
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
const ledValues = reactive({
  warmWhite: 0,
  pink: 0,
  orange: 0,
});

// Calculate the center of the grouping (centroid of all three circles)
const groupingCenter = {
  x: (379 + 280 + 520) / 3,
  y: (260 + 480 + 500) / 3,
};

/**
 * Calculate LED values based on pie slice overlap
 */
function calculateColorWheelValues(x: number, y: number): { pink: number; orange: number; warmWhite: number } {
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
  
  let warmWhiteCount = 0;
  let pinkCount = 0;
  let orangeCount = 0;
  let totalCount = 0;
  
  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const px = x - tapRadius + i * step;
      const py = y - tapRadius + j * step;
      
      if (isInTapCircle(px, py)) {
        totalCount++;
        
        const orangeStart = (300 + rotationOffset.value) % 360;
        const orangeEnd = (60 + rotationOffset.value) % 360;
        const pinkStart = (60 + rotationOffset.value) % 360;
        const pinkEnd = (180 + rotationOffset.value) % 360;
        const whiteStart = (180 + rotationOffset.value) % 360;
        const whiteEnd = (300 + rotationOffset.value) % 360;
        
        if (isInSector(px, py, orangeStart, orangeEnd)) {
          orangeCount++;
        } else if (isInSector(px, py, pinkStart, pinkEnd)) {
          pinkCount++;
        } else if (isInSector(px, py, whiteStart, whiteEnd)) {
          warmWhiteCount++;
        }
      }
    }
  }
  
  if (totalCount === 0) {
    return { pink: 0, orange: 0, warmWhite: 0 };
  }
  
  const warmWhite = (warmWhiteCount / totalCount) * 100;
  const pink = (pinkCount / totalCount) * 100;
  const orange = (orangeCount / totalCount) * 100;
  
  return {
    pink: Math.round(pink),
    orange: Math.round(orange),
    warmWhite: Math.round(warmWhite)
  };
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

  const { pink, orange, warmWhite } = calculateColorWheelValues(x, y);
  
  ledValues.pink = pink;
  ledValues.orange = orange;
  ledValues.warmWhite = warmWhite;

  currentColorPosition.value = { x, y };

  const warmWhiteValue = Math.round((ledValues.warmWhite / 100) * 255);
  const pinkValue = Math.round((ledValues.pink / 100) * 255);
  const orangeValue = Math.round((ledValues.orange / 100) * 255);

  emit('update:colors', {
    warmWhite: warmWhiteValue,
    pink: pinkValue,
    orange: orangeValue,
  }, currentColorPosition.value);
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
  ledValues.warmWhite = (newColors.warmWhite / 255) * 100;
  ledValues.pink = (newColors.pink / 255) * 100;
  ledValues.orange = (newColors.orange / 255) * 100;
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
