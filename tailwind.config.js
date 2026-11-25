/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0B0E',
        panel: '#111318',
        elevated: '#171A21',
        hairline: '#222631',
        'broadcast-amber': '#F59E0B',
        'broadcast-cyan': '#06B6D4',
        'broadcast-emerald': '#10B981',
        'broadcast-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
