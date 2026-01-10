/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  corePlugins: {
    // Explicitly enable filter utilities
    filter: true,
    backdropFilter: true,
  },
};
