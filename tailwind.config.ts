import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        soft: '#f3f6fb',
        brand: '#123a73',
        brandDark: '#0b2852',
        brandLight: '#2d8fd5',
        gold: '#d6a53a',
        goldDark: '#9d7626'
      },
      boxShadow: {
        soft: '0 18px 45px rgba(18, 58, 115, 0.10)'
      }
    }
  },
  plugins: []
} satisfies Config;
