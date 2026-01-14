import { AlarmSound } from './sound';

// Define the type for our alarm time tuple [hours, minutes]
export type AlarmTime = [number, number];

// Define the interface for list positions by route
export interface ListPositions {
  [routePath: string]: number;
}

// Define a type for LED RGBW values
export interface RGBW {
  red: number;
  green: number;
  blue: number;
  white: number;
}

// Define the interface for sunrise step
export interface SunriseStep {
  strip: string;
  pixel: number;
  red: number;
  green: number;
  blue: number;
  white: number;
  startAt: number;
  duration: number;
}

// Define the interface for color favorites
export interface ColorFavorite {
  id: string;
  name: string;
  isPreset?: boolean; // True for sunrise presets that can be edited but not deleted
  lamp: {
    colors: [number, number, number]; // RGB values 0-255
    position: { x: number; y: number };
    brightness: number;
  };
  projector: {
    colors: [number, number, number]; // RGB values 0-255
    position: { x: number; y: number };
    brightness: number;
  };
  timestamp: number;
}

// Define the interface for application configuration
export interface AppConfig {
  freesound: {
    clientId: string;
    apiKey: string;
  };
  openWeather: {
    apiKey: string;
  };
  autoUpdate: {
    updateUrl: string;
    checkInterval: number;
    githubRepo: string;
    buildScript: string;
    installDir?: string;
    relativeReleaseDir?: string;
  };
  arduino: {
    cliPath: string;
    boardType: string;
    port: string;
  };
  dev: {
    mockSerial: boolean;
    mockSystemAudio: boolean;
  };
}

// Define the interface for our app state
export interface AppState {
  volume: number;
  alarmActive: boolean;
  alarmTime: AlarmTime;
  screenBrightness: number;
  projectorBrightness: number;
  lampBrightness: number;
  lampActive: boolean; // Whether the lamp is currently active
  lampColors: {
    warmWhite: number; // 0-255
    pink: number; // 0-255
    orange: number; // 0-255
  };
  lampPosition?: { x: number; y: number }; // SVG coordinates for lamp color picker
  projectorActive: boolean; // Whether the projector is currently active
  projectorColors: {
    color0: number; // 0-255
    color1: number; // 0-255
    color2: number; // 0-255
  };
  projectorPosition?: { x: number; y: number }; // SVG coordinates for projector color picker
  ambienceFavorites: ColorFavorite[]; // Array of ambience color favorites (lamp + projector)
  timeFormat: '12h' | '24h'; // Add time format preference
  listPositions: ListPositions; // Store InteractiveList positions by route
  alarmSound: AlarmSound | null;
  favoriteSounds: AlarmSound[]; // Array to store favorite sounds
  lastConnectedWifi?: string; // Store the last successfully connected WiFi network name
  lastBuildResult?: {
    success: boolean;
    message: string;
    releasePath?: string;
  };
  lastSoundListRoute?: {
    name: string;
    params: Record<string, string>;
  }; // Store the last sound list route and params
  lastCountryListRoute?: {
    name: string;
    params: Record<string, string>;
  }; // Store the last country list route and params
  projectorPreview: RGBW[]; // Store LED color settings as an array of RGBW values
  sunriseDuration: number;
  sunriseActive: boolean;
  sunriseBrightness: number; // Global brightness for sunrise (0-100)
  alarmVolume: number; // Volume to use for alarm sound during sunrise (0-100)
  config: AppConfig; // Application configuration from main process
  currentPlaylist: any[]; // Current playlist of sounds
  currentPlaylistIndex: number; // Current index in the playlist
}

export type UpdateStatus =
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'error'
  | 'not-available';
