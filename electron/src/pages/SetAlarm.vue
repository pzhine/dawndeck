<template>
  <RadialMenu 
    :lowerItems="lowerMenuItems" 
    :upperItems="upperMenuItems"
    :width="'narrow'" 
    :pinned="true"
  >
    <!-- Content -->
    <div class="flex-1 flex flex-col items-center justify-center relative touch-none">
      <div class="flex flex-row items-center justify-center gap-4">
        
        <!-- AM/PM Indicator (Only 12h) -->
        <div 
          v-if="is12h"
          class="flex flex-col justify-center select-none"
          :style="{ 
             'font-family': '\'DS-Digital\', sans-serif', 
             'font-size': '32px',
             'line-height': '1',
             'margin-bottom': '8px'
          }"
        >
          <div :style="{ opacity: isAm ? 1 : 0.15 }">AM</div>
          <div :style="{ opacity: !isAm ? 1 : 0.15 }">PM</div>
        </div>

        <!-- Hours -->
        <div class="w-16">
          <ScrollSelector 
            :items="hoursItems" 
            v-model="selectedHour"
            :format-label="formatHourLabel"
          />
        </div>

        <div class="text-4xl font-bold mb-2 opacity-50">:</div>

        <!-- Minutes -->
        <div class="w-16">
          <ScrollSelector 
            :items="minutesItems" 
            v-model="selectedMinute"
          />
        </div>
      
      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/appState';
import ScrollSelector from '../components/ScrollSelector.vue';
import RadialMenu from '../components/RadialMenu.vue';
import feather from 'feather-icons';

const router = useRouter();

const volumeIcon = feather.icons['volume-2'].toSvg();
const sunriseIcon = feather.icons['sunrise'].toSvg();

const appStore = useAppStore();

const upperMenuItems = computed(() => [
  {
    label: 'Alarm',
    icon: feather.icons['bell'].toSvg(),
    action: () => appStore.toggleAlarmActive(),
    active: appStore.alarmActive,
  }
]);

const lowerMenuItems = computed(() => {
  // Ensure reactivity tracks the alarm ID
  // This forces the computed property to re-evaluate when the specific ID changes,
  // not just when the alarmSound object reference changes (though that should work too)
  const _dep = appStore.alarmSound?.id;

  return [
  {
    label: 'Sunrise',
    icon: sunriseIcon,
    action: () => router.push('/sunriseSettings')
  },
  {
    label: 'Alarm Sound',
    icon: volumeIcon,
    active: !!appStore.alarmSound,
    action: () => {
      if (appStore.alarmSound) {
        router.push({ 
          name: 'MediaPlayer', 
          params: { soundId: appStore.alarmSound.id },
          query: { backRoute: '/alarm' }
        });
      } else {
        router.push({ 
          name: 'SoundCategories',
          query: { backRoute: '/alarm' }
        });
      }
    }
  },
]});

// Generate items
const minutesItems = Array.from({ length: 60 }, (_, i) => i);
// 24h: 0-23. 12h: 12, 1-11
const hours24Items = Array.from({ length: 24 }, (_, i) => i);
const hours12Items = [12, ...Array.from({ length: 11 }, (_, i) => i + 1)];

const is12h = computed(() => appStore.timeFormat === '12h');
const hoursItems = computed(() => is12h.value ? hours12Items : hours24Items);

// Track AM/PM state for display
const isAm = computed(() => appStore.alarmTime[0] < 12);

// Bindings
const selectedMinute = computed({
  get: () => appStore.alarmTime[1],
  set: (val) => {
    appStore.setAlarmTime(appStore.alarmTime[0], Number(val));
  }
});

const selectedHour = computed({
  get: () => {
    const h = appStore.alarmTime[0];
    if (is12h.value) {
      if (h === 0) return 12;
      if (h > 12) return h - 12;
      return h;
    }
    return h;
  },
  set: (val) => {
    const valNum = Number(val);
    if (!is12h.value) {
      appStore.setAlarmTime(valNum, appStore.alarmTime[1]);
      return;
    }

    // 12h Logic - Toggle AM/PM only on 11<->12 transition
    const currentH = appStore.alarmTime[0];
    const currentIsPM = currentH >= 12;
    const currentDisplay = selectedHour.value; // Current displayed hour (1-12)
    const newDisplay = valNum; // New displayed hour (1-12)
    
    // User Requirement:
    // Forward (11 -> 12): Toggle AM/PM
    // Backward (12 -> 11): Toggle AM/PM
    // All other transitions (including 12 <-> 1) maintain AM/PM state
    const shouldToggle = 
      (currentDisplay === 11 && newDisplay === 12) ||
      (currentDisplay === 12 && newDisplay === 11);
    
    const newIsPM = shouldToggle ? !currentIsPM : currentIsPM;
    
    // Convert to 24h
    let newH = newDisplay;
    if (newH === 12) {
      newH = newIsPM ? 12 : 0;
    } else {
      newH = newIsPM ? newH + 12 : newH;
    }
    
    appStore.setAlarmTime(newH, appStore.alarmTime[1]);
  }
});

const formatHourLabel = (val: string | number) => {
  return String(val).padStart(2, '0');
};

</script>
