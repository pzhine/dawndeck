import { ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { AppState } from '../../types/state';
import { sendMessage } from './serial';
import { getConfig } from './configManager';

// Define the file path for storing application state
const STATE_FILE_PATH = path.join(app.getPath('userData'), 'app-state.json');

// State cache to avoid unnecessary file reads
let stateCache: AppState | null = null;

// Strip identifiers matching Arduino constants
const STRIP_LAMP = 0;
const STRIP_PROJECTOR = 1;

/**
 * Get current application state
 * @returns The current application state
 */
export function getState(): AppState | null {
  if (stateCache) {
    return stateCache;
  }

  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const stateJson = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      stateCache = JSON.parse(stateJson);

      // Always include the latest config when returning state
      if (stateCache) {
        try {
          stateCache.config = getConfig();
        } catch (error) {
          console.error('Failed to include config in state:', error);
        }
      }

      return stateCache;
    }
  } catch (error) {
    console.error('Error reading state file:', error);
  }

  return null;
}

/**
 * Save application state to disk
 * @param state The state to save
 * @returns Promise resolving to true if successful, false otherwise
 */
export function saveState(state: AppState): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Remove the config before saving to disk - we don't want to persist it
      // as it's managed separately by configManager
      const stateToPersist = { ...state };
      delete stateToPersist.config;

      const stateJson = JSON.stringify(stateToPersist, null, 2);
      fs.writeFileSync(STATE_FILE_PATH, stateJson);

      // Keep config in memory cache, but don't persist it to disk
      stateCache = { ...stateToPersist, config: state.config };
      resolve(true);
    } catch (error) {
      console.error('Error saving app state:', error);
      resolve(false);
    }
  });
}

/**
 * Update a specific property in the state
 * @param key The key to update
 * @param value The new value
 * @returns Promise resolving to true if successful, false otherwise
 */
export function updateState<K extends keyof AppState>(
  key: K,
  value: AppState[K]
): Promise<boolean> {
  const currentState = getState() || ({} as AppState);
  currentState[key] = value;
  return saveState(currentState);
}

// Handler for saving app state to file
ipcMain.handle('save-app-state', async (_, state: AppState) => {
  return saveState(state);
});

// Handler for loading app state from file
ipcMain.handle('load-app-state', async () => {
  return getState();
});

// Handler for updating a specific state property
ipcMain.handle(
  'update-app-state',
  async (_, key: keyof AppState, value: any) => {
    console.log(`[stateManager] Updating state: ${key} = ${value}`);
    return updateState(key, value);
  }
);

export function initStateManagement() {
  console.log('State management initialized');
  console.log('State file will be saved at:', STATE_FILE_PATH);

  // Check for initial lamp brightness setting
  const initialState = getState();

  // Add config to the state if not there already
  try {
    if (initialState) {
      const configData = getConfig();
      if (configData) {
        updateState('config', configData);
      }
    }
  } catch (error) {
    console.error('Failed to add config to state:', error);
  }
}

/**
 * Sends a LERP_LED command to control an LED with support for -1 values
 * @param stripId The strip ID
 * @param pixel The pixel index
 * @param red Red value (0-255, or -1 for no change)
 * @param green Green value (0-255, or -1 for no change)
 * @param blue Blue value (0-255, or -1 for no change)
 * @param white White value (0-255, or -1 for no change)
 * @param duration Transition duration in milliseconds
 */
export function sendLEDToSerial(
  stripId: number,
  pixel: number,
  red: number,
  green: number,
  blue: number,
  duration: number
) {
  // Format for LERP_LED: stripId, pixel, r, g, b, w, duration
  const command = `LERP_LED ${stripId} ${pixel} ${red} ${green} ${blue} ${duration}`;

  console.log(`[stateManager] Sending LED command: ${command}`);
  sendMessage(command);
}

// Handler for setting lamp colors (3 separate LEDs/pixels)
ipcMain.handle(
  'set-lamp-colors',
  async (
    _,
    colors: { warmWhite: number; pink: number; orange: number }
  ) => {
    // Ensure values are within valid range (0-255)
    const warmWhite = Math.max(0, Math.min(255, colors.warmWhite));
    const pink = Math.max(0, Math.min(255, colors.pink));
    const orange = Math.max(0, Math.min(255, colors.orange));

    console.log('[stateManager] Setting lamp colors:', { warmWhite, pink, orange });

    // Send each color to its corresponding pixel
    // Pixel 0: Orange LED
    // Pixel 1: Warm White LED
    // Pixel 2: Pink LED
    
    sendLEDToSerial(STRIP_LAMP, 0, orange, warmWhite, pink, 100);

    return true;
  }
);

// Handler for setting projector colors (3 separate LEDs/pixels)
ipcMain.handle(
  'set-projector-colors',
  async (
    _,
    colors: { color0: number; color1: number; color2: number }
  ) => {
    // Ensure values are within valid range (0-255)
    const color0 = Math.max(0, Math.min(255, colors.color0));
    const color1 = Math.max(0, Math.min(255, colors.color1));
    const color2 = Math.max(0, Math.min(255, colors.color2));

    console.log('[stateManager] Setting projector colors:', { color0, color1, color2 });

    // Send to strip 1 (projector)
    // Pixel 0: color2
    // Pixel 1: color0
    // Pixel 2: color1
    
    sendLEDToSerial(STRIP_PROJECTOR, 0, color2, color0, color1, 100);

    return true;
  }
);

