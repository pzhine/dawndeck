/**
 * Gesture utility for handling swipe and tap gestures on touch devices
 * with noisy capacitive touch interfaces
 * 
 * Usage examples:
 * 
 * 1. Using the composable in a component:
 * ```vue
 * <script setup>
 * import { useGestures } from '@/utils/gestures';
 * 
 * const gestures = useGestures({
 *   onSwipeUp: () => console.log('Swiped up'),
 *   onSwipeDown: () => console.log('Swiped down'),
 *   onSwipeLeft: () => console.log('Swiped left'),
 *   onSwipeRight: () => console.log('Swiped right'),
 *   onTap: () => console.log('Tapped'),
 *   onDoubleTap: () => console.log('Double tapped'),
 * });
 * </script>
 * 
 * <template>
 *   <div v-bind="gestures">Content here</div>
 * </template>
 * ```
 * 
 * 2. Manual event binding:
 * ```vue
 * <script setup>
 * import { createGestureHandlers } from '@/utils/gestures';
 * 
 * const { handleTouchStart, handleTouchMove, handleTouchEnd } = createGestureHandlers({
 *   onSwipeUp: () => scrollUp(),
 * });
 * </script>
 * 
 * <template>
 *   <div 
 *     @touchstart="handleTouchStart"
 *     @touchmove="handleTouchMove"
 *     @touchend="handleTouchEnd"
 *   >
 *     Content here
 *   </div>
 * </template>
 * ```
 */

export interface GestureConfig {
  swipeThreshold?: number; // Minimum distance in pixels to trigger a swipe
  swipeVelocityThreshold?: number; // Minimum velocity (px/ms) to trigger a swipe
  tapMaxDistance?: number; // Maximum movement allowed for a tap
  tapMaxDuration?: number; // Maximum duration for a tap (ms)
  doubleTapDelay?: number; // Maximum delay between taps for double tap (ms)
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface GestureHandlers {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  lastTapTime: number;
  tapCount: number;
  isMouseDown: boolean; // Track mouse state for mouse event simulation
  lastX: number; // Track last position for continuity check
  lastY: number;
  horizontallyContinuous: boolean; // Track if touch has been continuous in X direction
  maxJumpDistance: number; // Maximum allowed jump between touch points
}

const defaultConfig: Required<GestureConfig> = {
  swipeThreshold: 50, // 50px minimum swipe distance
  swipeVelocityThreshold: 0.3, // 0.3 px/ms minimum velocity
  tapMaxDistance: 10, // 10px maximum movement for tap
  tapMaxDuration: 300, // 300ms maximum tap duration
  doubleTapDelay: 300, // 300ms between taps for double tap
};

// Maximum allowed jump between consecutive touch points (for continuity check)
// If touch position jumps more than this, it's likely a noise spike
const MAX_TOUCH_JUMP = 40; // pixels

/**
 * Create gesture event handlers for an element
 * Returns touch event handlers to be bound to the element
 */
export function createGestureHandlers(
  handlers: GestureHandlers,
  config: GestureConfig = {}
) {
  const cfg = { ...defaultConfig, ...config };
  
  const state: TouchState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    lastTapTime: 0,
    tapCount: 0,
    isMouseDown: false,
    lastX: 0,
    lastY: 0,
    horizontallyContinuous: true,
    maxJumpDistance: MAX_TOUCH_JUMP,
  };

  const processGestureStart = (x: number, y: number) => {
    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;
    state.startTime = Date.now();
    state.horizontallyContinuous = true; // Reset continuity flag
  };

  const processGestureMove = (x: number, y: number) => {
    // Check if horizontal movement is continuous (no large jumps in X direction)
    // Only check horizontal continuity since vertical scrolling can have large deltas
    if (state.horizontallyContinuous) {
      const horizontalJump = Math.abs(x - state.lastX);
      
      // If horizontal jump is too large, mark as horizontally discontinuous
      if (horizontalJump > state.maxJumpDistance) {
        state.horizontallyContinuous = false;
      }
    }
    
    // Update last position
    state.lastX = x;
    state.lastY = y;
  };

