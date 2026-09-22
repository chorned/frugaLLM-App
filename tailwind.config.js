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
          canvas: 'var(--zen-canvas)',
          surface: 'var(--zen-surface)',
          'surface-header': 'var(--zen-surface-header)',
          'surface-header-active': 'var(--zen-surface-header-active)',
          'surface-hover': 'var(--zen-surface-hover)',
          'surface-secondary': 'var(--zen-surface-secondary)',
          border: 'var(--zen-border)',
          'border-subtle': 'var(--zen-border-subtle)',
          'border-input': 'var(--zen-border-input)',
          edge: 'var(--zen-edge)',
          text: 'var(--zen-text)',
          'text-secondary': 'var(--zen-text-secondary)',
          'text-tertiary': 'var(--zen-text-tertiary)',
          accent: 'var(--zen-accent)',
          'accent-hover': 'var(--zen-accent-hover)',
          success: 'var(--zen-success)',
          pill: 'var(--zen-pill-bg)',
          'pill-hover': 'var(--zen-pill-hover)',
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
