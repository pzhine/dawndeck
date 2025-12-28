/**
 * GestureRecognizer
 * 
 * High-level gesture abstraction layer that identifies:
 * - Horizontal drag (left or right)
 * - Vertical drag (up or down)
 * - Tap
 * - Double tap
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
}

export interface GestureRecognizerConfig {
  doubleTapMaxDelay: number;      // ms - max time between taps for double-tap
  doubleTapMaxDistance: number;   // px - max distance between taps for double-tap
  dragMinDistance: number;        // px - minimum distance to classify as drag
  dragAngleThreshold: number;     // degrees - angle threshold for horizontal vs vertical
}

const DEFAULT_CONFIG: GestureRecognizerConfig = {
  doubleTapMaxDelay: 300,
  doubleTapMaxDistance: 30,
  dragMinDistance: 15,
  dragAngleThreshold: 30, // 30 degrees from axis
};

type GestureCallback = (gesture: RecognizedGesture) => void;

interface LastTap {
  point: TouchPoint;
  timestamp: number;
}

export class GestureRecognizer {
  private config: GestureRecognizerConfig;
  private touchController: TouchController;
  private callbacks: GestureCallback[] = [];
  private lastTap: LastTap | null = null;

  constructor(element: HTMLElement, config: Partial<GestureRecognizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.touchController = new TouchController(element);
    
    // Listen to touch controller gestures
    this.touchController.onGesture(this.handleTouchGesture.bind(this));
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
   * Handle drag gesture and determine direction
   */
  private handleDrag(touchGesture: TouchGestureEvent, deltaX: number, deltaY: number): void {
    const distance = touchGesture.distance;

    // Only classify as directional drag if it exceeds minimum distance
    if (distance < this.config.dragMinDistance) {
      return; // Too small to classify
    }

    // Calculate angle from horizontal
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * (180 / Math.PI));

    // Determine if horizontal or vertical based on angle
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
      // Diagonal - we'll classify based on dominant axis
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        type = 'drag-horizontal';
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        type = 'drag-vertical';
        direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    this.emitGesture({
      type,
      startPoint: touchGesture.startPoint,
      endPoint: touchGesture.endPoint,
      path: touchGesture.path,
      distance,
      duration: touchGesture.duration,
      direction,
      deltaX,
      deltaY,
    });
  }

  /**
   * Emit a recognized gesture to all callbacks
   */
  private emitGesture(gesture: RecognizedGesture): void {
    this.callbacks.forEach(callback => callback(gesture));
  }
}
