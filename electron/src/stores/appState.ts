import { defineStore } from 'pinia';
import { debounce, throttle } from 'lodash-es';
import { AlarmSound } from '../../types/sound';
import { AppState, ColorFavorite } from '../../types/state';
import { setGlobalVolume } from '../services/audioService';
import { generateColorFavoriteName, generateColorSlug } from '../services/colorNaming';
import { mixColorsRgb } from '../services/colorUtils';
import defaultConfig from '../../config.example.json';

// Create a Pinia store for our application state
export const useAppStore = defineStore('appState', {
  state: (): AppState => ({
    volume: 50, // Default volume (0-100)
    alarmActive: false, // Alarm active state
    alarmTime: [7, 0], // Default alarm time [hours, minutes] (7:00 AM)
    screenBrightness: 80, // Default screen brightness (0-100)
    projectorBrightness: 70, // Default projector brightness (0-100)
    lampBrightness: 50, // Default lamp brightness (0-100)
    lampActive: true, // Whether the lamp is currently active
    lampColors: {
      warmWhite: 0,
      pink: 0,
      orange: 0,
    }, // Individual LED color values (0-255)
    lampPosition: undefined, // SVG coordinates for lamp color picker
    projectorActive: true, // Whether the projector is currently active
    projectorColors: {
      color0: 0,
      color1: 0,
      color2: 0,
    }, // Individual LED color values (0-255)
    projectorPosition: undefined, // SVG coordinates for projector color picker
    ambienceFavorites: [], // Array to store ambience color favorites (lamp + projector)
    timeFormat: '24h', // Default time format
    listPositions: {}, // Empty object to store list positions by route
    alarmSound: null, // Default to no alarm sound selected
    favoriteSounds: [], // Array to store favorite sounds
    lastConnectedWifi: undefined, // Last successfully connected WiFi network
    lastSoundListRoute: undefined, // Last sound list route visited
    lastCountryListRoute: undefined, // Last country list route visited
    projectorPreview: [
      { red: 0, green: 0, blue: 0, white: 0 }, // LED 0
      { red: 0, green: 0, blue: 0, white: 0 }, // LED 1
    ], // Default LED color settings for projector preview
    // Add new sunrise-related state properties
    sunriseDuration: 600, // Default: 10 minutes in seconds
    sunriseActive: false,
    sunriseBrightness: 100, // Default: 100% brightness
    config: defaultConfig,
    currentPlaylist: [], // Current playlist of sounds
    currentPlaylistIndex: -1, // Current index in the playlist
  }),

  getters: {
    // Format alarm time as a string (HH:MM) based on timeFormat preference
    formattedAlarmTime: (state): string => {
      const [hours, minutes] = state.alarmTime;

      if (state.timeFormat === '12h') {
        const isPM = hours >= 12;
        const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
      } else {
        // 24h format
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    },

    // Get list position for a specific route
    getListPosition:
      (state) =>
      (routePath: string): number => {
        return state.listPositions[routePath] ?? 0; // Default to 0 if not found
      },

    // Check if a sound is in favorites
    isSoundInFavorites:
      (state) =>
      (soundId: number): boolean => {
        return state.favoriteSounds.some((sound) => sound.id === soundId);
      },
  },

  actions: {
    // Throttled function to send current lamp state to hardware
    updateLampHardware: throttle(async function(this: any) {
      if (!this.lampActive) return;
      
      const multiplier = this.lampBrightness / 100;
      await window.ipcRenderer.invoke('set-lamp-colors', {
        warmWhite: Math.round(this.lampColors.warmWhite * multiplier),
        pink: Math.round(this.lampColors.pink * multiplier),
        orange: Math.round(this.lampColors.orange * multiplier),
      });
    }, 300),
    
    // Toggle lamp active state
    async toggleLampActive() {
      const newState = !this.lampActive;
      this.lampActive = newState;
      this.saveState();
      
      if (newState) {
        // Lamp activated - restore colors with current brightness
        const multiplier = this.lampBrightness / 100;
        await window.ipcRenderer.invoke('set-lamp-colors', {
          warmWhite: Math.round(this.lampColors.warmWhite * multiplier),
          pink: Math.round(this.lampColors.pink * multiplier),
          orange: Math.round(this.lampColors.orange * multiplier),
        });
        console.log('Lamp activated - colors restored with brightness', this.lampBrightness);
      } else {
        // Lamp deactivated - zero out all colors
        await window.ipcRenderer.invoke('set-lamp-colors', {
          warmWhite: 0,
          pink: 0,
          orange: 0,
        });
        console.log('Lamp deactivated - colors zeroed');
      }
    },
    // Save state to Electron via IPC
    saveState: debounce(function (this: any) {
      // Send the entire state to the main process
      window.ipcRenderer.invoke(
        'save-app-state',
        JSON.parse(JSON.stringify(this.$state))
      );
    }, 100),

    // Load state from Electron main process
    async loadState() {
      try {
        const savedState = await window.ipcRenderer.invoke('load-app-state');
        console.log('Loaded saved state:', savedState);
        if (savedState) {
          // Replace the entire state with the saved one
          this.$patch(savedState);
        }

        // Sync with system volume after loading state
        await this.syncWithSystemVolume();
        
        // Restore lamp state if active
        if (this.lampActive) {
          const multiplier = this.lampBrightness / 100;
          await window.ipcRenderer.invoke('set-lamp-colors', {
            warmWhite: Math.round(this.lampColors.warmWhite * multiplier),
            pink: Math.round(this.lampColors.pink * multiplier),
            orange: Math.round(this.lampColors.orange * multiplier),
          });
          console.log('Lamp state restored:', { brightness: this.lampBrightness, colors: this.lampColors });
        }
        
        // Restore projector state if active
        if (this.projectorActive) {
          const multiplier = this.projectorBrightness / 100;
          await window.ipcRenderer.invoke('set-projector-colors', {
            color0: Math.round(this.projectorColors.color0 * multiplier),
            color1: Math.round(this.projectorColors.color1 * multiplier),
            color2: Math.round(this.projectorColors.color2 * multiplier),
          });
          console.log('Projector state restored:', { brightness: this.projectorBrightness, colors: this.projectorColors });
        }
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    },

    // Sync app volume with system volume
    async syncWithSystemVolume() {
      try {
        // Get the current system volume using general invoke method
        const systemVolume =
          await window.ipcRenderer.invoke('get-system-volume');

        // Update the app state without triggering the setSystemVolume call
        this.volume = systemVolume;

        console.log(`App volume synced with system volume: ${systemVolume}%`);
      } catch (error) {
        console.error('Failed to sync with system volume:', error);
      }
    },

    // Toggle the alarm active state
    toggleAlarmActive(): void {
      this.alarmActive = !this.alarmActive;
    },

    // Set the alarm time
    setAlarmTime(hours: number, minutes: number): void {
      this.alarmTime = [hours, minutes];
    },

    // Save list position for a specific route
    saveListPosition(routePath: string, position: number): void {
      this.listPositions[routePath] = position;
    },

    // Clear saved position for a route
    clearListPosition(routePath: string): void {
      delete this.listPositions[routePath];
    },

    // Clear all saved list positions
    clearAllListPositions(): void {
      this.listPositions = {};
    },

    // Set the volume level
    setVolume(level: number): void {
      // Clamp between 0-100
      const newLevel = Math.max(0, Math.min(100, level));
      this.volume = newLevel;
      setGlobalVolume(newLevel / 100); // Convert to 0-1 range for audio service
    },

    // Set the screen brightness
    setScreenBrightness(level: number): void {
      this.screenBrightness = Math.max(0, Math.min(100, level)); // Clamp between 0-100
    },

    // Set the projector brightness
    setProjectorBrightness(level: number): void {
      this.projectorBrightness = Math.max(0, Math.min(100, level)); // Clamp between 0-100
      this.saveState();
      this.updateProjectorHardware();
    },

    // Set the lamp brightness
    setLampBrightness(level: number): void {
      this.lampBrightness = Math.max(0, Math.min(100, level)); // Clamp between 0-100
      this.saveState();
      this.updateLampHardware();
    },

    // Generic state update action
    updateState<K extends keyof AppState>(key: K, value: AppState[K]): void {
      (this as any)[key] = value;
      this.saveState();
    },

    // Set individual lamp colors (RGB values 0-255)
    setLampColors(colors: { warmWhite: number; pink: number; orange: number }, position?: { x: number; y: number }): void {
      this.lampColors = {
        warmWhite: Math.max(0, Math.min(255, colors.warmWhite)),
        pink: Math.max(0, Math.min(255, colors.pink)),
        orange: Math.max(0, Math.min(255, colors.orange)),
      };
      if (position) {
        this.lampPosition = position;
      }
      this.saveState();
      this.updateLampHardware();
    },

    // Throttled function to send current projector state to hardware
    updateProjectorHardware: throttle(async function(this: any) {
      if (!this.projectorActive) return;
      
      const multiplier = this.projectorBrightness / 100;
      await window.ipcRenderer.invoke('set-projector-colors', {
        color0: Math.round(this.projectorColors.color0 * multiplier),
        color1: Math.round(this.projectorColors.color1 * multiplier),
        color2: Math.round(this.projectorColors.color2 * multiplier),
      });
    }, 300),
    
    // Toggle projector active state
    async toggleProjectorActive() {
      const newState = !this.projectorActive;
      this.projectorActive = newState;
      this.saveState();
      
      if (newState) {
        // Projector activated - restore colors with current brightness
        const multiplier = this.projectorBrightness / 100;
        await window.ipcRenderer.invoke('set-projector-colors', {
          color0: Math.round(this.projectorColors.color0 * multiplier),
          color1: Math.round(this.projectorColors.color1 * multiplier),
          color2: Math.round(this.projectorColors.color2 * multiplier),
        });
        console.log('Projector activated - colors restored with brightness', this.projectorBrightness);
      } else {
        // Projector deactivated - zero out all colors
        await window.ipcRenderer.invoke('set-projector-colors', {
          color0: 0,
          color1: 0,
          color2: 0,
        });
        console.log('Projector deactivated - colors zeroed');
      }
    },

    // Set individual projector colors (RGB values 0-255)
    setProjectorColors(colors: { color0: number; color1: number; color2: number }, position?: { x: number; y: number }): void {
      this.projectorColors = {
        color0: Math.max(0, Math.min(255, colors.color0)),
        color1: Math.max(0, Math.min(255, colors.color1)),
        color2: Math.max(0, Math.min(255, colors.color2)),
      };
      if (position) {
        this.projectorPosition = position;
      }
      this.saveState();
      this.updateProjectorHardware();
    },

    // Set the time format
    setTimeFormat(format: '12h' | '24h'): void {
      this.timeFormat = format;
    },

    // Set the alarm sound
    setAlarmSound(sound: AlarmSound | null): void {
      this.alarmSound = sound;
    },

    // Set the last connected WiFi network
    setLastConnectedWifi(networkName: string): void {
      this.lastConnectedWifi = networkName;
    },

    // Clear the last connected WiFi network
    clearLastConnectedWifi(): void {
      this.lastConnectedWifi = undefined;
    },

    // Set the last sound list route
    setLastSoundListRoute(
      routeName: string,
      routeParams: Record<string, string>
    ): void {
      this.lastSoundListRoute = {
        name: routeName,
        params: routeParams,
      };
    },

    // Clear the last sound list route
    clearLastSoundListRoute(): void {
      this.lastSoundListRoute = undefined;
    },

    // Set the last country list route
    setLastCountryListRoute(
      routeName: string,
      routeParams: Record<string, string>
    ): void {
      this.lastCountryListRoute = {
        name: routeName,
        params: routeParams,
      };
    },

    // Clear the last country list route
    clearLastCountryListRoute(): void {
      this.lastCountryListRoute = undefined;
    },

    // Reset projector preview to default values
    resetProjectorPreview(): void {
      this.projectorPreview = [
        { red: 0, green: 0, blue: 0, white: 0 }, // LED 0
        { red: 0, green: 0, blue: 0, white: 0 }, // LED 1
      ];
    },

    // Reset all settings to default values
    resetToDefaults(): void {
      this.volume = 50;
      this.alarmTime = [7, 0];
      this.screenBrightness = 80;
      this.projectorBrightness = 70;
      this.lampBrightness = 50;
      this.timeFormat = '24h';
      this.clearAllListPositions();
      this.alarmSound = null;
      this.lastConnectedWifi = undefined;
      this.lastSoundListRoute = undefined;
      this.lastCountryListRoute = undefined;
      this.resetProjectorPreview();
    },

    // Toggle sunrise active state
    async startSunrise() {
      // First set the brightness level for the sunrise
      try {
        await window.ipcRenderer.invoke(
          'set-strip-brightness',
          this.sunriseBrightness
        );
      } catch (error) {
        console.error('Failed to set brightness:', error);
      }
      // Then start the sunrise with the current duration
      try {
        const started = await window.ipcRenderer.invoke(
          'start-sunrise',
          this.sunriseDuration
        );
        if (started) {
          this.sunriseActive = true;
        }
      } catch (error) {
        console.error('Failed to start sunrise:', error);
      }

      // When deactivating, send IPC message to stop sunrise playback
    },

    async stopSunrise() {
      try {
        await window.ipcRenderer.invoke('stop-sunrise');
      } catch (error) {
        console.error('Failed to stop sunrise:', error);
      }
    },

    // Set the sunrise brightness
    setSunriseBrightness(level: number): void {
      this.sunriseBrightness = Math.max(0, Math.min(100, level)); // Clamp between 0-100
    },

    // Add a sound to favorites
    addSoundToFavorites(sound: AlarmSound): void {
      // Check if sound already exists in favorites
      if (!this.favoriteSounds.some((favSound) => favSound.id === sound.id)) {
        // Use the $patch method for arrays to ensure reactivity
        this.favoriteSounds.push(sound);
      }
    },

    // Remove a sound from favorites
    removeSoundFromFavorites(soundId: number): void {
      // Use the $patch method for arrays to ensure reactivity
      this.favoriteSounds = this.favoriteSounds.filter(
        (sound) => sound.id !== soundId
      );
    },

    // Set the current playlist with context info
    setCurrentPlaylist(sounds: any[], currentIndex: number, context?: { category?: string; country?: string }): void {
      this.currentPlaylist = sounds.map(sound => ({
        ...sound,
        _context: context || {}
      }));
      this.currentPlaylistIndex = currentIndex;
    },

    // Clear the current playlist
    clearCurrentPlaylist(): void {
      this.currentPlaylist = [];
      this.currentPlaylistIndex = -1;
    },

    // Get current sound in playlist
    getCurrentPlaylistSound(): any | null {
      if (this.currentPlaylist.length === 0 || this.currentPlaylistIndex < 0) return null;
      return this.currentPlaylist[this.currentPlaylistIndex];
    },

    // Move to next sound in playlist and return it
    moveToNextSound(): any | null {
      if (this.currentPlaylist.length === 0) return null;
      this.currentPlaylistIndex = (this.currentPlaylistIndex + 1) % this.currentPlaylist.length;
      return this.currentPlaylist[this.currentPlaylistIndex];
    },

    // Move to previous sound in playlist and return it
    moveToPreviousSound(): any | null {
      if (this.currentPlaylist.length === 0) return null;
      this.currentPlaylistIndex = (this.currentPlaylistIndex - 1 + this.currentPlaylist.length) % this.currentPlaylist.length;
      return this.currentPlaylist[this.currentPlaylistIndex];
    },

    // Remove ambience (lamp + projector) from favorites by id
    removeAmbienceFromFavorites(id: string): void {
      this.ambienceFavorites = this.ambienceFavorites.filter(fav => fav.id !== id);
      this.saveState();
    },

    // Add current ambience (lamp + projector) to favorites
    addAmbienceToFavorites(): void {
      // Define circle colors for lamp and projector
      const lampCircleColors: [string, string, string] = ['#ffb86d', '#FF2A70', '#ff4b09'];
      const projectorCircleColors: [string, string, string] = ['#9d09ff', '#ff8409', '#0058f0'];
      
      // Mix lamp LED values with lamp circle colors
      const lampRgb = mixColorsRgb(lampCircleColors, [
        this.lampColors.warmWhite,
        this.lampColors.pink,
        this.lampColors.orange
      ]);
      
      // Mix projector LED values with projector circle colors
      const projectorRgb = mixColorsRgb(projectorCircleColors, [
        this.projectorColors.color0,
        this.projectorColors.color1,
        this.projectorColors.color2
      ]);
      
      // Pass both colors separately to generate a combined name (e.g. "Strawberry-Teal")
      const name = generateColorFavoriteName(projectorRgb, lampRgb);
      
      // Convert name to kebab-case for slug-friendly ID
      const slug = generateColorSlug(name);
      
      const favorite: ColorFavorite = {
        id: slug,
        name,
        lamp: {
          colors: [this.lampColors.warmWhite, this.lampColors.pink, this.lampColors.orange],
          position: this.lampPosition || { x: 0, y: 0 },
          brightness: this.lampBrightness,
        },
        projector: {
          colors: [this.projectorColors.color0, this.projectorColors.color1, this.projectorColors.color2],
          position: this.projectorPosition || { x: 0, y: 0 },
          brightness: this.projectorBrightness,
        },
        timestamp: Date.now(),
      };
      this.ambienceFavorites.push(favorite);
      this.saveState();
    },

    // Remove ambience favorite by id
    removeAmbienceFavorite(id: string): void {
      this.ambienceFavorites = this.ambienceFavorites.filter(fav => fav.id !== id);
      this.saveState();
    },

    // Update an existing ambience favorite with current color and brightness values
    updateAmbienceFavorite(id: string): void {
      const existingIndex = this.ambienceFavorites.findIndex(fav => fav.id === id);
      if (existingIndex === -1) return;

      // Keep the existing favorite but update colors, positions, and brightness
      const existing = this.ambienceFavorites[existingIndex];
      this.ambienceFavorites[existingIndex] = {
        ...existing,
        lamp: {
          colors: [this.lampColors.warmWhite, this.lampColors.pink, this.lampColors.orange],
          position: this.lampPosition || { x: 0, y: 0 },
          brightness: this.lampBrightness,
        },
        projector: {
          colors: [this.projectorColors.color0, this.projectorColors.color1, this.projectorColors.color2],
          position: this.projectorPosition || { x: 0, y: 0 },
          brightness: this.projectorBrightness,
        },
        timestamp: Date.now(),
      };
      this.saveState();
    },

    // Load ambience favorite (apply both lamp and projector colors/positions)
    loadAmbienceFavorite(id: string): void {
      const favorite = this.ambienceFavorites.find(fav => fav.id === id);
      if (favorite) {
        // Load lamp settings
        this.setLampColors({
          warmWhite: favorite.lamp.colors[0],
          pink: favorite.lamp.colors[1],
          orange: favorite.lamp.colors[2],
        }, favorite.lamp.position);
        this.setLampBrightness(favorite.lamp.brightness);
        
        // Load projector settings
        this.setProjectorColors({
          color0: favorite.projector.colors[0],
          color1: favorite.projector.colors[1],
          color2: favorite.projector.colors[2],
        }, favorite.projector.position);
        this.setProjectorBrightness(favorite.projector.brightness);
      }
    },
  },
});
