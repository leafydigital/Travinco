import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf6',
          100: '#d5f4e8',
          200: '#ade8d3',
          300: '#78d4b7',
          400: '#43b998',
          500: '#219e7e',
          600: '#137e65',
          700: '#106553',
          800: '#0f5044',
          900: '#0d4239',
        },
        sand: {
          50: '#fdfaf5',
          100: '#faf2e5',
          200: '#f3e0c3',
          300: '#e9c793',
          400: '#dda75f',
          500: '#d08d3d',
          600: '#b8722f',
          700: '#985a29',
          800: '#7c4827',
          900: '#663c23',
        },
        ink: {
          50: '#f5f6f7',
          100: '#e6e8eb',
          200: '#cdd1d7',
          300: '#a6adb8',
          400: '#788293',
          500: '#5c6577',
          600: '#495064',
          700: '#3c4152',
          800: '#2a2e3b',
          900: '#181a22',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
