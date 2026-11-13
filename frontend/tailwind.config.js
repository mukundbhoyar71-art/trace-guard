/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0D0F',
        sidebar: '#101214',
        card: {
          DEFAULT: '#151719',
          secondary: '#1B1E22',
          subtle: '#181B1E',
        },
        border: {
          DEFAULT: '#292D32',
          subtle: '#202428',
          glow: 'rgba(7, 139, 255, 0.3)',
        },
        cyber: {
          blue: '#078BFF',
          cyan: '#00CFFF',
          purple: '#8B5CF6',
          green: '#22C55E',
          orange: '#F59E0B',
          red: '#EF4444',
          text: '#FFFFFF',
          muted: '#9CA3AF',
          dark: '#0B0D0F',
          sidebar: '#101214',
          card: '#151719',
          cardSec: '#1B1E22',
          border: '#292D32',
        },
        primary: {
          DEFAULT: '#078BFF',
          hover: '#0077E6',
          light: '#00CFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'cyber-card': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(41, 45, 50, 0.6)',
        'cyber-card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.7), 0 0 12px 1px rgba(7, 139, 255, 0.15)',
        'glow-blue': '0 0 20px -3px rgba(7, 139, 255, 0.35)',
        'glow-cyan': '0 0 20px -3px rgba(0, 207, 255, 0.35)',
        'glow-purple': '0 0 20px -3px rgba(139, 92, 246, 0.35)',
      },
      backgroundImage: {
        'cyber-grid': 'radial-gradient(circle at 1px 1px, rgba(41, 45, 50, 0.4) 1px, transparent 0)',
      }
    },
  },
  plugins: [],
}
