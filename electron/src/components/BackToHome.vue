<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

interface Props {
  defaultBackRoute?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultBackRoute: '/'
});

const router = useRouter();
const route = useRoute();

onMounted(() => {
  if (!route.query.backRoute) {
    router.replace({ 
      ...route, 
      query: { ...route.query, backRoute: props.defaultBackRoute } 
    });
  }
});
</script>

<template>
  <!-- Renderless component -->
</template>
