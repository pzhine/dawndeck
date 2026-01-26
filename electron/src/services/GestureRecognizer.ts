/**
 * GestureRecognizer
 * 
 * High-level gesture abstraction layer that identifies:
 * - Horizontal drag (left or right)
 * - Vertical drag (up or down)
 * - Tap
 * - Double tap
 * 
 * Features:
 * - Early drag recognition for immediate UI feedback
 * - Cooldown period after gestures to prevent glitchy false gestures
 * - Gesture finishes when drag stops meeting criteria
 */

import { TouchController, GestureEvent as TouchGestureEvent, TouchPoint } from './TouchController';

export type GestureType = 'tap' | 'double-tap' | 'drag-horizontal' | 'drag-vertical';
export type DragDirection = 'left' | 'right' | 'up' | 'down';

export interface RecognizedGesture {
  type: GestureType;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
  path: TouchPoint[];
  distance: number;
  duration: number;
  direction?: DragDirection;
  deltaX?: number;
  deltaY?: number;
  isActive?: boolean; // true for ongoing gestures, false for completed
}

export interface GestureRecognizerConfig {
  doubleTapMaxDelay: number;      // ms - max time between taps for double-tap
  doubleTapMaxDistance: number;   // px - max distance between taps for double-tap
  dragMinDistance: number;        // px - minimum distance to classify as drag
  dragAngleThreshold: number;     // degrees - angle threshold for horizontal vs vertical
  cooldownPeriod: number;         // ms - time to wait after touch ends before accepting new gestures
  maxVelocity: number;            // px/ms - maximum velocity before considering touch erratic
}

const DEFAULT_CONFIG: GestureRecognizerConfig = {
  doubleTapMaxDelay: 300,
  doubleTapMaxDistance: 30,
  dragMinDistance: 15,
  dragAngleThreshold: 30, // 30 degrees from axis
  cooldownPeriod: 300,
  maxVelocity: 5, // 5px per millisecond = 5000px per second
};

type GestureCallback = (gesture: RecognizedGesture) => void;

interface LastTap {
  point: TouchPoint;
  timestamp: number;
}

interface ActiveDrag {
  type: GestureType;
  direction: DragDirection;
  startPoint: TouchPoint;
  lastEmittedDistance: number;
  lastPoint: TouchPoint; // Track last point for velocity calculation
}

export class GestureRecognizer {
  private config: GestureRecognizerConfig;
  private touchController: TouchController;
  private callbacks: GestureCallback[] = [];
  private lastTap: LastTap | null = null;
  private inCooldown: boolean = false;
  private cooldownTimer: number | null = null;
  private activeDrag: ActiveDrag | null = null;
  private lastTouchEndTime: number = 0;

  constructor(element: HTMLElement, config: Partial<GestureRecognizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.touchController = new TouchController(element);
    
    // Listen to touch controller gestures
    this.touchController.onGesture(this.handleTouchGesture.bind(this));
    this.touchController.onActiveGesture(this.handleActiveGesture.bind(this));
  }

  /**
   * Register a callback for recognized gestures
   */
  public onGesture(callback: GestureCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<GestureRecognizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): GestureRecognizerConfig {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.touchController.destroy();
    this.callbacks = [];
    this.lastTap = null;
    this.activeDrag = null;
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  /**
   * Start cooldown period to prevent glitchy gestures
   */
  private startCooldown(): void {
    this.inCooldown = true;
    this.lastTouchEndTime = Date.now();
    
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
    }
    
    this.cooldownTimer = window.setTimeout(() => {
      this.inCooldown = false;
      this.cooldownTimer = null;
    }, this.config.cooldownPeriod);
  }

  /**
   * Handle active/ongoing gestures from TouchController
   */
  private handleActiveGesture(id: number, currentPoint: TouchPoint, path: TouchPoint[]): void {
    // Skip if in cooldown period
    if (this.inCooldown) {
      return;
    }

    // Only process if we have enough points
    if (path.length < 2) {
      return;
    }

    const startPoint = path[0];
    const deltaX = currentPoint.x - startPoint.x;
    const deltaY = currentPoint.y - startPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for erratic jumps if we have an active drag
    if (this.activeDrag && path.length > 1) {
      const lastPoint = this.activeDrag.lastPoint;
      const timeDelta = currentPoint.timestamp - lastPoint.timestamp;
      
      if (timeDelta > 0) {
        const distanceDelta = Math.sqrt(
          Math.pow(currentPoint.x - lastPoint.x, 2) +
          Math.pow(currentPoint.y - lastPoint.y, 2)
        );
        const velocity = distanceDelta / timeDelta;

        if (velocity > this.config.maxVelocity) {
          // Erratic jump detected - end the gesture
          console.warn(`Erratic touch detected: velocity ${velocity.toFixed(2)} px/ms exceeds threshold ${this.config.maxVelocity}`);
          this.finishActiveDrag(lastPoint, path.slice(0, -1)); // Use last good point
          this.startCooldown();
          return;
        }
      }
    }

    // Check if this qualifies as a drag
    if (distance >= this.config.dragMinDistance) {
      const { type, direction } = this.classifyDrag(deltaX, deltaY);

      // Check if this is a new drag or continuation of existing
      if (!this.activeDrag) {
        // Start new drag
        this.activeDrag = {
          type,
          direction,
          startPoint,
          lastEmittedDistance: distance,
          lastPoint: currentPoint,
        };

        // Emit initial drag gesture
        this.emitGesture({
          type,
          startPoint,
          endPoint: currentPoint,
          path,
          distance,
          duration: currentPoint.timestamp - startPoint.timestamp,
          direction,
          deltaX,
          deltaY,
          isActive: true,
        });
      } else {
        // Check if direction has changed significantly (stops meeting criteria)
        const newClassification = this.classifyDrag(deltaX, deltaY);
        
        if (newClassification.type !== this.activeDrag.type || 
            newClassification.direction !== this.activeDrag.direction) {
          // Direction changed - finish current gesture
          this.finishActiveDrag(currentPoint, path);
          
          // Start cooldown
          this.startCooldown();
        } else {
          // Continue with same drag - update last point
          this.activeDrag.lastPoint = currentPoint;
          
          // Emit update every 10px
          if (distance - this.activeDrag.lastEmittedDistance >= 10) {
            this.activeDrag.lastEmittedDistance = distance;
            
            this.emitGesture({
              type: this.activeDrag.type,
              startPoint: this.activeDrag.startPoint,
              endPoint: currentPoint,
              path,
              distance,
              duration: currentPoint.timestamp - this.activeDrag.startPoint.timestamp,
              direction: this.activeDrag.direction,
              deltaX,
              deltaY,
              isActive: true,
            });
          }
        }
      }
    }
  }

