<template>
  <RadialMenu 
    :items="menuItems" 
    :width="'narrow'" 
    :layout="'lower'" 
    :pinned="true"
  >
    <div class="w-full h-screen flex justify-center items-center relative">
      <!-- Connected State -->
      <div v-if="metadata && connectionStatus === 'connected'" class="w-full h-full flex flex-col items-center justify-center">
        <!-- Title -->
        <div class="text-center z-10 pointer-events-none mb-2 px-8">
          <div class="text-3xl font-bold tracking-widest leading-tight line-clamp-2">{{ metadata.title || 'Unknown' }}</div>
        </div>

        <!-- Artist -->
        <div class="text-center z-10 pointer-events-none px-8">
          <div class="text-xl opacity-80">{{ metadata.artist || 'Unknown Artist' }}</div>
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

      <!-- Disconnected State -->
      <div v-else class="flex flex-col items-center text-center p-8">
        <div class="opacity-30 mb-8">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
          </svg>
        </div>
        
        <div class="mb-12">
          <div class="text-xl font-bold tracking-widest mb-2">{{ connectionStatus.toUpperCase() }}</div>
          <div class="text-sm opacity-70">
            {{ connectionStatus === 'connecting' ? 'Searching for device...' : 'No device connected' }}
          </div>
        </div>
      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import feather from 'feather-icons';

const router = useRouter();

// Reactive state
const metadata = ref<any>(null);
const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>('disconnected');
const updateInterval = ref<ReturnType<typeof setInterval> | null>(null);
const volume = ref(50);

// Icons
const volumeDownIcon = feather.icons['volume-1'].toSvg({ width: '100%', height: '100%' });
const volumeUpIcon = feather.icons['volume-2'].toSvg({ width: '100%', height: '100%' });
const nextIcon = feather.icons['skip-forward'].toSvg();
const playPauseIcon = feather.icons['play'].toSvg();
const pauseIcon = feather.icons['pause'].toSvg();
const prevIcon = feather.icons['skip-back'].toSvg();

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

// Menu Items
// Clockwise from upper left (10 o'clock):
// 10: Vol Down (Index 5)
// 12: Clock (Index 0)
// 2: Vol Up (Index 1)
// 4: Next (Index 2)
// 6: Play/Pause (Index 3)
// 8: Prev (Index 4)
const menuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Vol +', 
    icon: volumeUpIcon, 
    action: () => adjustVolume(2),
    continuous: true
  },
  { 
    label: 'Next', 
    icon: nextIcon, 
    action: () => sendCommand('next'),
  },
  { 
    label: metadata.value?.status === 'playing' ? 'Pause' : 'Play', 
    icon: metadata.value?.status === 'playing' ? pauseIcon : playPauseIcon, 
    action: () => {
      if (metadata.value?.status === 'playing') {
        sendCommand('pause');
      } else {
        sendCommand('play');
      }
    },
  },
  { 
    label: 'Prev', 
    icon: prevIcon, 
    action: () => sendCommand('previous'),
  },
  { 
    label: 'Vol -', 
    icon: volumeDownIcon, 
    action: () => adjustVolume(-2),
    continuous: true
  },
]);

const refreshMetadata = async () => {
  try {
    const result = await (window as any).electronAPI?.bluetoothMedia?.getMetadata();
    if (result && result.metadata) {
      metadata.value = result.metadata;
      connectionStatus.value = 'connected';
    } else {
      connectionStatus.value = 'disconnected';
      metadata.value = null;
    }
  } catch (error) {
    console.error('Failed to get metadata:', error);
    connectionStatus.value = 'disconnected';
    metadata.value = null;
  }
};



// Lifecycle
onMounted(() => {
  // Initial load
  refreshMetadata();
  getVolume();
  
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
      }
    });
  }
  

});

onBeforeUnmount(() => {
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