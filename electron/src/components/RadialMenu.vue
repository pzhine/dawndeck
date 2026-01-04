<template>
  <div class="radial-menu-container">
    <div class="content-wrapper" :class="{ 'shrunk': isActive }" @touchstart.prevent="activateMenu" @click="activateMenu">
      <slot></slot>
    </div>
    <div ref="canvasContainer" class="canvas-container" :class="{ 'active': isActive }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, PropType, watch, nextTick, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import * as THREE from 'three';

export interface MenuItem {
  label: string;
  icon: string; // SVG string
  route?: string;
  action?: () => void;
  hold?: boolean; // If true, action triggers after a brief hold
  continuous?: boolean; // If true, action triggers repeatedly while holding
}

const props = defineProps({
  items: {
    type: Array as PropType<MenuItem[]>,
    required: true,
  },
  skipPositions: {
    type: Array as PropType<number[]>,
    default: () => [1],
  },
  minPositions: {
    type: Number,
    default: 6,
  },
});

const router = useRouter();

// Create fixed number of positions with spacers at specified indices
const processedItems = computed(() => {
  const positions: (MenuItem & { isSpacer?: boolean })[] = [];
  let itemIndex = 0;
  
  for (let positionIndex = 0; positionIndex < props.minPositions; positionIndex++) {
    if (props.skipPositions.includes(positionIndex)) {
      // Create an empty spacer at this position
      positions.push({ label: '', icon: '', isSpacer: true });
    } else if (itemIndex < props.items.length) {
      // Fill with the next item from the data array
      positions.push(props.items[itemIndex]);
      itemIndex++;
    } else {
      // No more items, create a spacer to fill remaining positions
      positions.push({ label: '', icon: '', isSpacer: true });
    }
  }
  
  return positions;
});

watch(() => processedItems.value, (newItems, oldItems) => {
  if (!scene) return;

  // Check if full redraw is needed (if number of items changed)
  const needsRedraw = !oldItems || newItems.length !== oldItems.length;

  if (needsRedraw) {
    createMenuGeometry();
  } else {
    // Just update the data and textures where needed
    segments.forEach((mesh, i) => {
      if (mesh.userData) {
        const oldItem = mesh.userData.item;
        const newItem = newItems[i];
        
        // Always update the item reference for actions
        mesh.userData.item = newItem;

        // Only redraw texture if label or icon changed
        if (newItem.label !== oldItem.label || newItem.icon !== oldItem.icon) {
           const iconMesh = mesh.userData.iconMesh;
           if (iconMesh) {
               const material = iconMesh.material as THREE.MeshBasicMaterial;
               const texture = material.map as THREE.CanvasTexture;
               const canvas = texture.image as HTMLCanvasElement;
               drawIconAndLabel(canvas, texture, newItem);
           }
        }
      }
    });
  }
}, { deep: true });

const isActive = ref(false);
const canvasContainer = ref<HTMLDivElement | null>(null);

// Three.js variables
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let menuGroup: THREE.Group;
let segments: THREE.Mesh[] = [];
let animationFrameId: number;
let hoveredSegment: THREE.Mesh | null = null;

const MENU_RADIUS_INNER = 200;
const MENU_RADIUS_OUTER = 370;
const GAP_ANGLE = 0.05; // Radians
const SEGMENT_COLOR = 0x222222;
const HOVER_COLOR = 0x444444;
const ICON_COLOR = '#ffffff';

const activateMenu = () => {
  isActive.value = true;
  nextTick(() => {
    if (!renderer) {
      initThree();
    }
    startAnimation();
  });
};

const hideMenu = () => {
  nextTick(() => {
    isActive.value = false;
    stopAnimation();
  });
};

const initThree = () => {
  if (!canvasContainer.value) return;

  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;

  // Scene
  scene = new THREE.Scene();

  // Camera (Orthographic for 2D UI)
  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    1,
    1000
  );
  camera.position.z = 10;

  // Renderer
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasContainer.value.appendChild(renderer.domElement);

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Create Menu
  createMenuGeometry();

  // Event Listeners
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onGlobalTouchEnd, { passive: false });
  window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
  
  // Mouse events for desktop testing
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
};

