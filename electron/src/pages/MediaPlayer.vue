<template>
  <RadialMenu 
    :lowerItems="lowerMenuItems" 
    :upperItems="upperMenuItems"
    :width="'narrow'" 
    :pinned="true"
  >
    <div class="w-full h-screen flex justify-center items-center relative">
      <!-- Connected State -->
      <div v-if="displayMetadata && isConnected" class="w-full h-full flex flex-col items-center justify-center">
        <!-- Title -->
        <div class="text-center z-10 pointer-events-none mb-2 px-8">
          <div class="text-3xl font-bold tracking-widest leading-tight line-clamp-2 overflow-hidden" style="word-wrap: break-word; word-break: break-word; overflow-wrap: anywhere;">{{ displayMetadata.title || 'Unknown' }}</div>
        </div>

        <!-- Artist -->
        <div class="text-center z-10 pointer-events-none px-8">
          <div class="text-xl opacity-80">{{ displayMetadata.artist || 'Unknown Artist' }}</div>
        </div>

        <!-- Volume Bar -->
        <div class="flex items-center gap-4 z-10">
          <div class="w-6 h-6 pointer-events-none opacity-70" v-html="volumeDownIcon"></div>
          <div 
            ref="volumeBarRef"
            class="w-40 h-12 flex items-center justify-center cursor-pointer"
            @mousedown="handleVolumeInteraction"
            @mousemove="handleVolumeInteraction"
            @touchstart.prevent="handleVolumeInteraction"
            @touchmove.prevent="handleVolumeInteraction"
            @click.stop
          >
            <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden pointer-events-none">
              <div 
                class="h-full bg-gray-500 transition-all duration-100 ease-out"
                :style="{ width: `${volume}%` }"
              ></div>
            </div>
          </div>
          <div class="w-6 h-6 pointer-events-none opacity-70" v-html="volumeUpIcon"></div>
        </div>
      </div>

      <!-- Disconnected/Loading State -->
      <div v-else class="flex flex-col items-center text-center p-8">
        <!-- Loading Spinner -->
        <div class="mb-8">
          <svg class="animate-spin h-20 w-20 opacity-30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        
        <div class="mb-12">
          <div class="text-xl font-bold tracking-widest mb-2">
            {{ connectionStatus === 'connecting' ? 'CONNECTING' : 'WAITING' }}
          </div>
          <div class="text-sm opacity-70">
            {{ connectionStatus === 'connecting' ? 'Searching for device...' : 'Waiting for audio source...' }}
          </div>
        </div>
      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import feather from 'feather-icons';
import { getCurrentSoundInfo, isGlobalSoundPlaying, playGlobalSound, pauseGlobalSound, resumeGlobalSound, isGlobalSoundPaused, isGlobalSoundLooping, setGlobalSoundLoop } from '../services/audioService';
import { useAppStore } from '../stores/appState';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();

// Reactive state
const metadata = ref<any>(null);
const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>('disconnected');
const updateInterval = ref<ReturnType<typeof setInterval> | null>(null);
const volume = ref(50);
const soundInfoRefreshTrigger = ref(0); // Trigger to force computed refresh
const isLooping = ref(isGlobalSoundLooping());

// Computed property to show either global sound info or bluetooth metadata
const displayMetadata = computed(() => {
  // Access refresh trigger to make this computed reactive to manual updates
  soundInfoRefreshTrigger.value;
  
  // Check if global sound is playing
  if (isGlobalSoundPlaying()) {
    const soundInfo = getCurrentSoundInfo();
    if (soundInfo) {
      return {
        title: soundInfo.name,
        artist: soundInfo.category || 'Freesound',
        status: isGlobalSoundPaused() ? 'paused' : 'playing'
      };
    }
  }
  // Fall back to bluetooth metadata
  return metadata.value;
});

// Computed property to check if we should show connected state
const isConnected = computed(() => {
  return isGlobalSoundPlaying() || connectionStatus.value === 'connected';
});

