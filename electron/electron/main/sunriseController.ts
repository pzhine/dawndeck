import { ipcMain } from 'electron';
import { ColorFavorite } from '../../types/state';
import { sendLEDToSerial, getState } from './stateManager';

// Store for the sunrise playback state
let isPlaying = false;
let playbackTimer: NodeJS.Timeout | null = null;
let currentDuration = 600; // Default 10 minutes in seconds
let startTime = 0;
let scheduledTimeouts: NodeJS.Timeout[] = [];

// Map strip type for lamp and projector
const STRIP_LAMP = 0;
const STRIP_PROJECTOR = 1;

/**
 * Get the preset favorites in order
 */
function getSunrisePresets(): ColorFavorite[] {
  const state = getState();
  if (!state?.ambienceFavorites) return [];

  const presetOrder = ['night', 'first-light', 'dawn', 'sunrise', 'day'];
  const presets: ColorFavorite[] = [];

  for (const id of presetOrder) {
    const preset = state.ambienceFavorites.find(
      (fav) => fav.id === id && fav.isPreset
    );
    if (preset) {
      presets.push(preset);
    }
  }

  return presets;
}

/**
 * Generate transitions between preset steps
 * @param duration Total duration in seconds
 * @param holdPercentage Percentage of each step to hold (0-100). 0% = continuous transitions, 100% = instant transitions
 */
function generateSunriseSequence(
  duration: number,
  holdPercentage: number
): Array<{
  timestamp: number;
  lamp: { warmWhite: number; pink: number; orange: number };
  projector: { color0: number; color1: number; color2: number };
  transitionDuration: number;
}> {
  const presets = getSunrisePresets();
  if (presets.length === 0) {
    console.error('[sunriseController] No preset favorites found');
    return [];
  }

  const sequence = [];
  const stepDuration = duration / presets.length; // Duration for each step in seconds
  const transitionPercentage = 1 - holdPercentage / 100;
  const transitionDuration = stepDuration * transitionPercentage; // Configurable transition time

  console.log(
    `[sunriseController] Generating sequence: ${presets.length} presets, ${stepDuration}s per step, ${transitionDuration}s transitions (${holdPercentage}% hold)`
  );

  for (let i = 0; i < presets.length; i++) {
    const currentPreset = presets[i];
    const stepStartTime = i * stepDuration;

    // Apply brightness multiplier to colors
    const lampMultiplier = currentPreset.lamp.brightness / 100;
    const projectorMultiplier = currentPreset.projector.brightness / 100;

    const lampColors = {
      warmWhite: Math.round(currentPreset.lamp.colors[0] * lampMultiplier),
      pink: Math.round(currentPreset.lamp.colors[1] * lampMultiplier),
      orange: Math.round(currentPreset.lamp.colors[2] * lampMultiplier),
    };

    const projectorColors = {
      color0: Math.round(
        currentPreset.projector.colors[0] * projectorMultiplier
      ),
      color1: Math.round(
        currentPreset.projector.colors[1] * projectorMultiplier
      ),
      color2: Math.round(
        currentPreset.projector.colors[2] * projectorMultiplier
      ),
    };

    // Transition into this step (from previous step)
    // This happens at the start of the step
    sequence.push({
      timestamp: stepStartTime,
      lamp: lampColors,
      projector: projectorColors,
      transitionDuration: transitionDuration * 1000, // Convert to ms
    });

    console.log(
      `[sunriseController] Step ${i} (${currentPreset.name}) at ${stepStartTime.toFixed(2)}s, transition ${transitionDuration.toFixed(2)}s`
    );
  }

  return sequence;
}

/**
 * Start playing back the sunrise sequence
 * @param duration The total duration in seconds
 * @param holdPercentage Percentage of each step to hold (0-100). 0% = continuous transitions, 100% = instant transitions
 */
export function startSunrise(duration: number, holdPercentage: number = 0) {
  if (isPlaying) {
    stopSunrise();
  }

  console.log(
    `[sunriseController] Starting sunrise, ${duration} seconds, ${holdPercentage}% hold`
  );

  const sequence = generateSunriseSequence(duration, holdPercentage);

  if (sequence.length === 0) {
    console.error(
      '[sunriseController] Cannot start sunrise: No sequence generated'
    );
    return;
  }

  currentDuration = duration;
  isPlaying = true;
  startTime = Date.now();
  scheduledTimeouts = [];

  // Schedule each step
  sequence.forEach((step) => {
    const timeout = setTimeout(() => {
      if (isPlaying) {
        console.log(
          `[sunriseController] Applying colors: Lamp(${step.lamp.warmWhite}, ${step.lamp.pink}, ${step.lamp.orange}), Projector(${step.projector.color0}, ${step.projector.color1}, ${step.projector.color2}), Duration: ${step.transitionDuration}ms`
        );

        // Send lamp colors
        sendLEDToSerial(
          STRIP_LAMP,
          0,
          step.lamp.orange,
          step.lamp.warmWhite,
          step.lamp.pink,
          step.transitionDuration
        );

        // Send projector colors (note: colors are reordered to match hardware mapping)
        sendLEDToSerial(
          STRIP_PROJECTOR,
          0,
          step.projector.color2,
          step.projector.color0,
          step.projector.color1,
          step.transitionDuration
        );
      }
    }, step.timestamp * 1000); // Convert to milliseconds

    scheduledTimeouts.push(timeout);
  });
}

/**
 * Stop the sunrise playback
 */
export function stopSunrise() {
  console.log('[sunriseController] Stopping sunrise');

  // Immediately reset LEDs before any other cleanup
  sendLEDToSerial(STRIP_PROJECTOR, 0, 0, 0, 0, 2000);
  sendLEDToSerial(STRIP_LAMP, 0, 0, 0, 0, 2000);

  // Set flag to prevent any further playback
  isPlaying = false;

  // Clear all scheduled timeouts
  scheduledTimeouts.forEach((timeout) => {
    try {
      clearTimeout(timeout);
    } catch (e) {
      console.error('[sunriseController] Error clearing timeout:', e);
    }
  });
  scheduledTimeouts = [];

  if (playbackTimer) {
    try {
      clearTimeout(playbackTimer);
    } catch (e) {
      console.error('[sunriseController] Error clearing playback timer:', e);
    }
    playbackTimer = null;
  }

  console.log('[sunriseController] Sunrise stopped and LEDs reset');
}

/**
 * Initialize the sunrise controller
 */
export function initSunriseController() {
  ipcMain.handle(
    'start-sunrise',
    async (_, duration: number, holdPercentage?: number) => {
      startSunrise(duration, holdPercentage);
      return true;
    }
  );

  ipcMain.handle('stop-sunrise', async () => {
    stopSunrise();
    return true;
  });

  console.log('[sunriseController] Initialized');
}
