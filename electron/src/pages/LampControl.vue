<template>
  <div class="relative flex flex-col items-center justify-center h-full w-full">
    <div class="w-full aspect-square shrink-0 max-w-[650px] relative bottom-8">
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
          fill="#FF6B09"
          fill-opacity="0.8"
        />
        <path
          d="M580 375.5C597 553.5 404.071 730 266 730C144.5 756 0 694.571 0 556.5C0 418.429 107.611 294.527 252.5 236C354 195 563 197.5 580 375.5Z"
          fill="#FF2A70"
          fill-opacity="0.8"
        />
        <path
          d="M662 284C666.547 356 628.5 493.5 479 549C332 580.5 96 505.5 96 236C96 97.9288 222.929 0 361 0C499.071 0 651.931 124.562 662 284Z"
          fill="#FFD76D"
          fill-opacity="0.8"
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
            stroke="#FF6B09"
            stroke-width="3"
          />
          <!-- Pink slice: 60° to 180° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((60 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((60 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            stroke="#FF2A70"
            stroke-width="3"
          />
          <!-- White slice: 180° to 300° -->
          <path
            :d="`M ${groupingCenter.x} ${groupingCenter.y} 
                 L ${groupingCenter.x + 400 * Math.cos(((180 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((180 + rotationOffset) * Math.PI) / 180)}
                 A 400 400 0 0 1 ${groupingCenter.x + 400 * Math.cos(((300 + rotationOffset) * Math.PI) / 180)} ${groupingCenter.y + 400 * Math.sin(((300 + rotationOffset) * Math.PI) / 180)}
                 Z`"
            stroke="#FFD76D"
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
      </label>      <label class="flex items-center gap-4">
        {{ tapCircleRadius }}px
        <input 
          type="range" 
          v-model.number="tapCircleRadius" 
          min="50" 
          max="800" 
          step="10"
          class="w-64"
        />
      </label>    </div>
    
    <!-- Hidden canvas for pixel sampling -->
    <canvas ref="canvasRef" class="hidden" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/appState';
import { throttle } from 'lodash-es';

const router = useRouter();
const appStore = useAppStore();
const svgRef = ref<SVGSVGElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const touchPosition = ref<{ x: number; y: number } | null>(null);
const currentColorPosition = ref<{ x: number; y: number } | null>(null);
const isDragging = ref(false);

// Debug mode flag - set to true to enable rotation slider
const DEBUG_MODE = false;

// Rotation offset in degrees (clockwise)
// Set this constant to apply a fixed rotation, or adjust via slider in debug mode
const rotationOffset = ref(30);

// Tap circle radius in pixels
// Set this constant to configure the sample circle size, or adjust via slider in debug mode
const tapCircleRadius = ref(190);

// LED color values (0-100 percentage)
const ledValues = reactive({
  warmWhite: 0,
  pink: 0,
  orange: 0,
});

// Define the three circles (positioned in a triangle pattern)
// These define the "influence zones" for the touch interaction
// adjusted to match the SVG paths in the 807x736 viewbox
const circles = {
  warmWhite: {
    cx: 379,
    cy: 260,
    rx: 280,
    ry: 260,
    rotation: 0,
    color: '#FFD76D',
  },
  pink: {
    cx: 280,
    cy: 480,
    rx: 280,
    ry: 240,
    rotation: 30,
    color: '#FF2A70',
  },
  orange: {
    cx: 520,
    cy: 500,
    rx: 280,
    ry: 240,
    rotation: -30,
    color: '#FF6B09',
  },
};

// Calculate the center of the grouping (centroid of all three circles)
const groupingCenter = {
  x: (circles.warmWhite.cx + circles.pink.cx + circles.orange.cx) / 3,
  y: (circles.warmWhite.cy + circles.pink.cy + circles.orange.cy) / 3,
};

/**
 * Render SVG to canvas for pixel sampling
 */
function renderSVGToCanvas() {
  if (!svgRef.value || !canvasRef.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size to match viewBox
  canvas.width = 1100;
  canvas.height = 1050;

  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each path with blur
  ctx.filter = 'blur(70px)';

  // Orange path
  const orangePath = new Path2D('M803 517C830.5 647.5 712.5 729.5 549 729.5C385.5 729.5 206.5 563.5 226 421.5C243.852 291.5 349 255.5 491 274.5C660.489 297.178 782.302 418.778 803 517Z');
  ctx.fillStyle = 'rgba(255, 107, 9, 0.8)';
  ctx.fill(orangePath);

  // Pink path
  const pinkPath = new Path2D('M580 375.5C597 553.5 404.071 730 266 730C144.5 756 0 694.571 0 556.5C0 418.429 107.611 294.527 252.5 236C354 195 563 197.5 580 375.5Z');
  ctx.fillStyle = 'rgba(255, 42, 112, 0.8)';
  ctx.fill(pinkPath);

  // Yellow/Warm White path
  const yellowPath = new Path2D('M662 284C666.547 356 628.5 493.5 479 549C332 580.5 96 505.5 96 236C96 97.9288 222.929 0 361 0C499.071 0 651.931 124.562 662 284Z');
  ctx.fillStyle = 'rgba(255, 215, 109, 0.8)';
  ctx.fill(yellowPath);
}

/**
 * Sample pixel color at cursor position and derive LED values
 */
function sampleColorAtPosition(x: number, y: number): { r: number; g: number; b: number } {
  if (!canvasRef.value) return { r: 0, g: 0, b: 0 };

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { r: 0, g: 0, b: 0 };

  // Adjust coordinates for canvas (viewBox offset)
  const canvasX = Math.round(x + 150);
  const canvasY = Math.round(y + 150);

  // Sample pixel
  const imageData = ctx.getImageData(canvasX, canvasY, 1, 1);
  const [r, g, b] = imageData.data;

  return { r, g, b };
}

/**
 * Calculate LED values based on pie slice overlap
 * The grouping circle is divided into 3 equal slices (120° each): warmWhite, pink, orange
 * When tapping at a position, we create a circle centered at that tap point
 * The LED values are determined by how much of each slice is covered by the tap circle
 * @param x Touch x coordinate
 * @param y Touch y coordinate
 * @returns Object with pink, orange, warmWhite percentages (0-100)
 */
function calculateColorWheelValues(x: number, y: number): { pink: number; orange: number; warmWhite: number } {
  // Radius of the tap circle (use the configurable value)
  const tapRadius = tapCircleRadius.value;
  
  // Define the three pie slices (each 120° wide)
  // Orange: -60° to 60° (centered at 0°, pointing right)
  // Pink: 60° to 180° (centered at 120°, pointing upper left)
  // Warm White: 180° to 300° (centered at 240°, pointing lower left)
  
  /**
   * Check if a point belongs to a specific sector
   */
  function isInSector(px: number, py: number, startAngle: number, endAngle: number): boolean {
    const dx = px - groupingCenter.x;
    const dy = py - groupingCenter.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    // Handle wrap-around for sectors that cross 0°
    if (startAngle > endAngle) {
      return angle >= startAngle || angle < endAngle;
    }
    return angle >= startAngle && angle < endAngle;
  }
  
  /**
   * Check if a point is inside the tap circle
   */
  function isInTapCircle(px: number, py: number): boolean {
    const dx = px - x;
    const dy = py - y;
    return Math.sqrt(dx * dx + dy * dy) <= tapRadius;
  }
  
  // Sample points in a grid to calculate overlap
  // Use a fine grid for accuracy
  const gridSize = 40; // 40x40 grid
  const step = (tapRadius * 2) / gridSize;
  
  let warmWhiteCount = 0;
  let pinkCount = 0;
  let orangeCount = 0;
  let totalCount = 0;
  
  // Sample points within the tap circle's bounding box
  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const px = x - tapRadius + i * step;
      const py = y - tapRadius + j * step;
      
      // Check if this point is inside the tap circle
      if (isInTapCircle(px, py)) {
        totalCount++;
        
        // Check which sector this point belongs to
        // Apply rotation offset to sector boundaries
        const orangeStart = (300 + rotationOffset.value) % 360;
        const orangeEnd = (60 + rotationOffset.value) % 360;
        const pinkStart = (60 + rotationOffset.value) % 360;
        const pinkEnd = (180 + rotationOffset.value) % 360;
        const whiteStart = (180 + rotationOffset.value) % 360;
        const whiteEnd = (300 + rotationOffset.value) % 360;
        
        if (isInSector(px, py, orangeStart, orangeEnd)) {
          // Orange sector: -60° to 60° (300° to 60° with wrap)
          orangeCount++;
        } else if (isInSector(px, py, pinkStart, pinkEnd)) {
          // Pink sector: 60° to 180°
          pinkCount++;
        } else if (isInSector(px, py, whiteStart, whiteEnd)) {
          // Warm White sector: 180° to 300°
          warmWhiteCount++;
        }
      }
    }
  }
  
  // Calculate percentages based on overlap
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
 * Calculate a representative position from LED color values
 * This is an approximation - multiple positions could produce the same color values
 * @param warmWhite Warm white value (0-255)
 * @param pink Pink value (0-255)
 * @param orange Orange value (0-255)
 * @returns Approximate position { x, y }
 */
function calculatePositionFromColors(warmWhite: number, pink: number, orange: number): { x: number; y: number } {
  // Convert to percentages
  const total = warmWhite + pink + orange;
  if (total === 0) {
    // If all zeros, return center
    return { x: groupingCenter.x, y: groupingCenter.y };
  }
  
  const warmWhitePct = warmWhite / total;
  const pinkPct = pink / total;
  const orangePct = orange / total;
  
  // Find dominant color and its sector angle
  let dominantAngle: number;
  if (orangePct > pinkPct && orangePct > warmWhitePct) {
    // Orange sector center: 0° (with rotation offset)
    dominantAngle = 0;
  } else if (pinkPct > warmWhitePct) {
    // Pink sector center: 120° (with rotation offset)
    dominantAngle = 120;
  } else {
    // Warm white sector center: 240° (with rotation offset)
    dominantAngle = 240;
  }
  
  // Apply rotation offset
  dominantAngle = (dominantAngle + rotationOffset.value) % 360;
  
  // Calculate distance from center based on color intensity
  // Higher total intensity = further from center
  const maxPossible = 255 * 3;
  const intensity = total / maxPossible;
  const distance = intensity * tapCircleRadius.value * 0.8; // 80% of tap radius
  
  // Convert polar to cartesian coordinates
  const angleRad = (dominantAngle * Math.PI) / 180;
  const x = groupingCenter.x + distance * Math.cos(angleRad);
  const y = groupingCenter.y + distance * Math.sin(angleRad);
  
  return { x, y };
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

  // Convert client coordinates to SVG coordinates
  // ViewBox is -150 -150 1100 1050 (with extra padding to prevent clipping)
  const x = ((clientX - rect.left) / rect.width) * 1100 - 150;
  const y = ((clientY - rect.top) / rect.height) * 1050 - 150;

  return { x, y };
}

/**
 * Update LED values based on touch position
 */
function updateLEDValues(x: number, y: number) {
  touchPosition.value = { x, y };

  // Calculate LED values based on angle and distance (color wheel approach)
  const { pink, orange, warmWhite } = calculateColorWheelValues(x, y);
  
  ledValues.pink = pink;
  ledValues.orange = orange;
  ledValues.warmWhite = warmWhite;

  // Update persistent color position
  currentColorPosition.value = { x, y };

  // Send values to Arduino
  throttledSendToArduino();
}

/**
 * Send LED values to Arduino via IPC
 */
const sendToArduino = () => {
  // Convert percentages to 0-255 range
  const warmWhiteValue = Math.round((ledValues.warmWhite / 100) * 255);
  const pinkValue = Math.round((ledValues.pink / 100) * 255);
  const orangeValue = Math.round((ledValues.orange / 100) * 255);

  // Save to app state
  appStore.setLampColors({
    warmWhite: warmWhiteValue,
    pink: pinkValue,
    orange: orangeValue,
  });

  // Send to main process - we'll update the IPC handler to accept RGB values
  // For now, using the lamp control with RGB channels
  window.ipcRenderer.invoke('set-lamp-colors', {
    warmWhite: warmWhiteValue,
    pink: pinkValue,
    orange: orangeValue,
  });

  console.log('Sent lamp colors:', { warmWhiteValue, pinkValue, orangeValue });
};

const throttledSendToArduino = throttle(sendToArduino, 50);

/**
 * Handle pointer start (mouse or touch)
 */
function handlePointerStart(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  
  // Get the target element
  const target = event.target as HTMLElement;
  
  // Only respond if clicking on the first SVG (not the debug overlay)
  if (target.closest('svg')?.classList.contains('pointer-events-none')) {
    return;
  }
  
  isDragging.value = true;

  const coords = getSVGCoordinates(event);
  if (coords) {
    updateLEDValues(coords.x, coords.y);
  }

  // Add move and end listeners
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

  // Remove listeners
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);

  // Flush any pending updates
  throttledSendToArduino.flush();
}

/**
 * Handle right click to go back
 */
function handleRightClick(event: MouseEvent) {
  if (event.button === 2) {
    event.preventDefault();
    event.stopPropagation();
    throttledSendToArduino.flush();
    router.back();
  }
}

onMounted(() => {
  // Add right-click listener
  window.addEventListener('mousedown', handleRightClick);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Render SVG to canvas for pixel sampling
  renderSVGToCanvas();

  // Initialize with current lamp state if available
  if (appStore.lampColors) {
    ledValues.warmWhite = (appStore.lampColors.warmWhite / 255) * 100;
    ledValues.pink = (appStore.lampColors.pink / 255) * 100;
    ledValues.orange = (appStore.lampColors.orange / 255) * 100;
    
    // Calculate and set the position for the saved colors
    const position = calculatePositionFromColors(
      appStore.lampColors.warmWhite,
      appStore.lampColors.pink,
      appStore.lampColors.orange
    );
    currentColorPosition.value = position;
  } else {
    // Default to all LEDs off
    ledValues.warmWhite = 0;
    ledValues.pink = 0;
    ledValues.orange = 0;
  }
});

onBeforeUnmount(() => {
  // Flush any pending changes
  throttledSendToArduino.flush();

  // Clean up listeners
  window.removeEventListener('mousedown', handleRightClick);
  window.removeEventListener('contextmenu', (e) => e.preventDefault());
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', handlePointerEnd);
  window.removeEventListener('touchmove', handlePointerMove);
  window.removeEventListener('touchend', handlePointerEnd);
});
</script>


