<template>
  <div class="w-full h-full relative bg-black overflow-hidden flex items-center justify-center">
    <!-- Clock Preview in Center -->
    <div 
      class="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      :style="{ color: `rgb(${appStore.uiColor.r}, ${appStore.uiColor.g}, ${appStore.uiColor.b})` }"
    >
      <ClockComponent :showDate="false" />
    </div>

    <!-- Full-bleed Color Ring -->
    <canvas 
      ref="canvasRef" 
      class="absolute inset-0 w-full h-full touch-none cursor-pointer"
      @touchstart.prevent="handleStart"
      @touchmove.prevent="handleMove"
      @touchend="handleEnd"
      @mousedown="handleStart"
      @mousemove="handleMove"
      @mouseup="handleEnd"
      @mouseleave="handleEnd"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/appState';
import ClockComponent from '../components/ClockComponent.vue';
import * as THREE from 'three';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const appStore = useAppStore();
let isDragging = false;
let resizeObserver: ResizeObserver | null = null;
let animationFrameId: number | null = null;

// Geometry
const WHEEL_GAP_DEGREES = 40; // Degrees to leave open on the left
let centerX = 0;
let centerY = 0;
// We want the ring to be around the perimeter.
// Let's make it fairly thick.
const RING_THICKNESS = 100; 

// Draw the color wheel
const drawWheel = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  centerX = width / 2;
  centerY = height / 2;
  
  // Radius is roughly half the smaller dimension
  // We want it to be "full bleed" around the visible area
  // Usually this means fitting within the screen.
  const radius = Math.min(centerX, centerY) - (RING_THICKNESS / 2);

  // Clear
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);

  // Calculate angles for the gap (centered at PI/Left)
  const gapRadians = WHEEL_GAP_DEGREES * (Math.PI / 180);
  const startAngle = Math.PI + (gapRadians / 2);
  const endAngle = Math.PI - (gapRadians / 2); // Goes clockwise to this
  
  // To distribute full spectrum across the visible arc, we normalize.
  // Visible span in radians
  const visibleRadians = (2 * Math.PI) - gapRadians;
  const k = visibleRadians / (2 * Math.PI);

  // Conic Gradient for Hue
  // Rotated so that gradient start aligns with our startAngle.
  const hueGradient = ctx.createConicGradient(startAngle, 0, 0);
  
  // We want colors to go from 0 to 1 over the span of "visibleRadians"
  // But define stops in terms of 0..1 representing 0..360 deg
  hueGradient.addColorStop(0, 'red');
  hueGradient.addColorStop(0.166 * k, 'yellow');
  hueGradient.addColorStop(0.333 * k, '#00ff00'); // lime
  hueGradient.addColorStop(0.5 * k, 'cyan');
  hueGradient.addColorStop(0.666 * k, 'blue');
  hueGradient.addColorStop(0.833 * k, 'magenta');
  hueGradient.addColorStop(1.0 * k, 'red');
  // Gradient from k to 1 is not used

  // Draw Ring
  ctx.beginPath();
  // Draw arc skipping the gap on the left
  ctx.arc(0, 0, radius, startAngle, endAngle);
  ctx.strokeStyle = hueGradient;
  ctx.lineWidth = RING_THICKNESS;
  ctx.stroke();

  // Draw Indicator (White ring at current hue)
  const currentRGB = appStore.uiColor; 
  const color = new THREE.Color(currentRGB.r / 255, currentRGB.g / 255, currentRGB.b / 255);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  
  // Map hue back to visual angle
  // hue 0 -> startAngle
  // hue 1 -> startAngle + visibleRadians
  const relativeAngle = hsl.h * visibleRadians;
  const angle = startAngle + relativeAngle;
  
  const indicatorX = Math.cos(angle) * radius;
  const indicatorY = Math.sin(angle) * radius;

  // Indicator circle on top of the ring
  ctx.beginPath();
  ctx.arc(indicatorX, indicatorY, RING_THICKNESS / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Fill indicator center with current color
  ctx.beginPath();
  ctx.arc(indicatorX, indicatorY, RING_THICKNESS / 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${currentRGB.r}, ${currentRGB.g}, ${currentRGB.b})`;
  ctx.fill();

  ctx.restore();
};

const updateColorFromInput = (clientIDX: number, clientIDY: number) => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  
  // Coordinates relative to center
  const x = clientIDX - rect.left - (rect.width / 2);
  const y = clientIDY - rect.top - (rect.height / 2);
  
  // Calculate Angle (Hue)
  let angle = Math.atan2(y, x);
  if (angle < 0) angle += Math.PI * 2;
  
  // Handle Gap (centered at PI)
  const gapRadians = WHEEL_GAP_DEGREES * (Math.PI / 180);
  const gapHalf = gapRadians / 2;
  const gapStart = Math.PI - gapHalf;
  const gapEnd = Math.PI + gapHalf;

  // We need to define where the arc starts/ends for hue calculation.
  // Visual Start: startAngle = PI + gapHalf (210 deg)
  const startAngle = gapEnd; 

  const visibleRadians = (2 * Math.PI) - gapRadians;

  // Shift angle so that startAngle is at 0
  let relativeAngle = angle - startAngle;
  if (relativeAngle < 0) relativeAngle += (2 * Math.PI);
  
  // If user clicks in the "invisible" gap, clamp to nearest end
  // In relative terms, the valid range is [0, visibleRadians]
  // The gap is (visibleRadians, 2PI)
  if (relativeAngle > visibleRadians) {
      // Closer to visibleRadians (end of spectrum) or 0 (start of spectrum)?
      const distToEnd = Math.abs(relativeAngle - visibleRadians);
      const distToStart = Math.abs(relativeAngle - 2 * Math.PI); // which is 0 effectively
      if (distToEnd < distToStart) {
          relativeAngle = visibleRadians;
      } else {
          relativeAngle = 0;
      }
  }

  const hue = relativeAngle / visibleRadians;

  // Set new color
  // Saturation fixed at 1, Lightness fixed at 0.5
  const color = new THREE.Color();
  color.setHSL(hue, 1.0, 0.5);
  
  appStore.setUiColor({
      r: Math.round(color.r * 255),
      g: Math.round(color.g * 255),
      b: Math.round(color.b * 255)
  });
  
  // Use animation frame to throttle drawing if needed, 
  // but for immediate feedback we can just call drawWheel
  if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(() => {
          drawWheel();
          animationFrameId = null;
      });
  }
};

const handleStart = (e: MouseEvent | TouchEvent) => {
  isDragging = true;
  handleInput(e);
};

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging) return;
  handleInput(e);
};

const handleEnd = () => {
  isDragging = false;
};

const handleInput = (e: MouseEvent | TouchEvent) => {
  // Prevent default to avoid scrolling
  // e.preventDefault(); // Handled by modifier .prevent in template

  let clientX, clientY;
  if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
  } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
  }
  updateColorFromInput(clientX, clientY);
};

const resizeCanvas = () => {
    const canvas = canvasRef.value;
    if (canvas) {
        const parent = canvas.parentElement;
        if (parent) {
            const { width, height } = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
            // Adjust loop loop
            requestAnimationFrame(drawWheel);
        }
    }
};

onMounted(() => {
    resizeCanvas();
    resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
    });
    if (canvasRef.value?.parentElement) {
        resizeObserver.observe(canvasRef.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});
</script>