// Icons
const volumeDownIcon = feather.icons['volume-1'].toSvg({ width: '100%', height: '100%' });
const volumeUpIcon = feather.icons['volume-2'].toSvg({ width: '100%', height: '100%' });
const nextIcon = feather.icons['skip-forward'].toSvg();
const playPauseIcon = feather.icons['play'].toSvg();
const pauseIcon = feather.icons['pause'].toSvg();
const prevIcon = feather.icons['skip-back'].toSvg();
const heartIcon = feather.icons['heart'].toSvg();
const bellIcon = feather.icons['bell'].toSvg();
const repeatIcon = feather.icons['repeat'].toSvg();
const listIcon = feather.icons['list'].toSvg();

// Upper Menu Logic
const currentGlobalSound = computed(() => {
  soundInfoRefreshTrigger.value;
  if (isGlobalSoundPlaying()) {
    return getCurrentSoundInfo();
  }
  return null;
});

const isFavorite = computed(() => {
  if (!currentGlobalSound.value) return false;
  // Ensure we check reactivity of favorites list
  appStore.favoriteSounds; 
  const id = currentGlobalSound.value.soundId || currentGlobalSound.value.id;
  return appStore.isSoundInFavorites(Number(id));
});

const isAlarmSound = computed(() => {
  if (!currentGlobalSound.value) return false;
  const alarmSound = appStore.alarmSound; 
  if (!alarmSound) return false;
  const currentId = currentGlobalSound.value.soundId || currentGlobalSound.value.id;
  return Number(alarmSound.id) === Number(currentId);
});

const toggleFavorite = () => {
  const sound = currentGlobalSound.value;
  if (!sound) return;
  
  const id = Number(sound.soundId || sound.id);
  
  if (appStore.isSoundInFavorites(id)) {
    appStore.removeSoundFromFavorites(id);
  } else {
    appStore.addSoundToFavorites({
      id: id,
      name: sound.name,
      previewUrl: sound.previewUrl,
      duration: sound.duration,
      category: sound.category || '',
      country: sound.country || '',
    });
  }
  // Force refresh
  soundInfoRefreshTrigger.value++;
};

const toggleAlarmSound = () => {
  const sound = currentGlobalSound.value;
  if (!sound) return;

  if (sound.id === appStore.alarmSound?.id) {
    // Unset alarm sound
    appStore.setAlarmSound(null);
  } else {
    // Set as alarm sound
    appStore.setAlarmSound({
      id: Number(sound.soundId || sound.id),
      name: sound.name,
      previewUrl: sound.previewUrl,
      duration: sound.duration,
    });
  }
  // Force refresh
  soundInfoRefreshTrigger.value++;
};

const upperMenuItems = computed<MenuItem[]>(() => {
  if (!currentGlobalSound.value) return [];
  
  return [
    {
       label: isFavorite.value ? 'Favorite' : 'Favorite',
       icon: heartIcon,
       action: toggleFavorite,
       active: isFavorite.value
    },
    {
       label: 'Set Alarm',
       icon: bellIcon,
       action: toggleAlarmSound,
       active: isAlarmSound.value
    }
  ];
});

// Actions
const sendCommand = async (command: string) => {
  try {
    await (window as any).electronAPI?.bluetoothMedia?.sendCommand(command);
    // Refresh metadata shortly after command
    setTimeout(refreshMetadata, 500);
  } catch (error) {
    console.error(`Failed to send command ${command}:`, error);
  }
};

// Play next sound in playlist
const playNextSound = () => {
  const nextSound = appStore.moveToNextSound();
  
  if (nextSound) {
    const context = nextSound._context || {};
    const previewUrl = nextSound.previews ? nextSound.previews['preview-hq-mp3'] : nextSound.previewUrl;
    
    playGlobalSound(
      {
        id: nextSound.id.toString(),
        name: nextSound.name,
        previewUrl: previewUrl,
        duration: nextSound.duration,
        currentTime: 0,
        category: context.category || '',
        country: context.country || '',
        soundId: nextSound.id,
      },
      false // don't loop
    );
    
    // Trigger display refresh
    soundInfoRefreshTrigger.value++;
  } else {
    console.log('No next sound available');
  }
};