  /**
   * Finish an active drag gesture
   */
  private finishActiveDrag(endPoint: TouchPoint, path: TouchPoint[]): void {
    if (this.activeDrag) {
      const deltaX = endPoint.x - this.activeDrag.startPoint.x;
      const deltaY = endPoint.y - this.activeDrag.startPoint.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Emit final gesture
      this.emitGesture({
        type: this.activeDrag.type,
        startPoint: this.activeDrag.startPoint,
        endPoint,
        path,
        distance,
        duration: endPoint.timestamp - this.activeDrag.startPoint.timestamp,
        direction: this.activeDrag.direction,
        deltaX,
        deltaY,
        isActive: false,
      });

      this.activeDrag = null;
    }
  }

  /**
   * Classify drag direction
   */
  private classifyDrag(deltaX: number, deltaY: number): { type: GestureType; direction: DragDirection } {
    // Calculate angle from horizontal
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * (180 / Math.PI));

    let type: GestureType;
    let direction: DragDirection;

    if (angle <= this.config.dragAngleThreshold || angle >= 180 - this.config.dragAngleThreshold) {
      // Horizontal drag
      type = 'drag-horizontal';
      direction = deltaX > 0 ? 'right' : 'left';
    } else if (
      angle >= 90 - this.config.dragAngleThreshold &&
      angle <= 90 + this.config.dragAngleThreshold
    ) {
      // Vertical drag
      type = 'drag-vertical';
      direction = deltaY > 0 ? 'down' : 'up';
    } else {
      // Diagonal - classify based on dominant axis
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        type = 'drag-horizontal';
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        type = 'drag-vertical';
        direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    return { type, direction };
  }

  /**
   * Handle gestures from TouchController and classify them
   */
  private handleTouchGesture(touchGesture: TouchGestureEvent): void {
    // Ignore false touches
    if (touchGesture.type === 'false' || touchGesture.cancelled) {
      return;
    }

    const deltaX = touchGesture.endPoint.x - touchGesture.startPoint.x;
    const deltaY = touchGesture.endPoint.y - touchGesture.startPoint.y;

    if (touchGesture.type === 'tap') {
      this.handleTap(touchGesture);
    } else if (touchGesture.type === 'drag') {
      this.handleDrag(touchGesture, deltaX, deltaY);
    }
  }

  /**
   * Handle tap gesture and detect double-tap
   */
  private handleTap(touchGesture: TouchGestureEvent): void {
    // Skip if in cooldown
    if (this.inCooldown) {
      return;
    }

    const now = Date.now();
    const currentPoint = touchGesture.endPoint;

    // Check for double-tap
    if (this.lastTap) {
      const timeSinceLastTap = now - this.lastTap.timestamp;
      const distanceFromLastTap = Math.sqrt(
        Math.pow(currentPoint.x - this.lastTap.point.x, 2) +
        Math.pow(currentPoint.y - this.lastTap.point.y, 2)
      );

      if (
        timeSinceLastTap <= this.config.doubleTapMaxDelay &&
        distanceFromLastTap <= this.config.doubleTapMaxDistance
      ) {
        // Double-tap detected
        this.emitGesture({
          type: 'double-tap',
          startPoint: touchGesture.startPoint,
          endPoint: touchGesture.endPoint,
          path: touchGesture.path,
          distance: touchGesture.distance,
          duration: touchGesture.duration,
          deltaX: 0,
          deltaY: 0,
          isActive: false,
        });
        this.lastTap = null; // Reset to avoid triple-tap
        return;
      }
    }

    // Single tap
    this.emitGesture({
      type: 'tap',
      startPoint: touchGesture.startPoint,
      endPoint: touchGesture.endPoint,
      path: touchGesture.path,
      distance: touchGesture.distance,
      duration: touchGesture.duration,
      deltaX: 0,
      deltaY: 0,
      isActive: false,
    });

    // Store for potential double-tap
    this.lastTap = {
      point: currentPoint,
      timestamp: now,
    };

    // Clear last tap after delay
    setTimeout(() => {
      if (this.lastTap && this.lastTap.timestamp === now) {
        this.lastTap = null;
      }
    }, this.config.doubleTapMaxDelay);
  }

  /**
   * Handle completed drag gesture from TouchController
   */
  private handleDrag(touchGesture: TouchGestureEvent, deltaX: number, deltaY: number): void {
    // If we have an active drag, finish it
    if (this.activeDrag) {
      this.finishActiveDrag(touchGesture.endPoint, touchGesture.path);
    }

    // Start cooldown after gesture completes
    this.startCooldown();
  }

  /**
   * Emit a recognized gesture to all callbacks
   */
  private emitGesture(gesture: RecognizedGesture): void {
    this.callbacks.forEach(callback => callback(gesture));
  }
}
