<template>
  <div class="gesture-tester">
    <div 
      ref="gestureCanvas" 
      class="gesture-canvas"
    >
      <!-- SVG for paths -->
      <svg class="gesture-svg" :width="canvasWidth" :height="canvasHeight">
        <!-- Gesture paths -->
        <path
          v-for="(gesture, index) in gesturePaths"
          :key="`gesture-${index}`"
          :d="gesture.pathString"
          :stroke="gesture.color"
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="gesture.opacity"
        />
        
        <!-- Direction arrows for drags -->
        <g v-for="(gesture, index) in gesturePaths.filter(g => g.arrow)" :key="`arrow-${index}`">
          <defs>
            <marker
              :id="`arrowhead-${index}`"
              markerWidth="10"
              markerHeight="10"
              refX="5"
              refY="5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 5, 0 10"
                :fill="gesture.color"
              />
            </marker>
          </defs>
          <line
            :x1="gesture.arrow!.x1"
            :y1="gesture.arrow!.y1"
            :x2="gesture.arrow!.x2"
            :y2="gesture.arrow!.y2"
            :stroke="gesture.color"
            stroke-width="3"
            :marker-end="`url(#arrowhead-${index})`"
            :opacity="gesture.opacity"
          />
        </g>
      </svg>

      <!-- Tap indicators -->
      <div
        v-for="(tap, index) in tapIndicators"
        :key="`tap-${index}`"
        class="tap-indicator"
        :class="{ 'double-tap': tap.isDoubleTap }"
        :style="{
          left: tap.x + 'px',
          top: tap.y + 'px',
          backgroundColor: tap.color,
          opacity: tap.opacity,
          transform: tap.isDoubleTap ? 'translate(-50%, -50%) scale(1.5)' : 'translate(-50%, -50%)'
        }"
      >
        <span class="tap-number">{{ tap.isDoubleTap ? '2×' : '1×' }}</span>
      </div>

      <!-- UI Overlay -->
      <div class="overlay">
        <!-- Header -->
        <div class="header">
          <h1 class="title">Gesture Recognizer</h1>
          <div class="controls">
            <button @click="clearAll" class="clear-btn">Clear</button>
            <button @click="goBack" class="back-btn">✕</button>
          </div>
        </div>

        <!-- Gesture Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card tap-stat">
            <div class="stat-icon">👆</div>
            <div class="stat-value">{{ stats.taps }}</div>
            <div class="stat-label">Taps</div>
          </div>
          
          <div class="stat-card double-tap-stat">
            <div class="stat-icon">👆👆</div>
            <div class="stat-value">{{ stats.doubleTaps }}</div>
            <div class="stat-label">Double Taps</div>
          </div>
          
          <div class="stat-card horizontal-stat">
            <div class="stat-icon">↔️</div>
            <div class="stat-value">{{ stats.horizontalDrags }}</div>
            <div class="stat-label">Horizontal</div>
          </div>
          
          <div class="stat-card vertical-stat">
            <div class="stat-icon">↕️</div>
            <div class="stat-value">{{ stats.verticalDrags }}</div>
            <div class="stat-label">Vertical</div>
          </div>
        </div>

        <!-- Last Gesture Info -->
        <div class="last-gesture" v-if="lastGesture">
          <div class="gesture-badge" :style="{ backgroundColor: getGestureColor(lastGesture.type) }">
            {{ getGestureIcon(lastGesture.type) }}
          </div>
          <div class="gesture-details">
            <div class="gesture-type">{{ formatGestureType(lastGesture.type) }}</div>
            <div class="gesture-info">
              <span v-if="lastGesture.direction" class="direction">
                {{ lastGesture.direction.toUpperCase() }}
              </span>
              <span class="distance">{{ Math.round(lastGesture.distance) }}px</span>
              <span class="duration">{{ Math.round(lastGesture.duration) }}ms</span>
            </div>
          </div>
        </div>

        <!-- Gesture Log -->
        <div class="gesture-log">
          <div class="log-header">Recent Gestures</div>
          <div class="log-items">
            <div
              v-for="(log, index) in recentGestures"
              :key="`log-${index}`"
              class="log-item"
              :style="{ opacity: 1 - (index * 0.1) }"
            >
              <span class="log-icon" :style="{ color: getGestureColor(log.type) }">
                {{ getGestureIcon(log.type) }}
              </span>
              <span class="log-type">{{ formatGestureType(log.type) }}</span>
              <span class="log-detail" v-if="log.direction">{{ log.direction }}</span>
              <span class="log-distance">{{ Math.round(log.distance) }}px</span>
            </div>
            <div v-if="recentGestures.length === 0" class="log-empty">
              No gestures yet - try touching the screen!
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <div class="legend-item">
            <div class="legend-dot tap-color"></div>
            <span>Tap</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot double-tap-color"></div>
            <span>Double Tap</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot horizontal-color"></div>
            <span>Horizontal</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot vertical-color"></div>
            <span>Vertical</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { GestureRecognizer, RecognizedGesture, GestureType } from '../services/GestureRecognizer';
