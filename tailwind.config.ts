import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        soft: 'rgb(var(--color-soft) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        brandDark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
        brandLight: 'rgb(var(--color-brand-light) / <alpha-value>)',
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
