/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        amendoa: {
          void: 'rgba(18, 18, 18, 0.85)',
          kernel: '#E4D0A4', // Pale Almond
          burn: '#D97706',   // Amber/Gold
          glass: 'rgba(20, 20, 20, 0.6)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '-10px 0 30px rgba(0,0,0,0.5)',
      }
    },
  },
  plugins: [],
}
