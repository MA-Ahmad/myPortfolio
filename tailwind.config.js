/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'selector',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  corePlugins: {
    preflight: true,
  },
  theme: {
    screens: {
      sm: '30em',
      md: '48em',
      lg: '62em',
      xl: '80em',
      '2xl': '96em',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        line: 'var(--line)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)'
        },
        info: 'var(--info)',
        gray: {
          50: '#F7FAFC',
          100: '#EDF2F7',
          200: '#E2E8F0',
          300: '#CBD5E0',
          400: '#A0AEC0',
          500: '#718096',
          600: '#4A5568',
          700: '#2D3748',
          800: '#1A202C',
          900: '#171923',
          1000: '#121721',
        },
        accent: {
          50: 'var(--colors-accent-50)',
          100: 'var(--colors-accent-100)',
          200: 'var(--colors-accent-200)',
          300: 'var(--colors-accent-300)',
          400: 'var(--colors-accent-400)',
          500: 'var(--colors-accent-500)',
          600: 'var(--colors-accent-600)',
          700: 'var(--colors-accent-700)',
          800: 'var(--colors-accent-800)',
          900: 'var(--colors-accent-900)',
        },
        defaultAccent: {
          50: '#e3f2fc',
          100: '#ddf2ff',
          200: '#abd2fc',
          300: '#5daafc',
          400: '#1a85ff',
          500: '#006be6',
          600: '#0053b4',
          700: '#003b82',
          800: '#002451',
          900: '#000d21',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
        ],
        handwritten: ['Virgil', 'cursive'],
        mono: ['Cascadia', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        body: ['1.125rem', { lineHeight: '1.75rem' }],
      },
    },
  },
  plugins: [],
}
