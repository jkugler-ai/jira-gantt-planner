/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nvidia: {
          green: '#76B900',
          dark: '#f8f9fa',
          darker: '#ffffff',
          surface: '#f1f3f5',
          border: '#dee2e6',
        },
      },
    },
  },
  plugins: [],
};
