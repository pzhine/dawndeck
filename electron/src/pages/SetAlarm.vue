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

        <!-- AM/PM (Only 12h) -->
        <div v-if="is12h" class="w-24 ml-2 border-l border-white/10 pl-2">
          <ScrollSelector 
            :items="['AM', 'PM']" 
            v-model="selectedAmPm"
            :format-label="formatAmPm"
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

    // 12h Logic
    const currentH = appStore.alarmTime[0];
    const isPM = currentH >= 12; // 12 PM is 12. 12 AM is 0.
    
    // Convert visual hour to 24h
    // 12 -> 0 (if AM) / 12 (if PM)
    // 1 -> 1 (if AM) / 13 (if PM)
    
    let newH = valNum;
    if (newH === 12) newH = 0;
    
    if (isPM) newH += 12;
    
    appStore.setAlarmTime(newH, appStore.alarmTime[1]);
  }
});

const selectedAmPm = computed({
  get: () => appStore.alarmTime[0] >= 12 ? 'PM' : 'AM',
  set: (val) => {
    const currentH = appStore.alarmTime[0];
    const isPM = currentH >= 12;
    const isNewPM = val === 'PM';
    
    if (isPM === isNewPM) return;
    
    let newH = currentH;
    if (isNewPM) {
      newH += 12;
    } else {
      newH -= 12;
    }
    appStore.setAlarmTime(newH, appStore.alarmTime[1]);
  }
});

const formatHourLabel = (val: string | number) => {
  return String(val).padStart(2, '0');
};

const formatAmPm = (val: string | number) => String(val);

</script>
