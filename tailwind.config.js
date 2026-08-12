/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