const createMenuGeometry = () => {
  // Clear existing
  if (menuGroup) {
    scene.remove(menuGroup);
    segments = [];
  }
  
  menuGroup = new THREE.Group();
  scene.add(menuGroup);

  const count = processedItems.value.length;
  const anglePerSegment = (Math.PI * 2) / count;

  processedItems.value.forEach((item, index) => {
    // Clockwise starting from Top-Left (PI/2 + one segment counterclockwise)
    const segmentCenterAngle = (Math.PI / 2) + anglePerSegment - (index * anglePerSegment);
    
    // RingGeometry draws counter-clockwise from thetaStart.
    // We want the segment to be centered at segmentCenterAngle.
    // So thetaStart should be segmentCenterAngle - (length/2).
    
    const lengthAngle = anglePerSegment - GAP_ANGLE;
    const startAngle = segmentCenterAngle - (lengthAngle / 2);

    // Geometry
    const geometry = new THREE.RingGeometry(
      MENU_RADIUS_INNER,
      MENU_RADIUS_OUTER,
      32,
      1,
      startAngle,
      lengthAngle
    );

    // Material - make spacer invisible
    const material = new THREE.MeshBasicMaterial({
      color: SEGMENT_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: (item as any).isSpacer ? 0 : 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { index, item, originalColor: SEGMENT_COLOR };
    menuGroup.add(mesh);
    segments.push(mesh);

    // Icon - skip for spacer
    if (!(item as any).isSpacer) {
      const iconMesh = createIconAndLabel(item, segmentCenterAngle);
      mesh.userData.iconMesh = iconMesh;
    }
  });
};

const drawIconAndLabel = (canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, item: MenuItem) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Layout calculations
  const iconSize = 200;
  const fontSize = 80;
  const padding = 20;
  const totalHeight = iconSize + padding + fontSize;
  
  // Center vertically
  const startY = (canvas.height - totalHeight) / 2;
  
  // Draw Label
  ctx.font = `${fontSize}px FlexiIBM, sans-serif`;
  ctx.fillStyle = ICON_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Draw text below icon
  ctx.fillText(item.label, canvas.width / 2, startY + iconSize + padding);
  
  // Update texture for text immediately
  texture.needsUpdate = true;

  // Load and Draw Icon
  const img = new Image();
  
  // Safer SVG processing:
  // 1. Replace currentColor with white
  let svgString = item.icon.replace(/currentColor/g, ICON_COLOR);
  
  // 2. Ensure width/height attributes exist (using viewBox size or default 24)
  if (!svgString.includes('width=')) {
    svgString = svgString.replace('<svg', '<svg width="24" height="24"');
  }
  
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const x = (canvas.width - iconSize) / 2;
    ctx.drawImage(img, x, startY, iconSize, iconSize);
    texture.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  
  img.onerror = (e) => {
    console.error('Failed to load SVG icon', e);
  };
  
  img.src = url;
};

const createIconAndLabel = (item: MenuItem, angle: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  
  const texture = new THREE.CanvasTexture(canvas);
  
  drawIconAndLabel(canvas, texture, item);

  // Increase plane size to fill the segment better
  const planeGeometry = new THREE.PlaneGeometry(140, 140);
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false
  });
  
  const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  const radius = (MENU_RADIUS_INNER + MENU_RADIUS_OUTER) / 2;
  planeMesh.position.x = Math.cos(angle) * radius;
  planeMesh.position.y = Math.sin(angle) * radius;
  planeMesh.position.z = 2;
  menuGroup.add(planeMesh);
  
  return planeMesh;
};

const onWindowResize = () => {
  if (!canvasContainer.value || !camera || !renderer) return;
  
  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  
  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
};

let inputTimer: any = null;

const getIntersectedSegment = (clientX: number, clientY: number): THREE.Mesh | null => {
  if (!canvasContainer.value) return null;
  
  const rect = canvasContainer.value.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(segments);
  
  return intersects.length > 0 ? (intersects[0].object as THREE.Mesh) : null;
};

