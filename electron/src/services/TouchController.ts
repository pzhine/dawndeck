/**
 * TouchController
 * 
 * Handles low-level touch and mouse events and reports high-level gestures (taps and drags).
 * Provides filtering and error tolerance for problematic touchscreens.
 */

export type GestureType = 'tap' | 'drag' | 'false';

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureEvent {
  id: number;
  type: GestureType;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
  path: TouchPoint[];
  distance: number;
  duration: number;
  cancelled: boolean;
}

export interface TouchControllerConfig {
  // Thresholds for gesture classification
  falseTouchDuration: number;    // ms - touches shorter than this are false
  falseTouchDistance: number;    // px - touches moving less than this with short duration are false
  tapMaxDuration: number;        // ms - taps must be shorter than this
  tapMaxDistance: number;        // px - taps must move less than this
  
  // Future filtering options
  debounceTime?: number;         // ms - minimum time between touch starts
  minTouchDuration?: number;     // ms - minimum duration to register
  smoothingWindow?: number;      // number of points to use for path smoothing
}

const DEFAULT_CONFIG: TouchControllerConfig = {
  falseTouchDuration: 50,
  falseTouchDistance: 5,
  tapMaxDuration: 300,
  tapMaxDistance: 10,
};

type GestureCallback = (gesture: GestureEvent) => void;
type ActiveGestureCallback = (id: number, currentPoint: TouchPoint, path: TouchPoint[]) => void;

interface ActiveTouch {
  id: number;
  startPoint: TouchPoint;
  currentPoint: TouchPoint;
  path: TouchPoint[];
  cancelled: boolean;
}

export class TouchController {
  private config: TouchControllerConfig;
  private element: HTMLElement;
  private activeTouches: Map<number, ActiveTouch> = new Map();
  private nextTouchId = 0;
  private mouseId = -1;
  
  // Callbacks
  private onGestureCallbacks: GestureCallback[] = [];
  private onActiveGestureCallbacks: ActiveGestureCallback[] = [];
  
  // Bound event handlers for cleanup
  private boundHandlers: {
    touchStart: (e: TouchEvent) => void;
    touchMove: (e: TouchEvent) => void;
    touchEnd: (e: TouchEvent) => void;
    touchCancel: (e: TouchEvent) => void;
    mouseDown: (e: MouseEvent) => void;
    mouseMove: (e: MouseEvent) => void;
    mouseUp: (e: MouseEvent) => void;
  };

  constructor(element: HTMLElement, config: Partial<TouchControllerConfig> = {}) {
    this.element = element;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Bind event handlers
    this.boundHandlers = {
      touchStart: this.handleTouchStart.bind(this),
      touchMove: this.handleTouchMove.bind(this),
      touchEnd: this.handleTouchEnd.bind(this),
      touchCancel: this.handleTouchCancel.bind(this),
      mouseDown: this.handleMouseDown.bind(this),
      mouseMove: this.handleMouseMove.bind(this),
      mouseUp: this.handleMouseUp.bind(this),
    };
    
    this.attach();
  }

  /**
   * Attach event listeners to the element
   */
  private attach() {
    this.element.addEventListener('touchstart', this.boundHandlers.touchStart);
    this.element.addEventListener('touchmove', this.boundHandlers.touchMove);
    this.element.addEventListener('touchend', this.boundHandlers.touchEnd);
    this.element.addEventListener('touchcancel', this.boundHandlers.touchCancel);
    this.element.addEventListener('mousedown', this.boundHandlers.mouseDown);
    this.element.addEventListener('mousemove', this.boundHandlers.mouseMove);
    this.element.addEventListener('mouseup', this.boundHandlers.mouseUp);
  }

  /**
   * Detach event listeners and cleanup
   */
  public destroy() {
    this.element.removeEventListener('touchstart', this.boundHandlers.touchStart);
    this.element.removeEventListener('touchmove', this.boundHandlers.touchMove);
    this.element.removeEventListener('touchend', this.boundHandlers.touchEnd);
    this.element.removeEventListener('touchcancel', this.boundHandlers.touchCancel);
    this.element.removeEventListener('mousedown', this.boundHandlers.mouseDown);
    this.element.removeEventListener('mousemove', this.boundHandlers.mouseMove);
    this.element.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    
    this.activeTouches.clear();
    this.onGestureCallbacks = [];
    this.onActiveGestureCallbacks = [];
  }

  /**
   * Register a callback for completed gestures
   */
  public onGesture(callback: GestureCallback) {
    this.onGestureCallbacks.push(callback);
  }

  /**
   * Register a callback for active/ongoing gestures
   */
  public onActiveGesture(callback: ActiveGestureCallback) {
    this.onActiveGestureCallbacks.push(callback);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TouchControllerConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): TouchControllerConfig {
    return { ...this.config };
  }

  /**
   * Get coordinates relative to element
   */
  private getCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Classify gesture type based on distance and duration
   */
  private classifyGesture(distance: number, duration: number): GestureType {
    // False touch: very short duration and minimal movement
    if (duration < this.config.falseTouchDuration && distance < this.config.falseTouchDistance) {
      return 'false';
    }
    
    // Tap: short duration and minimal movement
    if (duration < this.config.tapMaxDuration && distance < this.config.tapMaxDistance) {
      return 'tap';
    }
    
    // Everything else is a drag
    return 'drag';
  }

