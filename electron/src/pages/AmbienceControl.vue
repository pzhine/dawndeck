<template>
  <BackToHome />
  <RadialMenu :upper-items="upperMenuItems" :pinned="true" width="narrow">
    <div class="relative flex flex-col h-full w-full">
      <!-- Projector Brightness Control (Left) -->
      <div class="absolute left-8 top-1/2 -translate-y-1/2 z-10">
         <BrightnessControl
          :brightness="projectorBrightness"
          :icon="sunriseIcon"
          :color="projectorBrightnessColor"
          :connector-height="80"
          :connector-width="80"
          connector-direction="up-right"
          @update:brightness="handleProjectorBrightnessUpdate"
        />
      </div>

      <!-- Lamp Brightness Control (Right) -->
      <div class="absolute right-8 top-1/2 -translate-y-1/2 z-10">
        <BrightnessControl
          :brightness="lampBrightness"
          :icon="sunIcon"
          :color="lampBrightnessColor"
          :connector-height="80"
          :connector-width="80"
          connector-direction="down-left"
          @update:brightness="handleLampBrightnessUpdate"
        />
       
      </div>

      <!-- Projector Control -->
      <div class="h-1/2 flex flex-col relative top-4">
        <LightControl
            :circle-colors="projectorCircleColors"
            :colors="projectorColors"
            :position="projectorPosition"
            :active="projectorActive"
            :brightness="projectorBrightness"
            :rotate="-115"
            :rotate-slices="-90"
            @update:colors="handleProjectorColorsUpdate"
            @update:brightness="handleProjectorBrightnessUpdate"
          />
      </div>

      <!-- Favorite Name Display (shown when editing a preset) -->
      <div v-if="editingFavoriteName" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div class="text-center text-white text-xl font-bold whitespace-nowrap drop-shadow-lg relative top-4">
          {{ editingFavoriteName }}
        </div>
      </div>

      <!-- Color Name Display (hidden when editing a preset) -->
      <div v-if="!editingFavoriteName" class="absolute top-1/2 left-22 -translate-y-1/2 z-20 pointer-events-none opacity-70">
        <div class="text-left text-white text-sm whitespace-nowrap relative top-1" :style="{ color: `rgb(${projectorBrightnessColor.join(',')})` }">
          {{ colorNameProjector }}
        </div>
      </div>
      <div v-if="!editingFavoriteName" class="absolute top-1/2 right-20 -translate-y-1/2 z-20 pointer-events-none opacity-70">
        <div class="text-right text-white text-sm whitespace-nowrap relative top-5" :style="{ color: `rgb(${lampBrightnessColor.join(',')})`}">
          {{ colorNameLamp }}
        </div>
      </div>

      <!-- Lamp Control -->
      <div class="h-1/2 flex flex-col relative top-5">
        <LightControl
            :circle-colors="lampCircleColors"
            :colors="lampColors"
            :position="lampPosition"
            :active="lampActive"
            :brightness="lampBrightness"
            :rotate-slices="30"
            @update:colors="handleLampColorsUpdate"
            @update:brightness="handleLampBrightnessUpdate"
          />

      </div>
    </div>
  </RadialMenu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { debounce } from 'lodash-es';
import { useAppStore } from '../stores/appState';
import RadialMenu, { MenuItem } from '../components/RadialMenu.vue';
import LightControl from '../components/LightControl.vue';
import BrightnessControl from '../components/BrightnessControl.vue';
import feather from 'feather-icons';
import { mixColorsRgb } from '../services/colorUtils';
import { generateColorSlug, getColorName } from '../services/colorNaming';
import BackToHome from '../components/BackToHome.vue';

const appStore = useAppStore();
const router = useRouter();
const route = useRoute();

// Active states
const lampActive = computed(() => appStore.lampActive ?? true);
const projectorActive = computed(() => appStore.projectorActive ?? true);

const sunIcon = feather.icons['sun'].toSvg();
const sunriseIcon = feather.icons['sunrise'].toSvg();
const favoriteIcon = feather.icons['heart'].toSvg();
const listIcon = feather.icons['list'].toSvg();

const upperMenuItems = computed<MenuItem[]>(() => [
  { 
    label: 'Add to Favorites', 
    icon: favoriteIcon,
    action: toggleFavorite,
    active: currentIsFavorite.value
  },
  { 
    label: 'Favorites', 
    icon: listIcon,
    action: goToFavorites,
  },
]);

