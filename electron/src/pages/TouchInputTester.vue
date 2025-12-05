<template>
  <div class="touch-input-tester">
    <!-- Touch Canvas with circular overlay -->
    <div 
      ref="touchCanvas" 
      class="touch-canvas"
    >
      <!-- Render drag paths -->
      <svg class="paths-svg" :width="canvasWidth" :height="canvasHeight">
        <!-- Completed paths -->
        <path
          v-for="(path, index) in paths"
          :key="`path-${index}`"
          :d="path.d"
          :stroke="path.color"
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="path.opacity"
        />
        
        <!-- Active touch paths (drawing in real-time) -->
        <path
          v-for="[id, points] of activeTouchPaths"
          :key="`active-path-${id}`"
          :d="createPathString(points)"
          :stroke="activeTouches.get(id)?.color || '#fff'"
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
        />
        
        <!-- Active touch indicators -->
        <circle
          v-for="[id, touch] of activeTouches"
          :key="`active-${id}`"
          :cx="touch.currentX"
          :cy="touch.currentY"
          r="15"
          :fill="touch.color"
          opacity="0.7"
          stroke="white"
          stroke-width="2"
        />
      </svg>

      <!-- Tap hotspots -->
      <div
        v-for="(tap, index) in taps"
        :key="`tap-${index}`"
        class="tap-hotspot"
        :style="{
          left: tap.x + 'px',
          top: tap.y + 'px',
          backgroundColor: tap.color,
          opacity: tap.opacity
        }"
      >
        <span class="tap-label">{{ tap.id }}</span>
      </div>

      <!-- Circular UI Overlay -->
      <div class="circular-overlay">
        <!-- Top: Title and Controls -->
        <div class="top-section">
          <h1 class="title">Touch Debugger</h1>
          <div class="controls">
            <button @click="clearPaths" class="clear-btn">Clear</button>
            <button @click="goBack" class="back-btn">✕</button>
          </div>
        </div>

        <!-- Center: Stats in circular layout -->
        <div class="stats-circle">
          <div class="stat-item stat-top">
            <div class="stat-value">{{ activeTouches.size }}</div>
            <div class="stat-label">Active</div>
          </div>
          <div class="stat-item stat-left">
            <div class="stat-value">{{ totalTaps }}</div>
            <div class="stat-label">Taps</div>
          </div>
          <div class="stat-item stat-right">
            <div class="stat-value">{{ totalDrags }}</div>
            <div class="stat-label">Drags</div>
          </div>
          <div class="stat-item stat-bottom">
            <div class="stat-value">{{ falseTouches }}</div>
            <div class="stat-label">False</div>
          </div>
        </div>

        <!-- Bottom: Touch Details -->
        <div class="details-compact">
          <div v-if="activeTouches.size === 0" class="no-touches">
            Touch the screen
          </div>
          <div v-else class="touch-list-compact">
            <div 
              v-for="[id, touch] of activeTouches" 
              :key="`detail-${id}`"
              class="touch-detail-compact"
            >
              <div class="touch-badge" :style="{ backgroundColor: touch.color }">
                {{ id }}
              </div>
              <div class="touch-info-compact">
                <span>{{ Math.round(touch.currentX) }},{{ Math.round(touch.currentY) }}</span>
                <span>{{ Math.round(touch.distance) }}px</span>
                <span>{{ Math.round(touch.duration) }}ms</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Legend at very bottom -->
        <div class="legend-compact">
          <div class="legend-item">
            <div class="legend-dot" style="background: #00ff88;"></div>
            <span>Tap</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background: #ff6b6b;"></div>
            <span>Drag</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background: #ffd93d;"></div>
            <span>False</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { TouchController, GestureEvent, TouchPoint } from '../services/TouchController';

const router = useRouter();

// Canvas dimensions
const touchCanvas = ref<HTMLElement | null>(null);
const canvasWidth = ref(1024);
const canvasHeight = ref(1024);

// Touch controller instance
let touchController: TouchController | null = null;

// Touch tracking
interface TouchInfo {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  color: string;
  distance: number;
  duration: number;
  type: 'tap' | 'drag' | 'false';
}

