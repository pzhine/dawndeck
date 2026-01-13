<template>
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <RoundScrollContainer 
      :items="favoriteItems"
      title="Ambience Favorites"
      :show-title="true"
      @select="handleSelect"
    />
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/appState';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import RoundScrollContainer, { ListItem } from '../components/RoundScrollContainer.vue';
import type { ColorFavorite } from '../../types/state';

const appStore = useAppStore();
const router = useRouter();

const upperMenuItems = computed<MenuItem[]>(() => []);

const lampCircleColors: [string, string, string] = ['#ffb86d', '#FF2A70', '#ff4b09'];
const projectorCircleColors: [string, string, string] = ['#9d09ff', '#ff8409', '#0058f0'];

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Get the preview color for a favorite
 */
function getFavoriteColor(ledValues: [number, number, number], circleColors: [string, string, string]): string {
  const rgb0 = hexToRgb(circleColors[0]);
  const rgb1 = hexToRgb(circleColors[1]);
  const rgb2 = hexToRgb(circleColors[2]);
  
  // Normalize LED values (0-255) to weights
  const total = ledValues[0] + ledValues[1] + ledValues[2];
  if (total === 0) return '#333333';
  
  const weight0 = ledValues[0] / total;
  const weight1 = ledValues[1] / total;
  const weight2 = ledValues[2] / total;
  
  const r = rgb0[0] * weight0 + rgb1[0] * weight1 + rgb2[0] * weight2;
  const g = rgb0[1] * weight0 + rgb1[1] * weight1 + rgb2[1] * weight2;
  const b = rgb0[2] * weight0 + rgb1[2] * weight1 + rgb2[2] * weight2;
  
  return rgbToHex(r, g, b);
}

/**
 * Get gradient background for a favorite row
 */
function getFavoriteGradient(favorite: ColorFavorite): string {
  const projectorColor = getFavoriteColor(favorite.projector.colors, projectorCircleColors);
  const lampColor = getFavoriteColor(favorite.lamp.colors, lampCircleColors);
  
  return `linear-gradient(to right, ${projectorColor}, ${lampColor})`;
}

/**
 * Convert favorites to list items
 */
const favoriteItems = computed<ListItem[]>(() => {
  return appStore.ambienceFavorites.map(favorite => ({
    label: favorite.name,
    gradient: getFavoriteGradient(favorite),
    onSelect: () => loadFavorite(favorite.id)
  }));
});

/**
 * Handle item selection
 */
function handleSelect(item: ListItem) {
  // The onSelect callback handles the action
}

/**
 * Load a favorite and navigate back to ambience control
 */
function loadFavorite(id: string) {
  appStore.loadAmbienceFavorite(id);
  router.push('/ambience-control');
}
</script>
