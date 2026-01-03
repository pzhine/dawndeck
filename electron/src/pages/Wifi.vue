<template>
  <div id="wifi" class="w-full h-full">
    <RoundScrollContainer
      :items="wifiNetworks"
      @select="selectNetwork"
      :title="'Available WiFi Networks'"
      :show-title="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import RoundScrollContainer from '../components/RoundScrollContainer.vue';
import { ListItem } from '../components/InteractiveList.vue';

const router = useRouter();
const wifiNetworks = ref<string[]>([]);

// Check if running on Linux
const isLinux = navigator.userAgent.toLowerCase().includes('linux');

const fetchWifiNetworks = async (): Promise<void> => {
  // Mock WiFi networks when not running on Linux
  if (!isLinux) {
    wifiNetworks.value = [
      'Home WiFi',
      'Office Network',
      'Guest Network',
      'Coffee Shop WiFi',
      'Neighbor WiFi 5G',
      'Mobile Hotspot',
      'Public Library',
      'Airport WiFi',
    ];
    return;
  }

  try {
    const networks = await window.ipcRenderer.invoke(
      'list-available-wifi-networks'
    ) as string[];
    // Remove duplicates using Set
    wifiNetworks.value = [...new Set(networks)];
  } catch (error) {
    console.error('Error fetching WiFi networks:', error);
    // Fall back to mock data if IPC call fails
    wifiNetworks.value = [
      'Home WiFi',
      'Office Network',
      'Guest Network',
    ];
  }
};

const selectNetwork = (item: ListItem): void => {
  const network = typeof item === 'string' ? item : item.label;
  console.log(`Selected network: ${network}`);
  router.push({
    name: 'WifiPassword',
    params: { networkName: network },
  });
};

let intervalId: NodeJS.Timeout | undefined;

onMounted(() => {
  // Initial fetch
  fetchWifiNetworks();

  // Set up interval to refresh every 15 seconds
  intervalId = setInterval(fetchWifiNetworks, 15000);
});

// Clean up interval when component is unmounted
onUnmounted(() => {
  clearInterval(intervalId);
});
</script>