interface Path {
  d: string;
  color: string;
  opacity: number;
}

interface Tap {
  id: number;
  x: number;
  y: number;
  color: string;
  opacity: number;
}

const activeTouches = ref<Map<number, TouchInfo>>(new Map());
const activeTouchPaths = ref<Map<number, TouchPoint[]>>(new Map());
const paths = ref<Path[]>([]);
const taps = ref<Tap[]>([]);
const totalTaps = ref(0);
const totalDrags = ref(0);
const falseTouches = ref(0);

// Color palette for different touches
const colors = [
  '#00ff88', '#ff6b6b', '#4ecdc4', '#ffd93d', '#ff9ff3', 
  '#6bcf7f', '#ff6b9d', '#95e1d3', '#f38181', '#aa96da'
];

let tapIdCounter = 0;

// Convert touch path to SVG path string
function createPathString(points: TouchPoint[]): string {
  if (points.length === 0) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// Handle active gesture updates from TouchController
function handleActiveGesture(id: number, currentPoint: TouchPoint, path: TouchPoint[]) {
  const color = colors[id % colors.length];
  
  // Update or create touch info
  const existingTouch = activeTouches.value.get(id);
  if (existingTouch) {
    existingTouch.currentX = currentPoint.x;
    existingTouch.currentY = currentPoint.y;
    existingTouch.distance = Math.sqrt(
      Math.pow(currentPoint.x - existingTouch.startX, 2) +
      Math.pow(currentPoint.y - existingTouch.startY, 2)
    );
    existingTouch.duration = currentPoint.timestamp - path[0].timestamp;
  } else {
    // New touch starting
    const touchInfo: TouchInfo = {
      id,
      startX: path[0].x,
      startY: path[0].y,
      currentX: currentPoint.x,
      currentY: currentPoint.y,
      startTime: path[0].timestamp,
      color,
      distance: 0,
      duration: 0,
      type: 'tap'
    };
    activeTouches.value.set(id, touchInfo);
    
    console.log(`[Touch ${id}] START:`, {
      touchId: id,
      eventType: 'START',
      startPos: { x: Math.round(path[0].x), y: Math.round(path[0].y) },
      timestamp: new Date().toISOString().split('T')[1].split('.')[0]
    });
  }
  
  // Update path
  activeTouchPaths.value.set(id, path);
}

// Handle completed gesture from TouchController
function handleGesture(gesture: GestureEvent) {
  const touch = activeTouches.value.get(gesture.id);
  if (!touch) return;
  
  touch.currentX = gesture.endPoint.x;
  touch.currentY = gesture.endPoint.y;
  touch.distance = gesture.distance;
  touch.duration = gesture.duration;
  touch.type = gesture.type;
  
  // Log the completed gesture
  console.log(`[Touch ${gesture.id}] END:`, {
    touchId: gesture.id,
    eventType: 'END',
    startPos: { x: Math.round(gesture.startPoint.x), y: Math.round(gesture.startPoint.y) },
    endPos: { x: Math.round(gesture.endPoint.x), y: Math.round(gesture.endPoint.y) },
    distance: Math.round(gesture.distance),
    duration: Math.round(gesture.duration),
    type: gesture.type,
    pathPoints: gesture.path.length,
    cancelled: gesture.cancelled,
    timestamp: new Date().toISOString().split('T')[1].split('.')[0]
  });
  
  // Process the gesture
  if (gesture.type === 'false') {
    falseTouches.value++;
    console.log(`[Touch ${gesture.id}] ⚠️  FALSE TOUCH detected`);
  } else if (gesture.type === 'tap') {
    totalTaps.value++;
    console.log(`[Touch ${gesture.id}] ✓ TAP detected`);
    taps.value.push({
      id: tapIdCounter++,
      x: gesture.endPoint.x - 15,
      y: gesture.endPoint.y - 15,
      color: '#00ff88',
      opacity: 1.0
    });
    
    // Fade out tap after 2 seconds
    const tap = taps.value[taps.value.length - 1];
    setTimeout(() => {
      const interval = setInterval(() => {
        tap.opacity -= 0.05;
        if (tap.opacity <= 0) {
          clearInterval(interval);
          const index = taps.value.indexOf(tap);
          if (index > -1) taps.value.splice(index, 1);
        }
      }, 50);
    }, 2000);
  } else {
    totalDrags.value++;
    console.log(`[Touch ${gesture.id}] ⟿ DRAG detected`);
    if (gesture.path.length > 1) {
      paths.value.push({
        d: createPathString(gesture.path),
        color: touch.color,
        opacity: 0.8
      });
      
      // Fade out path after 5 seconds
      const path = paths.value[paths.value.length - 1];
      setTimeout(() => {
        const interval = setInterval(() => {
          path.opacity -= 0.02;
          if (path.opacity <= 0) {
            clearInterval(interval);
            const index = paths.value.indexOf(path);
            if (index > -1) paths.value.splice(index, 1);
          }
        }, 100);
      }, 5000);
    }
  }
  
  // Clean up
  activeTouches.value.delete(gesture.id);
  activeTouchPaths.value.delete(gesture.id);
}

function clearPaths() {
  console.log('═══════════════════════════════════════');
  console.log('🧹 CLEARED - Summary:', {
    totalTaps: totalTaps.value,
    totalDrags: totalDrags.value,
    falseTouches: falseTouches.value
  });
  console.log('═══════════════════════════════════════');
  
  paths.value = [];
  taps.value = [];
  totalTaps.value = 0;
  totalDrags.value = 0;
  falseTouches.value = 0;
  tapIdCounter = 0;
}

function goBack() {
  router.push({ name: 'Clock' });
}

onMounted(() => {
  if (touchCanvas.value) {
    const rect = touchCanvas.value.getBoundingClientRect();
    canvasWidth.value = rect.width;
    canvasHeight.value = rect.height;
    
    // Initialize TouchController
    touchController = new TouchController(touchCanvas.value);
    touchController.onGesture(handleGesture);
    touchController.onActiveGesture(handleActiveGesture);
    
    console.log('🎮 TouchController initialized');
  }
});

onUnmounted(() => {
  if (touchController) {
    touchController.destroy();
    touchController = null;
  }
  activeTouches.value.clear();
  activeTouchPaths.value.clear();
});
</script>

<style scoped>
.touch-input-tester {
  width: 100vw;
  height: 100vh;
  background: #000;
  color: #eee;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.touch-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a14 100%);
  overflow: hidden;
  touch-action: none;
  cursor: crosshair;
}

.paths-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tap-hotspot {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: opacity 0.1s;
}

.tap-label {
  font-size: 10px;
  font-weight: bold;
  color: white;
}

/* Circular Overlay Layout */
.circular-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 120px 60px 120px 60px;
}