// Lamp state
const lampBrightness = computed(() => appStore.lampBrightness);
const lampColors = computed<[number, number, number]>(() => {
  const colors = appStore.lampColors || { warmWhite: 0, pink: 0, orange: 0 };
  return [colors.warmWhite, colors.pink, colors.orange];
});
const lampPosition = computed(() => appStore.lampPosition);
const lampCircleColors: [string, string, string] = ['#ffb86d', '#FF2A70', '#ff4b09'];

// Projector state
const projectorBrightness = computed(() => appStore.projectorBrightness);
const projectorColors = computed<[number, number, number]>(() => {
  const colors = appStore.projectorColors || { color0: 0, color1: 0, color2: 0 };
  return [colors.color0, colors.color1, colors.color2];
});
const projectorPosition = computed(() => appStore.projectorPosition);
const projectorCircleColors: [string, string, string] = ['#9d09ff', '#ff8409', '#0058f0'];

// Color name state
const colorNameLamp = ref<string>('');
const colorNameProjector = ref<string>('');

const currentColorSlug = computed(() => {
  return generateColorSlug(`${colorNameProjector.value} ${colorNameLamp.value}`)
});

// Get the favorite ID being edited from route params
const editingFavoriteId = computed(() => route.params.favoriteId as string | undefined);

// Get the name of the favorite being edited (only for presets)
const editingFavoriteName = computed(() => {
  if (!editingFavoriteId.value) return null;
  const favorite = appStore.ambienceFavorites.find(fav => fav.id === editingFavoriteId.value);
  return favorite?.name || null;
});

const currentIsFavorite = computed(() => {
  // If we're editing a specific favorite (came from favorites list), check by that ID
  if (editingFavoriteId.value) {
    return appStore.ambienceFavorites.find(
      fav => fav.id === editingFavoriteId.value
    ) !== undefined;
  }
  // Otherwise, check if current color matches any favorite by slug
  return appStore.ambienceFavorites.find(
    fav => fav.id === currentColorSlug.value
  ) !== undefined;
});

// Debounced function to update color name
const updateColorNames = debounce(() => {
  colorNameLamp.value = getColorName(...lampBrightnessColor.value);
  colorNameProjector.value = getColorName(...projectorBrightnessColor.value);
}, 300);

// Watch for color changes and update name
watch([lampColors, projectorColors], () => {
  updateColorNames();
}, { immediate: true });

// Debounced function to update favorite if we're editing one
const updateFavoriteIfExists = debounce(() => {
  // If we're editing a specific favorite, always update it
  if (editingFavoriteId.value && currentIsFavorite.value) {
    appStore.updateAmbienceFavorite(editingFavoriteId.value);
  }
  // Otherwise, only update if the generated slug matches an existing favorite
  else if (!editingFavoriteId.value && currentIsFavorite.value) {
    appStore.updateAmbienceFavorite(currentColorSlug.value);
  }
}, 500);

// Watch for changes to colors or brightness and update favorite if it exists
watch(
  [lampColors, lampBrightness, projectorColors, projectorBrightness],
  () => {
    updateFavoriteIfExists();
  }
);

/**
 * Computed lamp brightness control color
 */
const lampBrightnessColor = computed(() => {
  return mixColorsRgb(lampCircleColors, lampColors.value);
});

/**
 * Computed projector brightness control color
 */
const projectorBrightnessColor = computed(() => {
  return mixColorsRgb(projectorCircleColors, projectorColors.value);
});

/**
 * Handle lamp color updates
 */
function handleLampColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setLampColors({
    warmWhite: colors[0],
    pink: colors[1],
    orange: colors[2],
  }, position);
}

/**
 * Handle lamp brightness updates
 */
function handleLampBrightnessUpdate(value: number) {
  appStore.setLampBrightness(value);
}

/**
 * Handle projector color updates
 */
function handleProjectorColorsUpdate(colors: [number, number, number], position: { x: number; y: number }) {
  appStore.setProjectorColors({
    color0: colors[0],
    color1: colors[1],
    color2: colors[2],
  }, position);
}

/**
 * Handle projector brightness updates
 */
function handleProjectorBrightnessUpdate(value: number) {
  appStore.setProjectorBrightness(value);
}

/**
 * Add current lamp and projector colors to favorites
 */
function toggleFavorite() {
  if (currentIsFavorite.value) {
    // Use the editing favorite ID if available, otherwise use the computed slug
    const idToRemove = editingFavoriteId.value || currentColorSlug.value;
    appStore.removeAmbienceFromFavorites(idToRemove);
    // Clear the route param after removing
    if (editingFavoriteId.value) {
      router.replace({ name: 'AmbienceControl' });
    }
    return;
  }
  appStore.addAmbienceToFavorites();
}

/**
 * Navigate to favorites page
 */
function goToFavorites() {
  router.push('/ambience-favorites');
}
</script>