// Play previous sound in playlist
const playPreviousSound = () => {
  console.log('playPreviousSound called');
  console.log('Current playlist state:', {
    playlistLength: appStore.currentPlaylist.length,
    currentIndex: appStore.currentPlaylistIndex,
  });
  
  const prevSound = appStore.moveToPreviousSound();
  console.log('Previous sound:', prevSound ? prevSound.name : 'null');
  
  if (prevSound) {
    const context = prevSound._context || {};
    const previewUrl = prevSound.previews ? prevSound.previews['preview-hq-mp3'] : prevSound.previewUrl;

    console.log('Playing previous sound:', {
      name: prevSound.name,
      id: prevSound.id,
      context,
    });
    
    playGlobalSound(
      {
        id: prevSound.id.toString(),
        name: prevSound.name,
        previewUrl: previewUrl,
        duration: prevSound.duration,
        currentTime: 0,
        category: context.category || '',
        country: context.country || '',
        soundId: prevSound.id,
      },
      false // don't loop
    );
    
    // Trigger display refresh
    soundInfoRefreshTrigger.value++;
  } else {
    console.log('No previous sound available');
  }
};

// Volume throttling
let isVolumeSyncing = false;
let pendingVolume: number | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const performSync = async () => {
  if (pendingVolume === null) return;
  
  const vol = pendingVolume;
  // Clear pending so we can detect new updates during the async call
  pendingVolume = null;
  
  isVolumeSyncing = true;
  try {
    await (window as any).electronAPI?.volumeControl?.setSystemVolume(vol);
  } catch (error) {
    console.error('Failed to set volume:', error);
  } finally {
    isVolumeSyncing = false;
    // If new updates came in, schedule next sync with a delay
    if (pendingVolume !== null) {
      syncTimer = setTimeout(() => {
        syncTimer = null;
        performSync();
      }, 150);
    }
  }
};

const volumeBarRef = ref<HTMLElement | null>(null);

const setVolume = (newVol: number) => {
  newVol = Math.max(0, Math.min(100, newVol));
  volume.value = newVol;
  
  pendingVolume = newVol;
  
  // Only start if not already syncing or waiting
  if (!isVolumeSyncing && !syncTimer) {
    performSync();
  }
};

const adjustVolume = (delta: number) => {
  setVolume(volume.value + delta);
};

const handleVolumeInteraction = (event: MouseEvent | TouchEvent) => {
  event.stopPropagation();
  if (!volumeBarRef.value) return;
  
  const rect = volumeBarRef.value.getBoundingClientRect();
  let clientX;
  
  if (window.MouseEvent && event instanceof MouseEvent) {
    clientX = event.clientX;
    // Only handle if primary button is pressed for mousemove
    if (event.type === 'mousemove' && event.buttons !== 1) return;
  } else {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
    } else {
      return;
    }
  }
  
  const x = clientX - rect.left;
  const percentage = (x / rect.width) * 100;
  setVolume(percentage);
};

const getVolume = async () => {
  try {
    const vol = await (window as any).electronAPI?.volumeControl?.getSystemVolume();
    if (vol !== undefined) {
      volume.value = vol;
    }
  } catch (error) {
    console.error('Failed to get volume:', error);
  }
};



const toggleRepeat = () => {
  const newLoopState = !isGlobalSoundLooping();
  setGlobalSoundLoop(newLoopState);
  isLooping.value = newLoopState;
};

