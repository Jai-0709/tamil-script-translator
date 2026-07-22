/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        temple: {
          bg: '#f4f0ec', // Light parchment/stone
          card: '#e8e2d9', // Slightly darker stone for bento cards
          border: '#d4cdc3', // Stone carving borders
          text: '#2c2825', // Deep earthy charcoal
          terracotta: '#b2533e', // Brick / earthy red accent
          gold: '#c29b47', // Antique gold
          teal: '#235347', // Deep temple teal
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        englishRetro: ['Cinzel', 'serif'],
        tamilMain: ['"Tiro Tamil"', 'serif'],
        tamilHand: ['Kavivanar', 'cursive'],
        tamilDisplay: ['"Arima Madurai"', 'serif'],
      },
      boxShadow: {
        'bento': '4px 4px 0px 0px rgba(44, 40, 37, 1)', // Flat retro shadow
        'bento-hover': '2px 2px 0px 0px rgba(44, 40, 37, 1)',
      }
    },
  },
  plugins: [],
}
