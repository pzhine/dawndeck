/**
 * Kalman Filter for smoothing noisy touch position data
 * 
 * The Kalman filter is a recursive algorithm that estimates the true value
 * of a measurement by combining predictions with noisy observations.
 */
class KalmanFilter {
  private x: number; // Estimated state
  private p: number; // Estimation error covariance
  private q: number; // Process noise covariance
  private r: number; // Measurement noise covariance
  
  constructor(processNoise = 0.01, measurementNoise = 25, initialEstimate = 0) {
    this.x = initialEstimate;
    this.p = 1;
    this.q = processNoise; // How much we trust the process model
    this.r = measurementNoise; // How much we trust the measurements
  }
  
  /**
   * Update the filter with a new measurement and return the filtered estimate
   */
  filter(measurement: number): number {
    // Prediction step
    // (We assume the state doesn't change, so prediction = previous estimate)
    const xPredicted = this.x;
    const pPredicted = this.p + this.q;
    
    // Update step
    const k = pPredicted / (pPredicted + this.r); // Kalman gain
    this.x = xPredicted + k * (measurement - xPredicted);
    this.p = (1 - k) * pPredicted;
    
    return this.x;
  }
  
  /**
   * Reset the filter to a new state
   */
  reset(value: number) {
    this.x = value;
    this.p = 1;
  }
}

export interface ScrollHandlers {
  onScroll?: (deltaY: number, filteredY: number) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
}

export interface ScrollConfig {
  filterProcessNoise?: number; // Process noise for Kalman filter (default: 0.01)
  filterMeasurementNoise?: number; // Measurement noise for Kalman filter (default: 25)
  velocityThreshold?: number; // Minimum velocity to trigger scroll end (px/ms) (default: 0.1)
  scrollEndDelay?: number; // Delay before triggering scroll end (ms) (default: 150)
}

const defaultScrollConfig: Required<ScrollConfig> = {
  filterProcessNoise: 0.01,
  filterMeasurementNoise: 25,
  velocityThreshold: 0.1,
  scrollEndDelay: 500, // Increased delay to allow longer continuous scrolling
};

/**
 * Create filtered continuous scroll handlers
 * Uses Kalman filtering to smooth noisy touch input
 */