import { TouchPoint } from '../services/TouchController';

const router = useRouter();

// Canvas dimensions
const gestureCanvas = ref<HTMLElement | null>(null);
const canvasWidth = ref(1024);
const canvasHeight = ref(1024);

// Gesture recognizer instance
let gestureRecognizer: GestureRecognizer | null = null;

// Stats
const stats = reactive({
  taps: 0,
  doubleTaps: 0,
  horizontalDrags: 0,
  verticalDrags: 0,
});

// Visual elements
interface GesturePath {
  pathString: string;
  color: string;
  opacity: number;
  arrow?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface TapIndicator {
  x: number;
  y: number;
  color: string;
  opacity: number;
  isDoubleTap: boolean;
}

const gesturePaths = ref<GesturePath[]>([]);
const tapIndicators = ref<TapIndicator[]>([]);
const lastGesture = ref<RecognizedGesture | null>(null);
const recentGestures = ref<RecognizedGesture[]>([]);

// Color scheme
const COLORS = {
  tap: '#00ff88',
  doubleTap: '#ff66ff',
  horizontal: '#4ecdc4',
  vertical: '#ffd93d',
};

// Convert touch path to SVG path string
function createPathString(points: TouchPoint[]): string {
  if (points.length === 0) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// Get color for gesture type
function getGestureColor(type: GestureType): string {
  switch (type) {
    case 'tap':
      return COLORS.tap;
    case 'double-tap':
      return COLORS.doubleTap;
    case 'drag-horizontal':
      return COLORS.horizontal;
    case 'drag-vertical':
      return COLORS.vertical;
    default:
      return '#ffffff';
  }
}

// Get icon for gesture type
function getGestureIcon(type: GestureType): string {
  switch (type) {
    case 'tap':
      return '👆';
    case 'double-tap':
      return '👆👆';
    case 'drag-horizontal':
      return '↔️';
    case 'drag-vertical':
      return '↕️';
    default:
      return '•';
  }
}

// Format gesture type for display
function formatGestureType(type: GestureType): string {
  switch (type) {
    case 'tap':
      return 'Tap';
    case 'double-tap':
      return 'Double Tap';
    case 'drag-horizontal':
      return 'Horizontal Drag';
    case 'drag-vertical':
      return 'Vertical Drag';
    default:
      return type;
  }
}

// Create arrow for drag gestures
function createArrow(startPoint: TouchPoint, endPoint: TouchPoint, distance: number) {
  if (distance < 20) return undefined;
  
  // Calculate arrow position (at 70% of the path)
  const ratio = 0.7;
  const x1 = startPoint.x + (endPoint.x - startPoint.x) * (ratio - 0.1);
  const y1 = startPoint.y + (endPoint.y - startPoint.y) * (ratio - 0.1);
  const x2 = startPoint.x + (endPoint.x - startPoint.x) * ratio;
  const y2 = startPoint.y + (endPoint.y - startPoint.y) * ratio;
  
  return { x1, y1, x2, y2 };
}

// Fade out element
function fadeOut(element: { opacity: number }, delay: number, callback?: () => void) {
  setTimeout(() => {
    const interval = setInterval(() => {
      element.opacity -= 0.05;
      if (element.opacity <= 0) {
        clearInterval(interval);
        if (callback) callback();
      }
    }, 50);
  }, delay);
}

// Handle recognized gesture
function handleGesture(gesture: RecognizedGesture) {
  console.log('Gesture recognized:', {
    type: gesture.type,
    direction: gesture.direction,
    distance: Math.round(gesture.distance),
    duration: Math.round(gesture.duration),
    delta: {
      x: Math.round(gesture.deltaX || 0),
      y: Math.round(gesture.deltaY || 0),
    },
  });

  // Update stats
  switch (gesture.type) {
    case 'tap':
      stats.taps++;
      break;
    case 'double-tap':
      stats.doubleTaps++;
      break;
    case 'drag-horizontal':
      stats.horizontalDrags++;
      break;
    case 'drag-vertical':
      stats.verticalDrags++;
      break;
  }

  // Update last gesture
  lastGesture.value = gesture;

  // Add to recent gestures
  recentGestures.value.unshift(gesture);
  if (recentGestures.value.length > 8) {
    recentGestures.value.pop();
  }

  // Visualize gesture
  const color = getGestureColor(gesture.type);

  if (gesture.type === 'tap' || gesture.type === 'double-tap') {
    // Show tap indicator
    const indicator: TapIndicator = {
      x: gesture.endPoint.x,
      y: gesture.endPoint.y,
      color,
      opacity: 1.0,
      isDoubleTap: gesture.type === 'double-tap',
    };
    tapIndicators.value.push(indicator);
    
    fadeOut(indicator, 1500, () => {
      const index = tapIndicators.value.indexOf(indicator);
      if (index > -1) tapIndicators.value.splice(index, 1);
    });
  } else {
    // Show drag path
    const path: GesturePath = {
      pathString: createPathString(gesture.path),
      color,
      opacity: 0.9,
      arrow: createArrow(gesture.startPoint, gesture.endPoint, gesture.distance),
    };
    gesturePaths.value.push(path);
    
    fadeOut(path, 3000, () => {
      const index = gesturePaths.value.indexOf(path);
      if (index > -1) gesturePaths.value.splice(index, 1);
    });
  }
}

// Clear all visualizations and stats
function clearAll() {
  gesturePaths.value = [];
  tapIndicators.value = [];
  lastGesture.value = null;
  recentGestures.value = [];
  stats.taps = 0;
  stats.doubleTaps = 0;
  stats.horizontalDrags = 0;
  stats.verticalDrags = 0;
  console.log('Cleared all gestures');
}

// Navigate back
function goBack() {
  router.push({ name: 'Clock' });
}

onMounted(() => {
  if (gestureCanvas.value) {
    const rect = gestureCanvas.value.getBoundingClientRect();
    canvasWidth.value = rect.width;
    canvasHeight.value = rect.height;
    
    // Initialize GestureRecognizer
    gestureRecognizer = new GestureRecognizer(gestureCanvas.value);
    gestureRecognizer.onGesture(handleGesture);
    
    console.log('🎮 GestureRecognizer initialized');
    console.log('Config:', gestureRecognizer.getConfig());
  }
});

onUnmounted(() => {
  if (gestureRecognizer) {
    gestureRecognizer.destroy();
    gestureRecognizer = null;
  }
});
</script>

<style scoped>
.gesture-tester {
  width: 100vw;
  height: 100vh;
  background: #000;
  color: #eee;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.gesture-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a14 100%);
  overflow: hidden;
  touch-action: none;
  cursor: crosshair;
}

.gesture-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

/* Tap Indicators */
.tap-indicator {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.8);
  transition: transform 0.2s ease;
}

.tap-indicator.double-tap {
  border: 3px solid rgba(255, 255, 255, 1);
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
}

.tap-number {
  font-size: 14px;
  font-weight: bold;
  color: #000;
}

/* Overlay */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  pointer-events: auto;
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.controls {
  display: flex;
  gap: 10px;
}

.clear-btn,
.back-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.clear-btn:hover,
.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.back-btn {
  padding: 10px 15px;
  font-size: 20px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 30px;
  pointer-events: none;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Last Gesture */
.last-gesture {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.gesture-badge {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gesture-details {
  flex: 1;
}

.gesture-type {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 5px;
}

.gesture-info {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.direction {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Gesture Log */
.gesture-log {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.log-header {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.log-items {
  flex: 1;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.log-item:last-child {
  border-bottom: none;
}

.log-icon {
  font-size: 18px;
}

.log-type {
  flex: 1;
  font-weight: 500;
}

.log-detail {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  text-transform: uppercase;
}

.log-distance {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.log-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 20px;
  font-style: italic;
}

/* Legend */
.legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.tap-color {
  background: #00ff88;
}

.double-tap-color {
  background: #ff66ff;
}

.horizontal-color {
  background: #4ecdc4;
}

.vertical-color {
  background: #ffd93d;
}
</style>
