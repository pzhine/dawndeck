<template>
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <RoundScrollContainer>
      <div class="p-6">
        <h1 class="text-2xl font-bold text-white mb-6">Ambience Favorites</h1>
        
        <!-- Favorites List -->
        <div v-if="ambienceFavorites.length > 0" class="space-y-3">
          <div
            v-for="favorite in ambienceFavorites"
            :key="favorite.id"
            class="bg-gray-800 rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <!-- Name -->
              <div class="flex-1">
                <div class="text-white font-medium text-lg">{{ favorite.name }}</div>
                <div class="text-gray-400 text-sm">
                  {{ formatDate(favorite.timestamp) }}
                </div>
              </div>
              
              <!-- Actions -->
              <div class="flex gap-2">
                <button
                  @click="loadFavorite(favorite.id)"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Load
                </button>
                <button
                  @click="deleteFavorite(favorite.id)"
                  class="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  v-html="trashIcon"
                ></button>
              </div>
            </div>
            
            <!-- Preview sections -->
            <div class="flex gap-4">
              <!-- Lamp preview -->
              <div class="flex-1 flex items-center gap-3">
                <span v-html="sunIcon" class="w-4 h-4 text-gray-400"></span>
                <div
                  class="w-10 h-10 rounded-full border-2 border-gray-600"
                  :style="{ backgroundColor: getFavoriteColor(favorite.lamp.colors, lampCircleColors) }"
                ></div>
                <div class="text-sm text-gray-400">{{ favorite.lamp.brightness }}%</div>
              </div>
              
              <!-- Projector preview -->
              <div class="flex-1 flex items-center gap-3">
                <span v-html="sunriseIcon" class="w-4 h-4 text-gray-400"></span>
                <div
                  class="w-10 h-10 rounded-full border-2 border-gray-600"
                  :style="{ backgroundColor: getFavoriteColor(favorite.projector.colors, projectorCircleColors) }"
                ></div>
                <div class="text-sm text-gray-400">{{ favorite.projector.brightness }}%</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Empty state -->
        <div
          v-else
          class="text-center py-12 text-gray-400"
        >
          <div class="text-4xl mb-4" v-html="heartIcon"></div>
          <p class="text-lg">No favorites yet</p>
          <p class="text-sm mt-2">Create color combinations in Ambience Control and add them to favorites</p>
        </div>
      </div>
    </RoundScrollContainer>
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/appState';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import RoundScrollContainer from '../components/RoundScrollContainer.vue';
import feather from 'feather-icons';

const appStore = useAppStore();
const router = useRouter();

const sunIcon = feather.icons['sun'].toSvg();
const sunriseIcon = feather.icons['sunrise'].toSvg();
const heartIcon = feather.icons['heart'].toSvg();
const trashIcon = feather.icons['trash-2'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => []);

const ambienceFavorites = computed(() => appStore.ambienceFavorites);

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
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Load a favorite and navigate back
 */
function loadFavorite(id: string) {
  appStore.loadAmbienceFavorite(id);
  router.push('/ambience');
}

/**
 * Delete a favorite
 */
function deleteFavorite(id: string) {
  appStore.removeAmbienceFavorite(id);
}
</script>
