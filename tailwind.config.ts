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
        gold: '#c9a227',
        goldDark: '#9c7a18'
      },
      boxShadow: {
        soft: '0 18px 45px rgba(5, 5, 5, 0.10)'
      }
    }
  },
  plugins: []
} satisfies Config;