  const processGestureEnd = (x: number, y: number) => {
    const endTime = Date.now();
    const deltaX = x - state.startX;
    const deltaY = y - state.startY;
    const duration = endTime - state.startTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for tap gesture first
    if (distance <= cfg.tapMaxDistance && duration <= cfg.tapMaxDuration) {
      const timeSinceLastTap = endTime - state.lastTapTime;
      
      if (timeSinceLastTap <= cfg.doubleTapDelay) {
        state.tapCount++;
        if (state.tapCount === 2 && handlers.onDoubleTap) {
          handlers.onDoubleTap();
          state.tapCount = 0; // Reset after double tap
          return;
        }
      } else {
        state.tapCount = 1;
      }
      
      state.lastTapTime = endTime;
      
      // Delay single tap to check for double tap
      if (handlers.onTap) {
        setTimeout(() => {
          if (state.tapCount === 1) {
            handlers.onTap?.();
            state.tapCount = 0;
          }
        }, cfg.doubleTapDelay);
      }
      
      return;
    }

    // Check for swipe gesture
    const velocity = distance / duration;
    
    if (distance >= cfg.swipeThreshold && velocity >= cfg.swipeVelocityThreshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      // Determine primary direction
      if (absX > absY) {
        // Horizontal swipe - MUST be continuous to prevent noise-induced false positives
        if (state.horizontallyContinuous) {
          if (deltaX > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (deltaX < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        }
      } else {
        // Vertical swipe - allow even if not continuous (for scrolling)
        if (deltaY > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        } else if (deltaY < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        }
      }
    }
  };

  // Touch event handlers
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    processGestureStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    processGestureMove(touch.clientX, touch.clientY);
    
    // Prevent default to avoid browser gestures
    e.preventDefault();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    processGestureEnd(touch.clientX, touch.clientY);
  };

  // Mouse event handlers (for development/testing)
  const handleMouseDown = (e: MouseEvent) => {
    state.isMouseDown = true;
    processGestureStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (state.isMouseDown) {
      processGestureMove(e.clientX, e.clientY);
      e.preventDefault();
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!state.isMouseDown) return;
    state.isMouseDown = false;
    processGestureEnd(e.clientX, e.clientY);
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
  };
}

/**
 * Vue composable for gesture handling
 * Returns refs and handlers to be used in Vue components
 */
export function useGestures(handlers: GestureHandlers, config: GestureConfig = {}) {
  const gestureHandlers = createGestureHandlers(handlers, config);
  
  return {
    onTouchstart: gestureHandlers.handleTouchStart,
    onTouchmove: gestureHandlers.handleTouchMove,
    onTouchend: gestureHandlers.handleTouchEnd,
    onMousedown: gestureHandlers.handleMouseDown,
    onMousemove: gestureHandlers.handleMouseMove,
    onMouseup: gestureHandlers.handleMouseUp,
  };
}

/**
 * Create directive-style gesture handlers
 * This allows using v-gesture directive in templates
 */
export function createGestureDirective() {
  return {
    mounted(el: HTMLElement, binding: any) {
      const handlers = binding.value;
      const config = binding.modifiers;
      
      const gestureHandlers = createGestureHandlers(handlers, config);
      
      el.addEventListener('touchstart', gestureHandlers.handleTouchStart);
      el.addEventListener('touchmove', gestureHandlers.handleTouchMove);
      el.addEventListener('touchend', gestureHandlers.handleTouchEnd);
      el.addEventListener('mousedown', gestureHandlers.handleMouseDown);
      el.addEventListener('mousemove', gestureHandlers.handleMouseMove);
      el.addEventListener('mouseup', gestureHandlers.handleMouseUp);
      
      // Store handlers for cleanup
      (el as any)._gestureHandlers = gestureHandlers;
    },
    unmounted(el: HTMLElement) {
      const gestureHandlers = (el as any)._gestureHandlers;
      if (gestureHandlers) {
        el.removeEventListener('touchstart', gestureHandlers.handleTouchStart);
        el.removeEventListener('touchmove', gestureHandlers.handleTouchMove);
        el.removeEventListener('touchend', gestureHandlers.handleTouchEnd);
        el.removeEventListener('mousedown', gestureHandlers.handleMouseDown);
        el.removeEventListener('mousemove', gestureHandlers.handleMouseMove);
        el.removeEventListener('mouseup', gestureHandlers.handleMouseUp);
        delete (el as any)._gestureHandlers;
      }
    },
  };
}
