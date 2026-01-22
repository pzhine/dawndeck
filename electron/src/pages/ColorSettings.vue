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

  // Conic Gradient for Hue
  // Start angle -PI/2 to put Red at Top (if desired) or 0 for East.
  // Standard clocks usually start at top, but color wheels start at East (0).
  // Let's stick effectively to standard math angle 0 = East.
  const hueGradient = ctx.createConicGradient(0, 0, 0);
  hueGradient.addColorStop(0, 'red');
  hueGradient.addColorStop(0.166, 'yellow');
  hueGradient.addColorStop(0.333, '#00ff00'); // lime
  hueGradient.addColorStop(0.5, 'cyan');
  hueGradient.addColorStop(0.666, 'blue');
  hueGradient.addColorStop(0.833, 'magenta');
  hueGradient.addColorStop(1, 'red');

  // Draw Ring
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = hueGradient;
  ctx.lineWidth = RING_THICKNESS;
  ctx.stroke();

  // Draw Indicator (White ring at current hue)
  const currentRGB = appStore.uiColor; 
  const color = new THREE.Color(currentRGB.r / 255, currentRGB.g / 255, currentRGB.b / 255);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  
  // Angle for indicator
  const angle = hsl.h * Math.PI * 2;
  
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
  
  const hue = angle / (Math.PI * 2);

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

