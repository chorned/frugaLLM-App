/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        zen: {
          canvas: '#F9F9F8',
          surface: '#FFFFFF',
          'surface-hover': '#F3F4F6',
          border: '#E5E5EA',
          text: '#2C2C2E',
          'text-secondary': '#8E8E93',
          accent: '#6B7F99',
          'accent-hover': '#576A82',
          success: '#A7D4B6',
        }
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 4px 12px rgba(0, 0, 0, 0.05)',
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