// Check for deep link
onMounted(async () => {
  if (!route.query.backRoute) {
    router.replace({ ...route, query: { ...route.query, backRoute: '/' } });
  }

  const soundId = route.params.soundId;
  
  if (soundId) {
    let soundToLoad = null;

    // If the alarm sound is passed, load it
    if (appStore.alarmSound && String(appStore.alarmSound.id) === String(soundId)) {
       soundToLoad = appStore.alarmSound;
    } 
    // Otherwise try to find it in favorites
    else {
      const fav = appStore.favoriteSounds.find(s => String(s.id) === String(soundId));
      if (fav) {
        soundToLoad = fav;
      }
    }

    if (soundToLoad) {
       // Load but don't autoplay
       await playGlobalSound({ ...soundToLoad }, false, false);
       // Force UI update to show correct controls
       soundInfoRefreshTrigger.value++;
    }
  }
});

const backToSoundsList = () => {
  // Always navigate to Sound Categories page
  router.push({ name: 'SoundCategories' });
};

// Lower Menu Items
// Clockwise from upper left (10 o'clock):
// 10: Repeat (Index 5)
// 12: Clock (Index 0)
// 2: Sound List (Index 1)
// 4: Next (Index 2)
// 6: Play/Pause (Index 3)
// 8: Prev (Index 4)
const lowerMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'List', // Position 2 - moved here (previously Vol +)
    icon: listIcon,
    action: backToSoundsList,
  },
  { 
    label: 'Next', 
    icon: nextIcon, 
    action: () => {
      console.log('Next button clicked, isGlobalSoundPlaying:', isGlobalSoundPlaying());
      if (isGlobalSoundPlaying()) {
        playNextSound();
      } else {
        sendCommand('next');
      }
    },
  },
  { 
    label: displayMetadata.value?.status === 'playing' ? 'Pause' : 'Play', 
    icon: displayMetadata.value?.status === 'playing' ? pauseIcon : playPauseIcon, 
    action: () => {
      if (isGlobalSoundPlaying()) {
        // Handle global sound play/pause
        if (isGlobalSoundPaused()) {
          resumeGlobalSound();
        } else {
          pauseGlobalSound();
        }
        // Trigger display refresh
        soundInfoRefreshTrigger.value++;
      } else {
        // Handle bluetooth commands
        if (displayMetadata.value?.status === 'playing') {
          sendCommand('pause');
        } else {
          sendCommand('play');
        }
      }
    },
  },
  { 
    label: 'Prev', 
    icon: prevIcon, 
    action: () => {
      console.log('Previous button clicked, isGlobalSoundPlaying:', isGlobalSoundPlaying());
      if (isGlobalSoundPlaying()) {
        playPreviousSound();
      } else {
        sendCommand('previous');
      }
    },
  },
  { 
    label: 'Repeat', // Position 10 - moved here (previously Vol -)
    icon: repeatIcon, 
    action: toggleRepeat,
    active: isLooping.value
  },
]);

const refreshMetadata = async () => {
  try {
    const result = await (window as any).electronAPI?.bluetoothMedia?.getMetadata();
    if (result && result.metadata) {
      // Check if we got an error indicating no device connected
      if (result.error && result.error.includes('No Bluetooth media device connected')) {
        connectionStatus.value = 'disconnected';
        metadata.value = null;
        // Redirect if no global sound is playing
        if (!isGlobalSoundPlaying()) {
          console.log('No BT device connected and no global sound, redirecting to sound categories');
          (window as any).__skipIntermediateHistory = true;
          router.push({ name: 'SoundCategories' });
        }
      } else {
        metadata.value = result.metadata;
        connectionStatus.value = 'connected';
      }
    } else {
      connectionStatus.value = 'disconnected';
      metadata.value = null;
      // Redirect if no global sound is playing
      if (!isGlobalSoundPlaying()) {
        console.log('No metadata and no global sound, redirecting to sound categories');
        (window as any).__skipIntermediateHistory = true;
        router.push({ name: 'SoundCategories' });
      }
    }
  } catch (error) {
    console.error('Failed to get metadata:', error);
    connectionStatus.value = 'disconnected';
    metadata.value = null;
    // Redirect if no global sound is playing
    if (!isGlobalSoundPlaying()) {
      console.log('Metadata error and no global sound, redirecting to sound categories');
      (window as any).__skipIntermediateHistory = true;
      router.push({ name: 'SoundCategories' });
    }
  }
};



