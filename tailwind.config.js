/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#111318',
        surface: {
          DEFAULT: '#1A1D24',
          elevated: '#222631',
          hover: '#262B37',
        },
        electric: {
          DEFAULT: '#5B7CFA',
          hover: '#4C6EF5',
          active: '#3B5BDB',
          subtle: 'rgba(91, 124, 250, 0.12)',
          border: 'rgba(91, 124, 250, 0.35)',
        },
        border: {
          subtle: '#262A35',
          DEFAULT: '#2E3342',
          focus: '#5B7CFA',
        },
        text: {
          primary: '#F4F5F7',
          secondary: '#969BA8',
          muted: '#636A7E',
        },
        presence: {
          online: '#22C55E',
          transferring: '#5B7CFA',
          idle: '#EAB308',
          offline: '#64748B',
        },
        status: {
          success: '#10B981',
          error: '#EF4444',
          warning: '#F59E0B',
        }
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"Cascadia Code"',
          '"Segoe UI Mono"',
          'Consolas',
          'monospace'
        ]
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.35)',
        elevated: '0 4px 12px rgba(0, 0, 0, 0.45)',
        dock: '0 8px 24px rgba(0, 0, 0, 0.65)',
        highlight: '0 0 0 1px #5B7CFA',
      }
    },
  },
  plugins: [],
}
