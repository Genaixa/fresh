import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:   '#2D5F2D',
          accent: '#4A8C4A',
          light:  '#A8D5A8',
        },
        surface: {
          DEFAULT: '#F5F5F0',
          dark:    '#0F1A0F',
          card:    '#FFFFFF',
          'card-dark': '#1E2E1E',
        },
        status: {
          green:  '#22C55E',
          amber:  '#F59E0B',
          red:    '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'price-lg': ['2.5rem', { lineHeight: '1', fontWeight: '700' }],
        'price-sm': ['1.25rem', { lineHeight: '1', fontWeight: '600' }],
      },
      minHeight: {
        tap: '48px',
      },
      minWidth: {
        tap: '48px',
      },
    },
  },
  plugins: [],
}

export default config
