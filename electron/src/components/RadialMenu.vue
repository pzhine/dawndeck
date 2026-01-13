<template>
  <div class="radial-menu-container">
    <div 
      class="content-wrapper" 
      :class="{ 'shrunk': isActive && !pinned, 'pinned': pinned }" 
      @touchstart="!pinned && !justClosed && activateMenu()" 
      @click="!pinned && !justClosed && activateMenu()"
    >
      <slot></slot>
    </div>
    <div ref="canvasContainer" class="canvas-container" :class="{ 'active': isActive || pinned }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, PropType, watch, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as THREE from 'three';

export interface MenuItem {
  label: string;
  icon: string; // SVG string
  route?: string;
  action?: () => void;
  hold?: boolean; // If true, action triggers after a brief hold (long press)
  quickAction?: () => void; // If hold is true, this fires on short tap
  continuous?: boolean; // If true, action triggers repeatedly while holding
  active?: boolean; // If true, icon is colored yellow
}

const props = defineProps({
  items: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  upperItems: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  lowerItems: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  skipPositions: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
  minPositions: {
    type: Number,
    default: 6,
  },
  width: {
    type: [String, Number] as PropType<'wide' | 'narrow' | number>,
    default: 'wide',
  },
  // layout prop removed
  pinned: {
    type: Boolean,
    default: false,
  },
  onShow: {
    type: Function as PropType<() => void>,
    default: undefined,
  },
});

const router = useRouter();

// Compute ring dimensions based on width prop (ring thickness)
const ringWidth = computed(() => {
  if (typeof props.width === 'number') {
    return props.width;
  }
  return props.width === 'narrow' ? 70 : 140;
});

const MENU_RADIUS_OUTER = 380;
const menuRadiusInner = computed(() => MENU_RADIUS_OUTER - ringWidth.value);

const isNarrow = computed(() => ringWidth.value <= 70);

// Helper to process items for a layout
const processItemsForLayout = (
  rawItems: MenuItem[], 
  type: 'full' | 'upper' | 'lower'
) => {
  const positions: (MenuItem & { isSpacer?: boolean })[] = [];
  let itemIndex = 0;
  let positionIndex = 0;
  
  // Only enforce minPositions for full layout
  const enforceMinPositions = type === 'full';
  
  while (itemIndex < rawItems.length || (enforceMinPositions && positionIndex < props.minPositions)) {
    if (props.skipPositions.includes(positionIndex)) {
      // Create an empty spacer at this position
      // For now, only 'full' layout likely uses skipPositions efficiently, but we support it for all
      positions.push({ label: '', icon: '', isSpacer: true });
    } else if (itemIndex < rawItems.length) {
      positions.push(rawItems[itemIndex]);
      itemIndex++;
    } else {
      positions.push({ label: '', icon: '', isSpacer: true });
    }
    positionIndex++;
  }
  
  return positions;
};

// Create groups based on active props
const menuGroups = computed(() => {
  const groups: { type: 'full' | 'upper' | 'lower', items: (MenuItem & { isSpacer?: boolean })[] }[] = [];
  
  if (props.items.length > 0) {
    groups.push({ type: 'full', items: processItemsForLayout(props.items, 'full') });
  } else {
    // Check upper and lower
    if (props.upperItems.length > 0) {
      groups.push({ type: 'upper', items: processItemsForLayout(props.upperItems, 'upper') });
    }
    if (props.lowerItems.length > 0) {
      groups.push({ type: 'lower', items: processItemsForLayout(props.lowerItems, 'lower') });
    }
  }
  
  return groups;
});

