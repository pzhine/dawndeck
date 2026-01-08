import { AlarmSound } from '../../types/sound';
import { useAppStore } from '../stores/appState';

export interface SoundInfo extends AlarmSound {
  currentTime?: number;
  soundId?: number; // The Freesound ID to fetch analysis data
}

// Global audio element for persistent playback
let globalAudioElement: HTMLAudioElement | null = null;
let currentSoundInfo: SoundInfo | null = null;
let mockVolume = 1; // Default mock volume
let onSoundEndedCallback: (() => void) | null = null; // Callback for when a sound ends

// Play a preview of a sound
export function playPreview(previewUrl: string): HTMLAudioElement {
  const audio = new Audio(previewUrl);
  audio.play();
  return audio;
}

// Play audio without normalization
function playNonNormalized(soundInfo: SoundInfo, loop: boolean = false, autoplay: boolean = true): void {
  if (!globalAudioElement) return;

  // Configure volume
  if (
    process.env.NODE_ENV === 'development' &&
    useAppStore().config?.dev.mockSystemAudio
  ) {
    globalAudioElement.volume = mockVolume;
  } else {
    globalAudioElement.volume = 1;
  }

  // Set the current time if provided and valid
  if (soundInfo.currentTime !== undefined) {
    try {
      const time = Number(soundInfo.currentTime);
      if (!isNaN(time) && isFinite(time) && time >= 0) {
        globalAudioElement.currentTime = time;
      } else {
        console.warn(
          'Invalid currentTime provided to playGlobalSound:',
          soundInfo.currentTime
        );
      }
    } catch (error) {
      console.error('Error setting currentTime:', error);
    }
  }

  // Set loop based on parameter
  globalAudioElement.loop = loop;
  
  // Add ended event listener if not looping
  if (!loop) {
    globalAudioElement.addEventListener('ended', () => {
      console.log('Sound ended, calling callback');
      if (onSoundEndedCallback) {
        onSoundEndedCallback();
      }
    }, { once: true });
  }
  
  if (autoplay) {
    globalAudioElement.play();
  }
}

// Play a sound globally so it persists across component navigation
export async function playGlobalSound(
  soundInfo: SoundInfo,
  loop: boolean = false,
  autoplay: boolean = true,
): Promise<void> {
  // Stop any currently playing sound
  if (globalAudioElement) {
    stopGlobalSound();
  }

  // Store sound info
  currentSoundInfo = soundInfo;

  // Create audio element
  globalAudioElement = new Audio();
  globalAudioElement.crossOrigin = 'anonymous'; // Allow cross-origin requests

  globalAudioElement.src = soundInfo.previewUrl;   
  playNonNormalized(soundInfo, loop, autoplay);

  return;
}

// Stop playing the global sound
export function stopGlobalSound(): void {
  if (globalAudioElement) {
    globalAudioElement.pause();
    globalAudioElement.currentTime = 0;

    // Clean up audio element
    globalAudioElement.src = '';
    try {
      globalAudioElement.load(); // This helps release resources
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
  
  globalAudioElement = null;
  currentSoundInfo = null;
}

// Pause the global sound
export function pauseGlobalSound(): void {
  if (globalAudioElement && !globalAudioElement.paused) {
    globalAudioElement.pause();
  }
}

// Resume the global sound
export function resumeGlobalSound(): void {
  if (globalAudioElement && globalAudioElement.paused) {
    globalAudioElement.play().catch(error => {
      console.error('Failed to resume audio:', error);
    });
  }
}

// Check if global sound is paused
export function isGlobalSoundPaused(): boolean {
  return globalAudioElement !== null && globalAudioElement.paused;
}

// Check if global sound is looping
export function isGlobalSoundLooping(): boolean {
  return globalAudioElement !== null && globalAudioElement.loop;
}

// Set loop state for global sound
export function setGlobalSoundLoop(loop: boolean): void {
  if (globalAudioElement) {
    globalAudioElement.loop = loop;
    
    // If we're enabling loop, we should remove the 'ended' listener that advances the playlist
    // But since the listener is added with { once: true }, we can't easily remove specific ones
    // However, if loop is true, the 'ended' event doesn't fire on most browsers
    
    // If we are disabling loop, we might need to re-add the ended listener if it's missing,
    // but typically we toggle this for "single track repeat" vs "playlist advance"
  }
}

// Set callback for when a sound ends (non-looping sounds only)
export function setOnSoundEndedCallback(callback: (() => void) | null): void {
  onSoundEndedCallback = callback;
}

// Check if a sound is currently playing
export function isGlobalSoundPlaying(): boolean {
  return globalAudioElement !== null;
}

// Check if bluetooth audio is playing
export async function getBluetoothStatus(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    try {
      const result = await window.ipcRenderer.invoke('bluetooth-media:get-metadata');
      // console.log('Bluetooth metadata:', result);
      return result?.metadata?.status === 'playing';
    } catch (error) {
      console.warn('Failed to get bluetooth status:', error);
      return false;
    }
  }
  return false;
}

// Get current playing sound info
export function getCurrentSoundInfo(): SoundInfo | null {
  if (!globalAudioElement || !currentSoundInfo) {
    return null;
  }

  // Update the current time
  return {
    ...currentSoundInfo,
    currentTime: globalAudioElement.currentTime,
  };
}

// Set the volume of the global audio. Normally, this shouldn't be called directly from a page
// or component, but rather through the appState.setVolume method.
export function setGlobalVolume(volume: number): void {
  // console.log('Setting global volume to:', volume);
  const clampedVolume = Math.max(0, Math.min(volume, 1)); // Clamp between 0-1
  if (
    process.env.NODE_ENV === 'development' &&
    useAppStore().config.dev.mockSystemAudio
  ) {
    // console.log('Setting client volume to:', volume);
    mockVolume = clampedVolume;
    if (globalAudioElement) {
      globalAudioElement.volume = clampedVolume;
    }
    return;
  }
  // Update the system volume using general invoke method
  window.ipcRenderer
    .invoke('set-system-volume', clampedVolume * 100)
    .catch((error) => {
      console.error('Failed to set system volume:', error);
    });
}

// Stop playing a preview
export function stopPreview(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
}
