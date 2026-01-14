<template>
  <div class="w-full">
    <RoundScrollContainer
      :items="menuItems"
      :title="'Sunrise Settings'"
      :show-title="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/appState';
import RoundScrollContainer, { ListItem } from '../components/RoundScrollContainer.vue';
import feather from 'feather-icons';

const appStore = useAppStore();
const router = useRouter();

const clockIcon = feather.icons['clock'].toSvg();

// Format the duration in mm:ss or hh:mm:ss format
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

/**
 * Non-linear step function for duration
 * 0-5 min: 30 second increments (30 seconds)
 * 5-30 min: 1 minute increments (60 seconds)
 * 30-60 min: 5 minute increments (300 seconds)
 * 60+ min: 10 minute increments (600 seconds)
 * 
 * The pixel-to-step ratio is consistent, so dragging feels uniform
 * regardless of which part of the scale you're on.
 */
const durationStepFunction = (currentValue: number, delta: number): number => {
  // Each 3 pixels = 1 step (where a step is the current increment size)
  const steps = Math.round(delta / 3);
  
  let newValue = currentValue;
  const stepDirection = Math.sign(steps);
  const absSteps = Math.abs(steps);
  
  // Apply steps one at a time, checking current value each time
  for (let i = 0; i < absSteps; i++) {
    const currentMinutes = newValue / 60;
    
    let stepSize: number;
    if (currentMinutes < 5) {
      stepSize = 30; // 30 seconds
    } else if (currentMinutes < 30) {
      stepSize = 60; // 1 minute
    } else if (currentMinutes < 60) {
      stepSize = 300; // 5 minutes
    } else {
      stepSize = 600; // 10 minutes
    }
    
    newValue += stepDirection * stepSize;
  }
  
  return newValue;
};

const handleDurationUpdate = (value: number) => {
  appStore.setSunriseDuration(value);
};

/**
 * Calculate progress based on steps, not linear value
 * 0-5 min: 10 steps (30 sec each) = 300 seconds
 * 5-30 min: 25 steps (1 min each) = 1500 seconds
 * 30-60 min: 6 steps (5 min each) = 1800 seconds  
 * 60-120 min: 6 steps (10 min each) = 3600 seconds
 * Total: 47 steps
 */
const durationProgressFunction = (value: number, min: number, max: number): number => {
  const minutes = value / 60;
  let currentStep = 0;
  
  if (minutes <= 5) {
    // 0-5 min: 30 seconds per step
    currentStep = minutes * 2;
  } else if (minutes <= 30) {
    // 5-30 min: 1 minute per step
    currentStep = 10 + (minutes - 5);
  } else if (minutes <= 60) {
    // 30-60 min: 5 minutes per step
    currentStep = 10 + 25 + (minutes - 30) / 5;
  } else {
    // 60-120 min: 10 minutes per step
    currentStep = 10 + 25 + 6 + (minutes - 60) / 10;
  }
  
  const totalSteps = 47; // 10 + 25 + 6 + 6
  return Math.min(1, currentStep / totalSteps); // Ensure we don't exceed 1.0
};

// Define menu items with their current values
const menuItems = computed<ListItem[]>(() => [
  {
    label: 'Duration',
    value: formatDuration(appStore.sunriseDuration),
    knob: {
      value: appStore.sunriseDuration,
      min: 30,
      max: 7200,
      icon: clockIcon,
      color: '#fbbf24',
      size: 50,
      strokeWidth: 6,
      stepFunction: durationStepFunction,
      progressFunction: durationProgressFunction,
      onChange: handleDurationUpdate,
    },
  },
  {
    label: 'Brightness',
    value: `${Math.round(appStore.sunriseBrightness)}%`,
    knob: {
      value: appStore.sunriseBrightness,
      min: 5,
      max: 100,
      icon: feather.icons['sun'].toSvg(),
      color: '#fbbf24',
      size: 50,
      strokeWidth: 6,
      stepFunction: (currentValue: number, delta: number): number => {
        // Linear steps of 5%
        const steps = Math.round(delta / 3);
        return currentValue + steps * 5;
      },
      onChange: (value: number) => {
        appStore.setSunriseBrightness(value);
      },
    },
    // range: [5, 100], // 5% to 100%
    // onChange: (value: number) => {
    //   appStore.setSunriseBrightness(value);
    // },
  },
  {
    label: 'Start Sunrise',
    onSelect: () => router.push('/sunrise-player'),
  },
]);
</script>