watch(() => menuGroups.value, async (newGroups, oldGroups) => {
  if (!scene) return;

  // Preload new icons from all groups
  await preloadIcons();

  // Simple check: if number of groups changed, or lengths of items within groups changed -> redraw
  let needsRedraw = !oldGroups || newGroups.length !== oldGroups.length;
  if (!needsRedraw && oldGroups) {
    for (let i = 0; i < newGroups.length; i++) {
        if (newGroups[i].items.length !== oldGroups[i].items.length) {
            needsRedraw = true;
            break;
        }
    }
  }

  if (needsRedraw) {
    createMenuGeometry();
  } else {
    // Deep update for existing segments
    // We assume segments are pushed in order of groups -> items
    let flatIndex = 0;
    
    newGroups.forEach((group) => {
        group.items.forEach((newItem) => {
            if (flatIndex < segments.length) {
                const mesh = segments[flatIndex];
                if (mesh.userData) {
                    const oldItem = mesh.userData.item;
                    
                    // Always update the item reference
                    mesh.userData.item = newItem;

                    // Only redraw texture if label or icon changed
                    if (newItem.label !== oldItem.label || newItem.icon !== oldItem.icon || newItem.active !== oldItem.active) {
                       const iconMesh = mesh.userData.iconMesh;
                       if (iconMesh) {
                           const material = iconMesh.material as THREE.MeshBasicMaterial;
                           const texture = material.map as THREE.CanvasTexture;
                           const canvas = texture.image as HTMLCanvasElement;
                           drawIconAndLabel(canvas, texture, newItem);
                       }
                    }
                }
                flatIndex++;
            }
        });
    });
  }
}, { deep: true });

const isActive = ref(false);
const justClosed = ref(false);
const justOpened = ref(false);
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
let isInteracting = false;
const iconCache = new Map<string, HTMLImageElement>();

const GAP_ANGLE = 0.05; // Radians
let SEGMENT_COLOR = 0x111111;
let SEGMENT_OPACITY = 0.5;
let HOVER_COLOR = 0x333333;
let ICON_COLOR = '#cccccc';
let ACTIVE_ICON_COLOR = '#facc15'; // Yellow-400

const updateColors = () => {
  if (!canvasContainer.value) return;

  // Resolve Tailwind colors from CSS variables
  // We use Canvas getImageData to force the browser to convert any color format (like oklch) to RGB
  const resolveColor = (varName: string) => {
    if (!canvasContainer.value) return null;
    
    // 1. Get the computed color string
    const originalColor = canvasContainer.value.style.color;
    canvasContainer.value.style.color = `var(${varName})`;
    const computedColor = getComputedStyle(canvasContainer.value).color;
    canvasContainer.value.style.color = originalColor;

    // 2. Draw to canvas and read back RGB values
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return computedColor;
    
    ctx.fillStyle = computedColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const segmentColor = resolveColor('--color-gray-900');
  const hoverColor = resolveColor('--color-gray-800');
  const iconColor = resolveColor('--color-gray-400');
  const activeIconColor = resolveColor('--color-yellow-400');

  if (segmentColor) SEGMENT_COLOR = new THREE.Color(segmentColor).getHex();
  if (hoverColor) HOVER_COLOR = new THREE.Color(hoverColor).getHex();
  if (iconColor) ICON_COLOR = iconColor;
  if (activeIconColor) ACTIVE_ICON_COLOR = activeIconColor;
  SEGMENT_OPACITY = 0.5;
};

const preloadIcons = async () => {
  const allItems = [
    ...(props.items || []),
    ...(props.upperItems || []),
    ...(props.lowerItems || [])
  ];

  const promises = allItems.map(item => {
    const cacheKey = item.icon + (item.active ? '_active' : '');
    if (iconCache.has(cacheKey)) return Promise.resolve();
    
    return new Promise<void>((resolve) => {
      const img = new Image();
      
      const targetColor = item.active ? ACTIVE_ICON_COLOR : ICON_COLOR;
      
      // Safer SVG processing:
      // 1. Replace currentColor with white
      let svgString = item.icon.replace(/currentColor/g, targetColor);
      
      // 2. Ensure width/height attributes exist (using viewBox size or default 24)
      if (!svgString.includes('width=')) {
        svgString = svgString.replace('<svg', '<svg width="24" height="24"');
      }
      
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        iconCache.set(cacheKey, img);
        URL.revokeObjectURL(url);
        resolve();
      };
      
      img.onerror = (e) => {
        console.error('Failed to preload SVG icon', e);
        URL.revokeObjectURL(url);
        resolve();
      };
      
      img.src = url;
    });
  });
  
  await Promise.all(promises);
};

const activateMenu = () => {
  if (props.pinned) return; // Don't toggle if pinned
  isActive.value = true;
  justOpened.value = true;
  setTimeout(() => { justOpened.value = false; }, 500);
  
  startAnimation();
  props.onShow?.();
};

const hideMenu = () => {
  if (props.pinned) return; // Don't hide if pinned
  nextTick(() => {
    isActive.value = false;
    stopAnimation();
  });
};