const highlightSegment = (segment: THREE.Mesh | null) => {
  if (hoveredSegment !== segment) {
    if (hoveredSegment) {
      (hoveredSegment.material as THREE.MeshBasicMaterial).color.setHex(SEGMENT_COLOR);
    }
    hoveredSegment = segment;
    if (hoveredSegment) {
      (hoveredSegment.material as THREE.MeshBasicMaterial).color.setHex(HOVER_COLOR);
    }
  }
};

const handleInputStart = (clientX: number, clientY: number) => {
  // Safety clear existing timer
  if (inputTimer) {
    clearTimeout(inputTimer);
    clearInterval(inputTimer);
    inputTimer = null;
  }

  const segment = getIntersectedSegment(clientX, clientY);
  
  if (segment) {
    const item = segment.userData.item as MenuItem;
    
    // Skip interaction if it's a spacer
    if ((item as any).isSpacer) {
      return;
    }
    
    highlightSegment(segment);
    
    if (item.continuous) {
      // Trigger immediately
      if (item.action) item.action();
      // Start interval for continuous action
      inputTimer = setInterval(() => {
        if (item.action) item.action();
      }, 100);
    } else if (!item.hold) {
      // Trigger immediately
      if (item.action) item.action();
      if (item.route) router.push(item.route);
      // Don't hide menu for instant actions (like volume) unless it's a route change
      if (item.route) hideMenu();
    } else {
      // long-press behavior
      inputTimer = setTimeout(() => {
        if (item.action) item.action();
        if (item.route) router.push(item.route);
        hideMenu();
        highlightSegment(null);
      }, 500);
    }
  } else {
    highlightSegment(null);
    hideMenu();
  }
};

const handleInputEnd = () => {
  if (inputTimer) {
    clearTimeout(inputTimer);
    clearInterval(inputTimer);
    inputTimer = null;
  }
  highlightSegment(null);
};

const handleInputMove = (clientX: number, clientY: number) => {
  const segment = getIntersectedSegment(clientX, clientY);
  
  // If we moved off the currently hovered segment
  if (segment !== hoveredSegment) {
    if (inputTimer) {
      clearTimeout(inputTimer);
      clearInterval(inputTimer);
      inputTimer = null;
    }
    highlightSegment(null);
  }
};

// Global event handlers for drag/release outside canvas
const onGlobalMouseUp = () => {
  handleInputEnd();
};

const onGlobalTouchEnd = (event: TouchEvent) => {
  handleInputEnd();
};

const onGlobalTouchMove = (event: TouchEvent) => {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    handleInputMove(touch.clientX, touch.clientY);
  }
};

const onTouchStart = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    handleInputStart(touch.clientX, touch.clientY);
  }
};

const onMouseDown = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  handleInputStart(event.clientX, event.clientY);
};

// Keep these for cleanup, but they are less critical now that we use global listeners
const onTouchEnd = (event: TouchEvent) => {
  event.preventDefault();
  handleInputEnd();
};

const onTouchMove = (event: TouchEvent) => {
  event.preventDefault();
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    handleInputMove(touch.clientX, touch.clientY);
  }
};

const onMouseUp = (event: MouseEvent) => {
  handleInputEnd();
};

const onMouseMove = (event: MouseEvent) => {
  if (event.buttons > 0) {
    handleInputMove(event.clientX, event.clientY);
  }
};

const startAnimation = () => {
  const animate = () => {
    if (!isActive.value) return;
    animationFrameId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();
};

const stopAnimation = () => {
  cancelAnimationFrame(animationFrameId);
};

onUnmounted(() => {
  stopAnimation();
  if (inputTimer) {
    clearTimeout(inputTimer);
    clearInterval(inputTimer);
  }
  window.removeEventListener('resize', onWindowResize);
  
  // Remove global listeners just in case
  window.removeEventListener('mouseup', onGlobalMouseUp);
  window.removeEventListener('touchend', onGlobalTouchEnd);

  if (renderer) {
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
    
    renderer.dispose();
  }
});
</script>

<style scoped>
.radial-menu-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform-origin: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.content-wrapper.shrunk {
  transform: scale(0.6);
  opacity: 0.5;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 100;
}

.canvas-container.active {
  pointer-events: auto;
  opacity: 1;
}
</style>