// Lifecycle
onMounted(() => {
  // Check if we should be on this page - redirect if no BT and no global sound
  const checkAndRedirect = () => {
    // Don't redirect if BT is connected or global sound is playing
    if (!isGlobalSoundPlaying() && connectionStatus.value === 'disconnected' && !metadata.value) {
      console.log('No audio playing, redirecting to sound categories');
      // Set flag to tell BackButton to skip intermediate history entry
      (window as any).__skipIntermediateHistory = true;
      router.push({ name: 'SoundCategories' });
    }
  };
  
  // Listen for sound changes from global auto-advance
  window.addEventListener('sound-changed', () => {
    console.log('Sound changed event received, refreshing display');
    soundInfoRefreshTrigger.value++;
  });
  
  // Initial load
  refreshMetadata();
  getVolume();
  
  // Check after giving time for metadata to load
  setTimeout(checkAndRedirect, 500);
  
  // Set up periodic updates
  updateInterval.value = setInterval(refreshMetadata, 2000);
  
  // Listen for metadata updates from main process
  if ((window as any).electronAPI?.bluetoothMedia?.onMetadataUpdate) {
    (window as any).electronAPI.bluetoothMedia.onMetadataUpdate((newMetadata: any) => {
      if (newMetadata) {
        metadata.value = newMetadata;
        connectionStatus.value = 'connected';
      } else {
        metadata.value = null;
        connectionStatus.value = 'disconnected';
      }
    });
  }
  
  // Listen for connection changes from main process
  if ((window as any).electronAPI?.bluetoothMedia?.onConnectionChange) {
    (window as any).electronAPI.bluetoothMedia.onConnectionChange((status: 'connected' | 'disconnected') => {
      connectionStatus.value = status;
      if (status === 'disconnected') {
        metadata.value = null;
        // Redirect to sound categories if BT disconnects while on this page
        if (!isGlobalSoundPlaying()) {
          console.log('BT disconnected and no global sound playing, redirecting to sound categories');
          // Set flag to tell BackButton to skip intermediate history entry
          (window as any).__skipIntermediateHistory = true;
          router.push({ name: 'SoundCategories' });
        }
      }
    });
  }
  
  // Also listen via ipcRenderer for connection changes (from menu toggle)
  if (window.ipcRenderer) {
    window.ipcRenderer.on('bluetooth-media:connection-changed', (_event: any, status: string) => {
      console.log('BT connection changed via IPC:', status);
      connectionStatus.value = status as 'connected' | 'disconnected';
      if (status === 'disconnected') {
        metadata.value = null;
        // Redirect to sound categories if BT disconnects while on this page
        if (!isGlobalSoundPlaying()) {
          console.log('BT disconnected and no global sound playing, redirecting to sound categories');
          // Set flag to tell BackButton to skip intermediate history entry
          (window as any).__skipIntermediateHistory = true;
          router.push({ name: 'SoundCategories' });
        }
      }
    });
  }
  

});

onBeforeUnmount(() => {
  // Remove sound-changed listener
  window.removeEventListener('sound-changed', () => {
    soundInfoRefreshTrigger.value++;
  });
  
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  
  // Clean up event listeners
  if ((window as any).electronAPI?.bluetoothMedia?.removeMetadataListener) {
    (window as any).electronAPI.bluetoothMedia.removeMetadataListener();
  }
  if ((window as any).electronAPI?.bluetoothMedia?.removeConnectionListener) {
    (window as any).electronAPI.bluetoothMedia.removeConnectionListener();
  }
});
</script>

<style scoped>
</style>