  /**
   * Emit a completed gesture event
   */
  private emitGesture(gesture: GestureEvent) {
    this.onGestureCallbacks.forEach(callback => callback(gesture));
  }

  /**
   * Emit an active gesture update
   */
  private emitActiveGesture(id: number, currentPoint: TouchPoint, path: TouchPoint[]) {
    this.onActiveGestureCallbacks.forEach(callback => callback(id, currentPoint, path));
  }

  /**
   * Start a new touch
   */
  private startTouch(id: number, x: number, y: number) {
    const point: TouchPoint = { x, y, timestamp: Date.now() };
    
    const touch: ActiveTouch = {
      id,
      startPoint: point,
      currentPoint: point,
      path: [point],
      cancelled: false,
    };
    
    this.activeTouches.set(id, touch);
    this.emitActiveGesture(id, point, [point]);
  }

  /**
   * Update an existing touch
   */
  private updateTouch(id: number, x: number, y: number) {
    const touch = this.activeTouches.get(id);
    if (!touch) return;
    
    const point: TouchPoint = { x, y, timestamp: Date.now() };
    touch.currentPoint = point;
    touch.path.push(point);
    
    this.emitActiveGesture(id, point, touch.path);
  }

  /**
   * End a touch and emit gesture event
   */
  private endTouch(id: number, x: number, y: number) {
    const touch = this.activeTouches.get(id);
    if (!touch) return;
    
    const endPoint: TouchPoint = { x, y, timestamp: Date.now() };
    touch.currentPoint = endPoint;
    touch.path.push(endPoint);
    
    const distance = this.calculateDistance(
      touch.startPoint.x,
      touch.startPoint.y,
      endPoint.x,
      endPoint.y
    );
    const duration = endPoint.timestamp - touch.startPoint.timestamp;
    const type = this.classifyGesture(distance, duration);
    
    const gesture: GestureEvent = {
      id: touch.id,
      type,
      startPoint: touch.startPoint,
      endPoint,
      path: touch.path,
      distance,
      duration,
      cancelled: touch.cancelled,
    };
    
    this.emitGesture(gesture);
    this.activeTouches.delete(id);
  }

  /**
   * Cancel a touch
   */
  private cancelTouch(id: number) {
    const touch = this.activeTouches.get(id);
    if (!touch) return;
    
    touch.cancelled = true;
    this.activeTouches.delete(id);
  }

  // Touch event handlers
  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const coords = this.getCoordinates(touch.clientX, touch.clientY);
      const id = this.nextTouchId++;
      
      this.startTouch(id, coords.x, coords.y);
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const coords = this.getCoordinates(touch.clientX, touch.clientY);
      
      // Find matching active touch by looking for touches at similar positions
      // This is a workaround since touch.identifier changes between events
      for (const [id, activeTouch] of this.activeTouches) {
        const dist = this.calculateDistance(
          activeTouch.currentPoint.x,
          activeTouch.currentPoint.y,
          coords.x,
          coords.y
        );
        // If the touch moved less than a reasonable amount, it's probably the same touch
        if (dist < 100) {
          this.updateTouch(id, coords.x, coords.y);
          break;
        }
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const coords = this.getCoordinates(touch.clientX, touch.clientY);
      
      // Find and end the matching touch
      for (const [id, activeTouch] of this.activeTouches) {
        const dist = this.calculateDistance(
          activeTouch.currentPoint.x,
          activeTouch.currentPoint.y,
          coords.x,
          coords.y
        );
        if (dist < 100) {
          this.endTouch(id, coords.x, coords.y);
          break;
        }
      }
    }
  }

  private handleTouchCancel(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const coords = this.getCoordinates(touch.clientX, touch.clientY);
      
      // Find and cancel the matching touch
      for (const [id, activeTouch] of this.activeTouches) {
        const dist = this.calculateDistance(
          activeTouch.currentPoint.x,
          activeTouch.currentPoint.y,
          coords.x,
          coords.y
        );
        if (dist < 100) {
          this.cancelTouch(id);
          break;
        }
      }
    }
  }

  // Mouse event handlers (for desktop testing)
  private handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    
    const coords = this.getCoordinates(e.clientX, e.clientY);
    this.mouseId = this.nextTouchId++;
    
    this.startTouch(this.mouseId, coords.x, coords.y);
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.mouseId === -1) return;
    
    const coords = this.getCoordinates(e.clientX, e.clientY);
    this.updateTouch(this.mouseId, coords.x, coords.y);
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.mouseId === -1) return;
    
    const coords = this.getCoordinates(e.clientX, e.clientY);
    this.endTouch(this.mouseId, coords.x, coords.y);
    this.mouseId = -1;
  }

  /**
   * Get active touches (for debugging)
   */
  public getActiveTouches(): Map<number, ActiveTouch> {
    return new Map(this.activeTouches);
  }
}
