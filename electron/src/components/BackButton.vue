<template>
  <div 
    class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 
           w-[200px] h-[200px] rounded-full 
           bg-[#222222] border-2 border-[#333333]
           flex items-center justify-center
           cursor-pointer z-[1000] text-white
           transition-all duration-200 ease
           hover:bg-[#444444] hover:border-[#555555]
           active:bg-[#111111] active:scale-95"
    @click="handleBack"
    @touchstart.stop
    @mousedown.stop
  >
    <div class="pointer-events-none relative top-[40px]" v-html="arrowIcon"></div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import feather from 'feather-icons';

const router = useRouter();

const arrowIcon = feather.icons['arrow-left'].toSvg({ width: '48', height: '48', 'stroke-width': '2' });

const handleBack = () => {
  router.back();
};
</script>
