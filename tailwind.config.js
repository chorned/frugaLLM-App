/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"ABC Oracle"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        zen: {
          canvas: '#FFFFFF',
          surface: '#FFFFFF',
          'surface-hover': '#F4F4F5',
          'surface-secondary': '#F9F9FB',
          border: '#E5E7EB',
          'border-subtle': '#F0F0F2',
          text: '#171717',
          'text-secondary': '#737373',
          'text-tertiary': '#A1A1AA',
          accent: '#000000',
          'accent-hover': '#262626',
          success: '#10B981',
          pill: '#F4F4F5',
          'pill-hover': '#E4E4E7',
        }
      },
      boxShadow: {
        glass: '0 4px 20px rgba(0, 0, 0, 0.03)',
        'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.02)',
        'glass-lg': '0 12px 40px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'pill': '9999px',
        'card': '16px',
        'input': '12px',
      },
      keyframes: {
        'stream-forward': {
          '0%': { 'stroke-dashoffset': '40' },
          '100%': { 'stroke-dashoffset': '0' },
        },
        'stream-reverse': {
          '0%': { 'stroke-dashoffset': '0' },
          '100%': { 'stroke-dashoffset': '40' },
        },
      },
      animation: {
        'stream-forward': 'stream-forward 0.8s linear infinite',
        'stream-reverse': 'stream-reverse 1.1s linear infinite',
      },
    },
  },
  plugins: [],
}
