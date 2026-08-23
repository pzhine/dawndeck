<template>
  <BackToHome />
  <div class="w-full h-full">
    <RoundScrollContainer
      :items="menuItems"
      :title="'DawnDeck'"
      :show-title="true"
      :showBackButton="true"
      @back="router.push('/')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import RoundScrollContainer, { ListItem } from '../components/RoundScrollContainer.vue';
import { useAppStore } from '../stores/appState';
import BackToHome from '../components/BackToHome.vue';
import feather from 'feather-icons';

const router = useRouter();
const appStore = useAppStore();

const clockIcon = feather.icons['clock'].toSvg();

// Step function for screen sleep timeout
// 10-60s: 5 second steps (10 steps)
// 60-180s: 10 second steps (12 steps)
const sleepTimeoutStepFunction = (currentValue: number, delta: number): number => {
  const steps = Math.round(delta / 3);
  
  if (currentValue < 60) {
    // 5-second steps
    return Math.max(10, Math.min(180, currentValue + steps * 5));
  } else {
    // 10-second steps
    return Math.max(10, Math.min(180, currentValue + steps * 10));
  }
};

// Progress function for screen sleep timeout (for visual indicator)
const sleepTimeoutProgressFunction = (value: number): number => {
  // Map 10-60s linearly to 0-0.45
  // Map 60-180s linearly to 0.45-1.0
  if (value <= 60) {
    return ((value - 10) / 50) * 0.45;
  } else {
    return 0.45 + ((value - 60) / 120) * 0.55;
  }
};

// Format screen sleep timeout for display
const formatSleepTimeout = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};

// Define menu items with their current values from the app store
const menuItems = computed(() => {
  const items: ListItem[] = [];

  items.push(
    {
      label: 'Screen Brightness',
      value: appStore.screenBrightness,
      range: [5, 100],
      onChange: (value: number) => {
        appStore.setScreenBrightness(value);
      },
    },
    {
      label: 'Screen Sleep Timeout',
      value: formatSleepTimeout(appStore.screenSleepTimeout),
      knob: {
        value: appStore.screenSleepTimeout,
        min: 10,
        max: 180,
        icon: clockIcon,
        color: '#6366f1', // indigo-500
        size: 50,
        strokeWidth: 6,
        stepFunction: sleepTimeoutStepFunction,
        progressFunction: sleepTimeoutProgressFunction,
        onChange: (value: number) => {
          appStore.setScreenSleepTimeout(value);
        },
      },
    },
    {
      label: 'UI Color',
      value: '',
      onSelect: () => router.push('/color-settings'),
    },
    {
      label: 'Time Format',
      value: appStore.timeFormat,
      onSelect: () => {
        // Toggle between 12h and 24h format
        appStore.setTimeFormat(appStore.timeFormat === '12h' ? '24h' : '12h');
      },
    },
    {
      label: 'Timezone',
      value: appStore.timezone?.split('/').pop()?.replace(/_/g, ' ') || 'Not Set',
      onSelect: () => router.push('/timezone-settings'),
    },
    {
      label: 'Colon Blink',
      value: appStore.colonBlink ? 'On' : 'Off',
      onSelect: () => {
        appStore.setColonBlink(!appStore.colonBlink);
      },
    },
    {
      label: 'Bluetooth',
      value: 'Add Device',
      onSelect: () => router.push('/bluetooth-pairing'),
    },
    {
      label: 'Wi-Fi',
      value: appStore.lastConnectedWifi || 'Not Connected',
      onSelect: () => router.push('/wifi'),
    },
  )

  return items;
});

</script>
