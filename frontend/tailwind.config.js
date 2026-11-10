/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        attendai: {
          indigo: '#6366F1',
          'indigo-deep': '#4F46E5',
          purple: '#8B5CF6',
          'purple-soft': '#A78BFA',
          'purple-lavender': '#EDE9FE',
          navy: '#0F172A',
          'navy-sidebar': '#111C3A',
          teal: '#14B8A6',
          cyan: '#22D3EE',
          'bg-main': '#F8FAFC',
          'bg-lavender': '#F5F3FF',
          'bg-secondary': '#F1F5F9',
          'status-present': '#16A34A',
          'status-present-bg': '#DCFCE7',
          'status-absent': '#EF4444',
          'status-absent-bg': '#FEE2E2',
          'status-late': '#F59E0B',
          'status-late-bg': '#FEF3C7',
          'status-pending': '#3B82F6',
          'status-pending-bg': '#DBEAFE',
          'status-excused': '#8B5CF6'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

