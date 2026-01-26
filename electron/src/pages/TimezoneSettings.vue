<template>
  <div class="w-full h-full">
    <RoundScrollContainer
      :items="timezoneItems"
      :title="'Select Timezone'"
      :show-title="true"
      :showBackButton="true"
      @back="router.push('/settings')"
      @select="selectTimezone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import RoundScrollContainer, { ListItem } from '../components/RoundScrollContainer.vue';
import { useAppStore } from '../stores/appState';

const router = useRouter();
const appStore = useAppStore();
const currentTime = ref(new Date());

// Update current time every second
let intervalId: NodeJS.Timeout | undefined;

onMounted(() => {
  intervalId = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

// Common timezones organized by region
const timezones = [
  // US & Canada
  { zone: 'America/New_York', label: 'Eastern Time (US)' },
  { zone: 'America/Chicago', label: 'Central Time (US)' },
  { zone: 'America/Denver', label: 'Mountain Time (US)' },
  { zone: 'America/Phoenix', label: 'Arizona' },
  { zone: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { zone: 'America/Anchorage', label: 'Alaska' },
  { zone: 'Pacific/Honolulu', label: 'Hawaii' },
  { zone: 'America/Toronto', label: 'Toronto' },
  { zone: 'America/Vancouver', label: 'Vancouver' },
  
  // Europe
  { zone: 'Europe/London', label: 'London' },
  { zone: 'Europe/Paris', label: 'Paris' },
  { zone: 'Europe/Berlin', label: 'Berlin' },
  { zone: 'Europe/Rome', label: 'Rome' },
  { zone: 'Europe/Madrid', label: 'Madrid' },
  { zone: 'Europe/Amsterdam', label: 'Amsterdam' },
  { zone: 'Europe/Brussels', label: 'Brussels' },
  { zone: 'Europe/Vienna', label: 'Vienna' },
  { zone: 'Europe/Warsaw', label: 'Warsaw' },
  { zone: 'Europe/Athens', label: 'Athens' },
  { zone: 'Europe/Istanbul', label: 'Istanbul' },
  { zone: 'Europe/Moscow', label: 'Moscow' },
  
  // Asia
  { zone: 'Asia/Dubai', label: 'Dubai' },
  { zone: 'Asia/Karachi', label: 'Karachi' },
  { zone: 'Asia/Kolkata', label: 'India' },
  { zone: 'Asia/Bangkok', label: 'Bangkok' },
  { zone: 'Asia/Singapore', label: 'Singapore' },
  { zone: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { zone: 'Asia/Shanghai', label: 'Shanghai' },
  { zone: 'Asia/Tokyo', label: 'Tokyo' },
  { zone: 'Asia/Seoul', label: 'Seoul' },
  
  // Australia & Pacific
  { zone: 'Australia/Perth', label: 'Perth' },
  { zone: 'Australia/Adelaide', label: 'Adelaide' },
  { zone: 'Australia/Sydney', label: 'Sydney' },
  { zone: 'Australia/Brisbane', label: 'Brisbane' },
  { zone: 'Pacific/Auckland', label: 'Auckland' },
  
  // South America
  { zone: 'America/Sao_Paulo', label: 'São Paulo' },
  { zone: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { zone: 'America/Santiago', label: 'Santiago' },
  { zone: 'America/Lima', label: 'Lima' },
  { zone: 'America/Bogota', label: 'Bogotá' },
  
  // Africa
  { zone: 'Africa/Cairo', label: 'Cairo' },
  { zone: 'Africa/Johannesburg', label: 'Johannesburg' },
  { zone: 'Africa/Lagos', label: 'Lagos' },
  { zone: 'Africa/Nairobi', label: 'Nairobi' },
];

// Format time in a specific timezone
const formatTimeInTimezone = (timezone: string): string => {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: appStore.timeFormat === '12h',
    };
    return currentTime.value.toLocaleTimeString('en-US', options);
  } catch (error) {
    console.error(`Error formatting time for timezone ${timezone}:`, error);
    return 'Invalid';
  }
};

// Create a map to store timezone zones by label
const timezoneMap = new Map<string, string>();

// Create list items with current times
const timezoneItems = computed((): ListItem[] => {
  // Clear the map before repopulating
  timezoneMap.clear();
  
  return timezones.map(({ zone, label }) => {
    timezoneMap.set(label, zone);
    return {
      label,
      value: formatTimeInTimezone(zone),
      onSelect: () => {
        appStore.setTimezone(zone);
        router.push('/settings');
      },
    };
  });
});

// Handle timezone selection (fallback if onSelect is not triggered)
const selectTimezone = (item: ListItem) => {
  if (typeof item === 'object' && item.label) {
    const zone = timezoneMap.get(item.label);
    if (zone) {
      appStore.setTimezone(zone);
      router.push('/settings');
    }
  }
};
</script>
