<template>
  <RadialMenu :items="menuItems">
    <div class="w-full h-screen flex justify-center items-center relative">
      <!-- Connected State -->
      <div v-if="metadata && connectionStatus === 'connected'" class="w-full h-full flex flex-col items-center justify-center">
        <!-- Title -->
        <div class="text-center z-10 pointer-events-none mb-4 px-8">
          <div class="text-3xl font-bold tracking-widest leading-tight">{{ metadata.title || 'Unknown' }}</div>
        </div>

        <!-- Artist -->
        <div class="text-center z-10 pointer-events-none px-8 mb-6">
          <div class="text-xl opacity-80">{{ metadata.artist || 'Unknown Artist' }}</div>
        </div>

        <!-- Volume Bar -->
        <div class="w-64 h-2 bg-gray-700 rounded-full overflow-hidden z-10 pointer-events-none">
          <div 
            class="h-full bg-white transition-all duration-200 ease-out"
            :style="{ width: `${volume}%` }"
          ></div>
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
const volumeDownIcon = feather.icons['volume-1'].toSvg();
const clockIcon = feather.icons['clock'].toSvg();
const volumeUpIcon = feather.icons['volume-2'].toSvg();
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

const adjustVolume = async (delta: number) => {
  try {
    // Optimistic update
    const newVol = Math.max(0, Math.min(100, volume.value + delta));
    volume.value = newVol;
    
    await (window as any).electronAPI?.volumeControl?.setSystemVolume(newVol);
  } catch (error) {
    console.error('Failed to adjust volume:', error);
  }
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
    label: 'Clock', 
    icon: clockIcon, 
    route: '/' 
  },
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
    instant: true
  },
  { 
    label: metadata.value?.status === 'playing' ? 'Pause' : 'Play', 
    icon: metadata.value?.status === 'playing' ? pauseIcon : playPauseIcon, 
    action: () => sendCommand('togglePlayPause'),
    instant: true
  },
  { 
    label: 'Prev', 
    icon: prevIcon, 
    action: () => sendCommand('previous'),
    instant: true
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
    // Sync volume
    getVolume();

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