/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // var(--body) is the Devanagari display stack used by the .logo spec
        display: ['var(--body)'],
        ui: ['var(--ui)'],
        deva: ['var(--serif-deva)'],
      },
      colors: {
        sky: {
          900: '#1b3f75',
          800: '#24406e',
        },
        ink: {
          900: '#0b0407',
          800: '#3d0a11',
          700: '#33305e',
          600: '#5b1b3e',
        },
        ember: {
          500: '#b3212b',
          400: '#e86034',
        },
        cream: {
          DEFAULT: '#F5F1E8',
          dim: '#D8D2C4',
        },
        live: '#3CFF7A',
        auto: {
          yellow: '#FFC72C',
          black: '#111111',
        },
      },
      boxShadow: {
        glass: '0 24px 60px -20px rgba(0,0,0,0.65), 0 2px 0 0 rgba(255,255,255,0.06) inset',
        glow: '0 0 40px -6px rgba(255,122,61,0.55)',
        horn: '0 10px 40px -8px rgba(216,56,47,0.85)',
      },
      backdropBlur: {
        glass: '18px',
      },
      transitionTimingFunction: {
        cine: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      screens: {
        short: { raw: '(max-height: 500px)' },
      },
    },
  },
  plugins: [],
}
