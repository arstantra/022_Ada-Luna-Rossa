/** @type {import('tailwindcss').Config} */
// Prima Tailwind era caricato dal CDN (cdn.tailwindcss.com) a ogni apertura dell'app:
// ora è compilato nella build, così nessuno script esterno gira nella pagina.
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        serif: ['Lora', 'serif'],
      },
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ping': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
