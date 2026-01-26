/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'rgb(var(--ui-color))',
      },
    },
  },
  corePlugins: {
    // Explicitly enable filter utilities
    filter: true,
    backdropFilter: true,
  },
};
