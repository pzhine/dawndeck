<template>
  <div class="w-full h-full flex flex-col items-center justify-center p-6">
    <!-- Title -->
    <div class="text-center mb-4 text-[0.8rem] font-bold truncate max-w-full px-4">
      {{ networkName }}
    </div>

    <!-- Password Input with Backspace -->
    <div class="flex flex-row items-center justify-center mb-6 w-[75%]">
      <input
        type="text"
        class="flex-1 p-2 border rounded text-center text-[0.8rem] min-w-0"
        v-model="password"
        ref="passwordInput"
        placeholder="Enter password"
      />
      <button
        class="ml-2 p-1 flex rounded border shrink-0"
        @click="removeLastCharacter"
        title="Backspace"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H15a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- Keyboard -->
    <div class="flex flex-col items-center justify-center mb-4">
      <div
        v-for="(row, rowIndex) in isShiftActive ? capKeys : keyboardKeys"
        :key="rowIndex"
        class="flex flex-row justify-center"
      >
        <button
          v-for="key in row"
          :key="key"
          :class="{
            'px-1.5 py-2 m-0.5 min-w-[1.8rem] text-[0.55rem] rounded border': true,
            'bg-[var(--color-li-highlight)]': key === 'SHIFT' && isShiftActive,
            'border-blue-400 text-blue-400': !key.match(/[a-zA-Z]/),
            'min-w-[3rem]': key === 'SHIFT',
          }"
          @click="onKeyboard(key)"
        >
          {{ key }}
        </button>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-row gap-3 justify-center mt-2">
      <button
        @click="router.back()"
        class="px-4 py-2 text-[0.6rem] border rounded"
      >
        ← Back
      </button>
      <button
        @click="connectToNetwork"
        class="px-4 py-2 text-[0.6rem] border rounded bg-blue-600 text-white"
      >
        Connect
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const password = ref('');
const isShiftActive = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);
const originalFontSize = ref('');

const keyboardKeys = [
  [...'!@#$%&*_-.'.split('')],
  [...'1234567890'.split('')],
  [...'qwertyuiop'.split('')],
  [...'asdfghjkl'.split('')],
  ['SHIFT', ...'zxcvbnm'.split('')],
];

const capKeys = [
  [...'!@#$%&*_-.'.split('')],
  [...'1234567890'.split('')],
  [...'QWERTYUIOP'.split('')],
  [...'ASDFGHJKL'.split('')],
  ['SHIFT', ...'ZXCVBNM'.split('')],
];

const networkName = computed(() => route.params?.networkName as string);

const onKeyboard = (key: string): void => {
  if (key === 'SHIFT') {
    toggleShift();
    return;
  }
  password.value += key;
};

const removeLastCharacter = (): void => {
  password.value = password.value.slice(0, -1);
};

const connectToNetwork = (): void => {
  router.push({
    name: 'WifiConnect',
    params: { networkName: networkName.value, password: password.value },
  });
};

const toggleShift = (): void => {
  isShiftActive.value = !isShiftActive.value;
};

// onMounted(() => {
//   // Focus the password input when component is mounted
//   passwordInput.value?.focus();

//   // Store the original font size and set it to 16px
//   originalFontSize.value = document.documentElement.style.fontSize;
//   document.documentElement.style.fontSize = '18px';
// });

// onUnmounted(() => {
//   // Restore the original font size when component is unmounted
//   document.documentElement.style.fontSize = originalFontSize.value;
// });
</script>