export function createFilteredScrollHandlers(
  handlers: ScrollHandlers,
  config: ScrollConfig = {}
) {
  const cfg = { ...defaultScrollConfig, ...config };
  
  const filterY = new KalmanFilter(cfg.filterProcessNoise, cfg.filterMeasurementNoise);
  
  let isScrolling = false;
  let lastY = 0;
  let lastFilteredY = 0;
  let lastTime = 0;
  let scrollEndTimer: number | null = null;
  let velocitySamples: number[] = [];
  const MAX_VELOCITY_SAMPLES = 5;
  
  const triggerScrollEnd = () => {
    if (isScrolling && handlers.onScrollEnd) {
      handlers.onScrollEnd();
    }
    isScrolling = false;
    velocitySamples = [];
  };
  
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    lastY = touch.clientY;
    lastFilteredY = touch.clientY;
    lastTime = Date.now();
    filterY.reset(touch.clientY);
    velocitySamples = [];
    
    // Clear any pending scroll end
    if (scrollEndTimer !== null) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
    }
    
    if (!isScrolling && handlers.onScrollStart) {
      handlers.onScrollStart();
    }
    isScrolling = true;
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    if (!isScrolling) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentTime = Date.now();
    
    // Apply Kalman filter to smooth the position
    const filteredY = filterY.filter(currentY);
    
    // Calculate delta from filtered positions
    const deltaY = lastFilteredY - filteredY;
    
    // Calculate velocity for scroll end detection
    const timeDelta = currentTime - lastTime;
    if (timeDelta > 0) {
      const velocity = Math.abs(deltaY) / timeDelta;
      velocitySamples.push(velocity);
      if (velocitySamples.length > MAX_VELOCITY_SAMPLES) {
        velocitySamples.shift();
      }
    }
    
    // Trigger scroll for any movement (removed threshold)
    if (handlers.onScroll) {
      handlers.onScroll(deltaY, filteredY);
    }
    
    lastFilteredY = filteredY;
    lastTime = currentTime;
    
    // Reset scroll end timer on movement - keep scrolling as long as touch moves
    if (scrollEndTimer !== null) {
      clearTimeout(scrollEndTimer);
    }
    scrollEndTimer = window.setTimeout(triggerScrollEnd, cfg.scrollEndDelay);
  };
  
  const handleTouchEnd = (e: TouchEvent) => {
    // Check average velocity from recent samples
    const avgVelocity = velocitySamples.length > 0
      ? velocitySamples.reduce((a, b) => a + b, 0) / velocitySamples.length
      : 0;
    
    // If velocity is very low, end scrolling immediately
    if (avgVelocity < cfg.velocityThreshold) {
      if (scrollEndTimer !== null) {
        clearTimeout(scrollEndTimer);
        scrollEndTimer = null;
      }
      triggerScrollEnd();
    } else {
      // Otherwise, let the timer handle it
      if (scrollEndTimer !== null) {
        clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = window.setTimeout(triggerScrollEnd, cfg.scrollEndDelay);
    }
  };
  
  // Mouse handlers for development
  let isMouseScrolling = false;
  
  const handleMouseDown = (e: MouseEvent) => {
    lastY = e.clientY;
    lastFilteredY = e.clientY;
    lastTime = Date.now();
    filterY.reset(e.clientY);
    velocitySamples = [];
    
    if (scrollEndTimer !== null) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
    }
    
    isMouseScrolling = true;
    if (!isScrolling && handlers.onScrollStart) {
      handlers.onScrollStart();
    }
    isScrolling = true;
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isMouseScrolling || !isScrolling) return;
    e.preventDefault();
    
    const currentY = e.clientY;
    const currentTime = Date.now();
    
    const filteredY = filterY.filter(currentY);
    const deltaY = lastFilteredY - filteredY;
    
    const timeDelta = currentTime - lastTime;
    if (timeDelta > 0) {
      const velocity = Math.abs(deltaY) / timeDelta;
      velocitySamples.push(velocity);
      if (velocitySamples.length > MAX_VELOCITY_SAMPLES) {
        velocitySamples.shift();
      }
    }
    
    // Trigger scroll for any movement (removed threshold)
    if (handlers.onScroll) {
      handlers.onScroll(deltaY, filteredY);
    }
    
    lastFilteredY = filteredY;
    lastTime = currentTime;
    
    if (scrollEndTimer !== null) {
      clearTimeout(scrollEndTimer);
    }
    scrollEndTimer = window.setTimeout(triggerScrollEnd, cfg.scrollEndDelay);
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    if (!isMouseScrolling) return;
    isMouseScrolling = false;
    
    const avgVelocity = velocitySamples.length > 0
      ? velocitySamples.reduce((a, b) => a + b, 0) / velocitySamples.length
      : 0;
    
    if (avgVelocity < cfg.velocityThreshold) {
      if (scrollEndTimer !== null) {
        clearTimeout(scrollEndTimer);
        scrollEndTimer = null;
      }
      triggerScrollEnd();
    } else {
      if (scrollEndTimer !== null) {
        clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = window.setTimeout(triggerScrollEnd, cfg.scrollEndDelay);
    }
  };
  
  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

/**
 * Vue composable for filtered scroll handling
 */
export function useFilteredScroll(handlers: ScrollHandlers, config: ScrollConfig = {}) {
  const scrollHandlers = createFilteredScrollHandlers(handlers, config);
  
  return {
    onTouchstart: scrollHandlers.handleTouchStart,
    onTouchmove: scrollHandlers.handleTouchMove,
    onTouchend: scrollHandlers.handleTouchEnd,
    onMousedown: scrollHandlers.handleMouseDown,
    onMousemove: scrollHandlers.handleMouseMove,
    onMouseup: scrollHandlers.handleMouseUp,
  };
}
