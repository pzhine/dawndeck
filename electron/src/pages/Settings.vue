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

const router = useRouter();
const appStore = useAppStore();

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