// Initialize menu immediately if pinned
onMounted(async () => {
  // Wait for DOM to be fully ready for style computation
  await nextTick();

  // Resolve colors immediately if possible
  if (canvasContainer.value) {
    updateColors();
  }
  
  // Preload icons and fonts immediately
  const fontPromise = document.fonts.load('80px FlexiIBM');
  const iconPromise = preloadIcons();
  
  await Promise.all([fontPromise, iconPromise]);

  // Initialize Three.js immediately (invisible)
  if (!renderer && canvasContainer.value) {
    initThree();
  }

  if (props.pinned) {
    startAnimation();
  }
});

const initThree = () => {
  if (!canvasContainer.value) return;

  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;

  // Update colors if not already done
  updateColors();

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
  
  // Use capture phase on window to intercept events before they reach underlying elements
  // This allows us to "pass through" events if we don't hit a segment
  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
  window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  
  window.addEventListener('mousedown', onMouseDown, { capture: true });
  window.addEventListener('mouseup', onMouseUp, { capture: true });
  window.addEventListener('mousemove', onMouseMove, { capture: true });
};

const createMenuGeometry = () => {
  // Clear existing
  if (menuGroup) {
    scene.remove(menuGroup);
    segments = [];
  }
  
  menuGroup = new THREE.Group();
  scene.add(menuGroup);

  // Iterate over each group of items (full, upper, or lower)
  menuGroups.value.forEach(group => {
      const items = group.items;
      const count = items.length;
      const layoutType = group.type;
      
      // Calculate angle range and center based on layout
      const HORIZON_OFFSET = 20 * (Math.PI / 180);
      let totalAngle: number;
      let startSegmentCenter: number;
      let anglePerSegment: number;

      if (layoutType === 'full') {
        totalAngle = Math.PI * 2;
        anglePerSegment = totalAngle / count;
        // Clockwise starting from Top-Left (PI/2 + one segment counterclockwise)
        startSegmentCenter = (Math.PI / 2) + anglePerSegment;
      } else {
        totalAngle = Math.PI - (2 * HORIZON_OFFSET);
        anglePerSegment = totalAngle / count;
        const centerAngle = layoutType === 'lower' ? 3 * Math.PI / 2 : Math.PI / 2;
        // Center the segments around centerAngle
        startSegmentCenter = centerAngle + (totalAngle / 2) - (anglePerSegment / 2);
      }

      items.forEach((item, index) => {
        // Position segments based on layout
        const segmentCenterAngle = startSegmentCenter - (index * anglePerSegment);
        
        // RingGeometry draws counter-clockwise from thetaStart.
        // We want the segment to be centered at segmentCenterAngle.
        // So thetaStart should be segmentCenterAngle - (length/2).
        
        const lengthAngle = anglePerSegment - GAP_ANGLE;
        const startAngle = segmentCenterAngle - (lengthAngle / 2);
        const endAngle = startAngle + lengthAngle;

        const isFirstItem = index === 0;
        const isLastItem = index === count - 1;
        const isNotFull = layoutType !== 'full';

        // We want to round the CCW edge of the First Item (highest angle)
        // and the CW edge of the Last Item (lowest angle).
        const roundCCW = isNotFull && isFirstItem;
        const roundCW = isNotFull && isLastItem;
        
        const cornerRadius = 20;
        
        let geometry: THREE.BufferGeometry;

        if (roundCCW || roundCW) {
          const shape = new THREE.Shape();
          const R_in = menuRadiusInner.value;
          const R_out = MENU_RADIUS_OUTER;
          const r = cornerRadius;
          
          // Calculate angular offsets for corners
          // sin(delta) = r / (R +/- r)
          const delta_out = Math.asin(r / (R_out - r));
          const delta_in = Math.asin(r / (R_in + r));
          
          // 1. Outer Arc (CCW)
          let outerStart = startAngle;
          let outerEnd = endAngle;
          
          if (roundCW) outerStart += delta_out;
          if (roundCCW) outerEnd -= delta_out;
          
          shape.absarc(0, 0, R_out, outerStart, outerEnd, false);
          
          // 2. CCW Edge (at endAngle)
          if (roundCCW) {
            // Outer corner
            const cOut = endAngle - delta_out;
            const cxOut = (R_out - r) * Math.cos(cOut);
            const cyOut = (R_out - r) * Math.sin(cOut);
            shape.absarc(cxOut, cyOut, r, cOut, endAngle + Math.PI/2, false);
            
            // Inner corner
            const cIn = endAngle - delta_in;
            const cxIn = (R_in + r) * Math.cos(cIn);
            const cyIn = (R_in + r) * Math.sin(cIn);
            shape.absarc(cxIn, cyIn, r, endAngle + Math.PI/2, cIn + Math.PI, false);
          } else {
            shape.lineTo(R_in * Math.cos(endAngle), R_in * Math.sin(endAngle));
          }
          
          // 3. Inner Arc (CW)
          let innerStart = endAngle;
          let innerEnd = startAngle;
          
          if (roundCCW) innerStart -= delta_in;
          if (roundCW) innerEnd += delta_in;
          
          shape.absarc(0, 0, R_in, innerStart, innerEnd, true);
          
          // 4. CW Edge (at startAngle)
          if (roundCW) {
            // Inner corner
            const cIn = startAngle + delta_in;
            const cxIn = (R_in + r) * Math.cos(cIn);
            const cyIn = (R_in + r) * Math.sin(cIn);
            shape.absarc(cxIn, cyIn, r, cIn + Math.PI, startAngle - Math.PI/2, false);
            
            // Outer corner
            const cOut = startAngle + delta_out;
            const cxOut = (R_out - r) * Math.cos(cOut);
            const cyOut = (R_out - r) * Math.sin(cOut);
            shape.absarc(cxOut, cyOut, r, startAngle - Math.PI/2, cOut, false);
          }
          
          geometry = new THREE.ShapeGeometry(shape);
        } else {
          // Standard RingGeometry
          geometry = new THREE.RingGeometry(
            menuRadiusInner.value,
            MENU_RADIUS_OUTER,
            32,
            1,
            startAngle,
            lengthAngle
          );
        }

        // Material - make spacer invisible
        const material = new THREE.MeshBasicMaterial({
          color: SEGMENT_COLOR,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: (item as any).isSpacer ? 0 : SEGMENT_OPACITY,
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
  });
};

const drawIconAndLabel = (canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, item: MenuItem) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Use relative sizing for narrow menus
  const iconSize = isNarrow.value ? Math.min(ringWidth.value * 2, 200) : 200;
  const fontSize = 80;
  const padding = 20;
  const showText = !isNarrow.value;
  const totalHeight = showText ? iconSize + padding + fontSize : iconSize;
  
  // Center vertically
  const startY = (canvas.height - totalHeight) / 2;

  // Resolve color
  const targetColor = item.active ? ACTIVE_ICON_COLOR : ICON_COLOR;
  
  // Draw Label (only if not narrow)
  if (showText) {
    ctx.font = `${fontSize}px FlexiIBM, sans-serif`;
    ctx.fillStyle = targetColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Draw text below icon
    ctx.fillText(item.label, canvas.width / 2, startY + iconSize + padding);
  }
  
  // Update texture for text immediately
  texture.needsUpdate = true;

  // Check cache first
  const cacheKey = item.icon + (item.active ? '_active' : '');
  if (iconCache.has(cacheKey)) {
    const img = iconCache.get(cacheKey)!;
    const x = (canvas.width - iconSize) / 2;
    ctx.drawImage(img, x, startY, iconSize, iconSize);
    texture.needsUpdate = true;
    return;
  }

  // Cancel any pending icon load for this texture
  if ((texture as any)._pendingIconUrl) {
    URL.revokeObjectURL((texture as any)._pendingIconUrl);
    (texture as any)._pendingIconUrl = null;
  }

  // Load and Draw Icon
  const img = new Image();
  
  // Safer SVG processing:
  // 1. Replace currentColor with white
  let svgString = item.icon.replace(/currentColor/g, targetColor);
  
  // 2. Ensure width/height attributes exist (using viewBox size or default 24)
  if (!svgString.includes('width=')) {
    svgString = svgString.replace('<svg', '<svg width="24" height="24"');
  }
  
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  // Track this URL so we can cancel it if a new icon is requested
  (texture as any)._pendingIconUrl = url;

  img.onload = () => {
    // Only draw if this is still the current icon (wasn't superseded)
    if ((texture as any)._pendingIconUrl === url) {
      const x = (canvas.width - iconSize) / 2;
      ctx.drawImage(img, x, startY, iconSize, iconSize);
      texture.needsUpdate = true;
      
      // Cache it
      if (!iconCache.has(cacheKey)) {
          iconCache.set(cacheKey, img);
      }

      URL.revokeObjectURL(url);
      (texture as any)._pendingIconUrl = null;
    } else {
      // This load was superseded, just clean up
      URL.revokeObjectURL(url);
    }
  };
  
  img.onerror = (e) => {
    console.error('Failed to load SVG icon', e);
    URL.revokeObjectURL(url);
    if ((texture as any)._pendingIconUrl === url) {
      (texture as any)._pendingIconUrl = null;
    }
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
  const radius = (menuRadiusInner.value + MENU_RADIUS_OUTER) / 2;
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
  // Check if we had a timer running (hold or continuous case)
  const hadTimer = inputTimer !== null;
  
  if (inputTimer) {
    clearTimeout(inputTimer);
    clearInterval(inputTimer);
    inputTimer = null;
  }
  
  // If we had a hold timer and it was cancelled (short tap), fire quickAction
  if (hadTimer && hoveredSegment) {
    const item = hoveredSegment.userData.item as MenuItem;
    if (item.hold && item.quickAction && !item.continuous) {
      item.quickAction();
    }
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

const onTouchStart = (event: TouchEvent) => {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    const segment = getIntersectedSegment(touch.clientX, touch.clientY);
    
    if (segment) {
      isInteracting = true;
      event.preventDefault();
      event.stopPropagation();
      handleInputStart(touch.clientX, touch.clientY);
    } else {
      isInteracting = false;
      // Hide menu if active and not pinned
      if (isActive.value && !props.pinned && !justOpened.value) {
        isActive.value = false;
        justClosed.value = true;
        setTimeout(() => { justClosed.value = false; }, 500);
        stopAnimation();
        // Allow event to propagate to underlying elements
      }
    }
  }
};

const onMouseDown = (event: MouseEvent) => {
  const segment = getIntersectedSegment(event.clientX, event.clientY);
  
  if (segment) {
    isInteracting = true;
    event.preventDefault();
    event.stopPropagation();
    handleInputStart(event.clientX, event.clientY);
  } else {
    isInteracting = false;
    // Hide menu if active and not pinned
    if (isActive.value && !props.pinned && !justOpened.value) {
      isActive.value = false;
      justClosed.value = true;
      setTimeout(() => { justClosed.value = false; }, 500);
      stopAnimation();
      // Allow event to propagate to underlying elements
    }
  }
};

const onTouchEnd = (event: TouchEvent) => {
  if (isInteracting) {
    event.preventDefault();
    event.stopPropagation();
    handleInputEnd();
    isInteracting = false;
  }
};

const onTouchMove = (event: TouchEvent) => {
  if (isInteracting) {
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      handleInputMove(touch.clientX, touch.clientY);
    }
  }
};

const onMouseUp = (event: MouseEvent) => {
  if (isInteracting) {
    event.preventDefault();
    event.stopPropagation();
    handleInputEnd();
    isInteracting = false;
  }
};

const onMouseMove = (event: MouseEvent) => {
  if (isInteracting) {
    event.preventDefault();
    event.stopPropagation();
    handleInputMove(event.clientX, event.clientY);
  }
};

const startAnimation = () => {
  const animate = () => {
    if (!isActive.value && !props.pinned) return;
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
  
  window.removeEventListener('touchstart', onTouchStart, { capture: true } as any);
  window.removeEventListener('touchend', onTouchEnd, { capture: true } as any);
  window.removeEventListener('touchmove', onTouchMove, { capture: true } as any);
  
  window.removeEventListener('mousedown', onMouseDown, { capture: true } as any);
  window.removeEventListener('mouseup', onMouseUp, { capture: true } as any);
  window.removeEventListener('mousemove', onMouseMove, { capture: true } as any);

  if (renderer) {
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

.content-wrapper.pinned {
  padding: 50px;
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
  opacity: 1;
}

/* Enable pointer events only on the canvas element itself */
.canvas-container.active canvas {
  pointer-events: none !important;
}
</style>