.circular-overlay * {
  pointer-events: auto;
}

/* Top Section */
.top-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 65%;
  max-width: 900px;
}

.title {
  font-size: 28px;
  margin: 0;
  color: #00ff88;
  font-weight: 600;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.controls {
  display: flex;
  gap: 10px;
}

.clear-btn,
.back-btn {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.clear-btn {
  background: #ff6b6b;
  color: white;
}

.clear-btn:active {
  transform: scale(0.95);
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  backdrop-filter: blur(10px);
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
  font-size: 24px;
}

.back-btn:active {
  transform: scale(0.95);
}

/* Center Stats Circle */
.stats-circle {
  position: relative;
  width: 300px;
  height: 300px;
  margin: auto;
}

.stat-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.stat-top {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.stat-bottom {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.stat-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.stat-right {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #00ff88;
  line-height: 1;
  margin-bottom: 4px;
  text-shadow: 0 0 15px rgba(0, 255, 136, 0.5);
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

/* Bottom Details */
.details-compact {
  width: 100%;
  max-width: 800px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 140px;
  overflow-y: auto;
}

.no-touches {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  text-align: center;
  padding: 12px;
  font-size: 13px;
}

.touch-list-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.touch-detail-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.touch-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.touch-info-compact {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-variant-numeric: tabular-nums;
}

.touch-info-compact span {
  font-weight: 500;
}

/* Legend */
.legend-compact {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Scrollbar styling */
.details-compact::-webkit-scrollbar {
  width: 6px;
}

.details-compact::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.details-compact::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.details-compact::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
